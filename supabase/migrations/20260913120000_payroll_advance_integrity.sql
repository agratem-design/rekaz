-- Requires the employee payroll schema already used by the application.
-- New entry point: existing paid slips and their historical postings are preserved.
CREATE OR REPLACE FUNCTION public.disburse_payroll_slip_v2(
  p_slip_id uuid, p_treasury_id uuid, p_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.employee_payroll_slips%ROWTYPE;
  a public.employee_advances%ROWTYPE;
  available numeric;
  deduction numeric := 0;
  part numeric;
  cash numeric;
  treasury_balance numeric;
  employee_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','accountant')
  ) THEN RAISE EXCEPTION 'غير مصرح بصرف الرواتب' USING ERRCODE='42501'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'تاريخ الصرف مطلوب'; END IF;
  SELECT * INTO s FROM public.employee_payroll_slips WHERE id=p_slip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'قسيمة الراتب غير موجودة'; END IF;
  IF s.status='paid' THEN
    IF s.treasury_id IS DISTINCT FROM p_treasury_id THEN RAISE EXCEPTION 'تم صرف القسيمة من خزينة أخرى'; END IF;
    RETURN true;
  END IF;
  IF s.status <> 'pending' THEN RAISE EXCEPTION 'القسيمة ليست قابلة للصرف'; END IF;
  -- Serialize all slips for the same employee and all updates of this payroll's totals.
  SELECT name INTO employee_name FROM public.employees WHERE id=s.employee_id FOR UPDATE;
  PERFORM 1 FROM public.employee_payrolls WHERE id=s.payroll_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.employee_payrolls WHERE id=s.payroll_id AND status='cancelled') THEN
    RAISE EXCEPTION 'مسير الرواتب ملغى';
  END IF;
  PERFORM 1 FROM public.employee_advances WHERE employee_id=s.employee_id ORDER BY disbursement_date,id FOR UPDATE;
  SELECT balance INTO treasury_balance FROM public.treasuries
    WHERE id=p_treasury_id AND is_active IS DISTINCT FROM false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'اختر خزينة صرف نشطة'; END IF;
  available := s.basic_salary + s.allowances - s.deductions;
  IF available IS NULL OR available < 0 OR available::text IN ('NaN','Infinity','-Infinity')
    OR s.basic_salary < 0 OR s.allowances < 0 OR s.deductions < 0 THEN
    RAISE EXCEPTION 'قيم استحقاق الراتب أو الخصومات غير صالحة';
  END IF;
  IF treasury_balance IS NULL OR treasury_balance::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'رصيد الخزينة غير صالح';
  END IF;
  -- Re-read balances under row locks: a cash repayment since generation must not be deducted again.
  -- With no instalment configured, recover the available balance up to the salary ceiling.
  FOR a IN SELECT * FROM public.employee_advances
    WHERE employee_id=s.employee_id AND status='active' AND remaining_amount>0
      AND disbursement_date<=p_date ORDER BY disbursement_date,id FOR UPDATE
  LOOP
    IF a.remaining_amount::text IN ('NaN','Infinity','-Infinity')
      OR a.monthly_deduction < 0 OR a.monthly_deduction::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'قسط السلفة غير صالح';
    END IF;
    part := LEAST(a.remaining_amount, COALESCE(NULLIF(a.monthly_deduction,0),a.remaining_amount), available-deduction);
    IF part < 0 THEN RAISE EXCEPTION 'قسط السلفة غير صالح'; END IF;
    IF part > 0 THEN
      INSERT INTO public.employee_advance_repayments
        (advance_id, employee_id, amount, date, repayment_type, payroll_slip_id, treasury_id, notes)
      VALUES (a.id,s.employee_id,part,p_date,'payroll_deduction',s.id,NULL,'استقطاع من الراتب دون حركة نقدية');
      UPDATE public.employee_advances SET paid_back_amount=a.paid_back_amount+part,
        status=CASE WHEN a.remaining_amount-part<=0 THEN 'settled' ELSE 'active' END,
        updated_at=now() WHERE id=a.id;
      IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.employee_advances'::regclass
        AND attname='remaining_amount' AND attgenerated='') THEN
        UPDATE public.employee_advances SET remaining_amount=a.remaining_amount-part WHERE id=a.id;
      END IF;
      deduction := deduction+part;
    END IF;
  END LOOP;
  cash := available-deduction;
  IF treasury_balance < cash THEN RAISE EXCEPTION 'رصيد الخزينة غير كاف لصافي الراتب'; END IF;
  UPDATE public.employee_payroll_slips SET advance_deduction=deduction,
    advance_id=NULL, net_salary=cash, treasury_id=p_treasury_id,
    disbursement_date=p_date, status='paid', notes=COALESCE(p_notes,notes), updated_at=now()
    WHERE id=s.id;
  -- Only net cash leaves the treasury. Advance recovery is not a cash deposit.
  IF cash>0 THEN
    INSERT INTO public.treasury_transactions
      (treasury_id,type,amount,balance_after,date,source,reference_type,reference_id,description,notes)
    VALUES (p_treasury_id,'withdrawal',cash,treasury_balance-cash,p_date,
      'salary','employee_payroll_slip',s.id,'صرف راتب: '||employee_name,p_notes);
  END IF;
  IF (SELECT balance FROM public.treasuries WHERE id=p_treasury_id) IS DISTINCT FROM treasury_balance-cash THEN
    RAISE EXCEPTION 'تعذر مطابقة حركة الراتب مع رصيد الخزينة؛ أُلغيت العملية';
  END IF;
  UPDATE public.employee_payrolls p SET
    total_basic_salaries=t.basic, total_allowances=t.allowances,
    total_deductions=t.deductions,total_advances_deducted=t.advances,
    total_net_salaries=t.net,updated_at=now()
  FROM (SELECT sum(basic_salary) basic,sum(allowances) allowances,sum(deductions) deductions,
    sum(advance_deduction) advances,sum(net_salary) net
    FROM public.employee_payroll_slips WHERE payroll_id=s.payroll_id) t WHERE p.id=s.payroll_id;
  IF NOT EXISTS (SELECT 1 FROM public.employee_payroll_slips WHERE payroll_id=s.payroll_id AND status<>'paid') THEN
    UPDATE public.employee_payrolls SET status='disbursed' WHERE id=s.payroll_id;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.disburse_payroll_slip_v2(uuid,uuid,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disburse_payroll_slip_v2(uuid,uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_monthly_payroll_v2(p_month integer,p_year integer,p_title text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payroll uuid; s record; deduction numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id=auth.uid() AND role::text IN ('admin','accountant')) THEN
    RAISE EXCEPTION 'غير مصرح بإعداد الرواتب' USING ERRCODE='42501';
  END IF;
  IF p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 OR p_year IS NULL OR p_year NOT BETWEEN 2020 AND 2200 THEN
    RAISE EXCEPTION 'فترة الرواتب غير صالحة';
  END IF;
  PERFORM pg_advisory_xact_lock(73125,p_year*100+p_month);
  IF EXISTS (SELECT 1 FROM public.employee_payrolls WHERE month=p_month AND year=p_year) THEN
    RAISE EXCEPTION 'يوجد مسير رواتب لهذه الفترة بالفعل';
  END IF;
  INSERT INTO public.employee_payrolls(month,year,title,status)
    VALUES(p_month,p_year,COALESCE(NULLIF(trim(p_title),''),'مسير رواتب '||p_month||' / '||p_year),'draft') RETURNING id INTO payroll;
  INSERT INTO public.employee_payroll_slips(payroll_id,employee_id,basic_salary,allowances,deductions,advance_deduction,net_salary,status)
    SELECT payroll,id,salary,0,0,0,salary,'pending' FROM public.employees WHERE salary>0;
  FOR s IN SELECT * FROM public.employee_payroll_slips WHERE payroll_id=payroll LOOP
    SELECT COALESCE(sum(LEAST(remaining_amount,COALESCE(NULLIF(monthly_deduction,0),remaining_amount))),0)
      INTO deduction FROM public.employee_advances WHERE employee_id=s.employee_id
      AND status='active' AND remaining_amount>0 AND disbursement_date<=CURRENT_DATE;
    deduction:=LEAST(deduction,GREATEST(0,s.basic_salary+s.allowances-s.deductions));
    UPDATE public.employee_payroll_slips SET advance_deduction=deduction,advance_id=NULL,
      net_salary=basic_salary+allowances-deductions-deduction WHERE id=s.id;
  END LOOP;
  UPDATE public.employee_payrolls SET
    total_basic_salaries=(SELECT COALESCE(sum(basic_salary),0) FROM public.employee_payroll_slips WHERE payroll_id=payroll),
    total_advances_deducted=(SELECT COALESCE(sum(advance_deduction),0) FROM public.employee_payroll_slips WHERE payroll_id=payroll),
    total_net_salaries=(SELECT COALESCE(sum(net_salary),0) FROM public.employee_payroll_slips WHERE payroll_id=payroll)
    WHERE id=payroll;
  RETURN payroll;
END $$;
REVOKE ALL ON FUNCTION public.generate_monthly_payroll_v2(integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_monthly_payroll_v2(integer,integer,text) TO authenticated;

-- Existing clients must use the same locking and validation rules.
CREATE OR REPLACE FUNCTION public.disburse_payroll_slip(p_slip_id uuid,p_treasury_id uuid,p_date date DEFAULT CURRENT_DATE,p_notes text DEFAULT NULL)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT public.disburse_payroll_slip_v2(p_slip_id,p_treasury_id,p_date,p_notes);
$$;
CREATE OR REPLACE FUNCTION public.generate_monthly_payroll(p_month integer,p_year integer,p_title text DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT public.generate_monthly_payroll_v2(p_month,p_year,p_title);
$$;
