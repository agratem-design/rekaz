-- Run within a SAVEPOINT and always roll back these synthetic records.
DO $$
DECLARE e uuid; t uuid; p uuid; s uuid; a uuid; b uuid; period integer; n numeric;
BEGIN
  INSERT INTO public.employees(name,salary) VALUES('اختبار رواتب مؤقت',1000) RETURNING id INTO e;
  INSERT INTO public.treasuries(name,balance,is_active) VALUES('اختبار خزينة مؤقت',0,true) RETURNING id INTO t;
  INSERT INTO public.treasury_transactions(treasury_id,type,amount,balance_after,date,source,description)
    VALUES(t,'deposit',5000,0,CURRENT_DATE,'payroll_test','اختبار مؤقت');
  SELECT year INTO period FROM generate_series(2100,2199) year
    WHERE NOT EXISTS(SELECT 1 FROM public.employee_payrolls WHERE month=12 AND employee_payrolls.year=year.year) LIMIT 1;
  IF period IS NULL THEN RAISE EXCEPTION 'No free test period'; END IF;
  INSERT INTO public.employee_payrolls(month,year,title,status) VALUES(12,period,'اختبار مؤقت','draft') RETURNING id INTO p;
  INSERT INTO public.employee_payroll_slips(payroll_id,employee_id,basic_salary,net_salary,status)
    VALUES(p,e,1000,1000,'pending') RETURNING id INTO s;
  a:=public.disburse_employee_advance(e,600,t,200);
  b:=public.disburse_employee_advance(e,300,t,0);
  PERFORM public.repay_employee_advance(a,550,t);
  PERFORM public.disburse_payroll_slip_v2(s,t);
  IF (SELECT net_salary FROM public.employee_payroll_slips WHERE id=s)<>650 THEN RAISE EXCEPTION 'Net salary mismatch'; END IF;
  IF (SELECT sum(amount) FROM public.employee_advance_repayments WHERE payroll_slip_id=s)<>350 THEN RAISE EXCEPTION 'Advance allocations mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.employee_advances WHERE id IN(a,b) AND (remaining_amount<>0 OR status<>'settled')) THEN RAISE EXCEPTION 'Advance not settled'; END IF;
  IF (SELECT balance FROM public.treasuries WHERE id=t)<>4000 THEN RAISE EXCEPTION 'Treasury mismatch'; END IF;
  IF (SELECT status FROM public.employee_payrolls WHERE id=p)<>'disbursed' THEN RAISE EXCEPTION 'Payroll status mismatch'; END IF;
  PERFORM public.disburse_payroll_slip(s,t);
  IF (SELECT count(*) FROM public.treasury_transactions WHERE reference_id=s)<>1 THEN RAISE EXCEPTION 'Duplicate posting'; END IF;
  IF EXISTS(SELECT 1 FROM public.employee_advance_repayments WHERE payroll_slip_id=s AND treasury_id IS NOT NULL) THEN RAISE EXCEPTION 'Deduction is not cash'; END IF;
  -- Failed operations must not add financial records.
  BEGIN
    PERFORM public.disburse_employee_advance(e,9000,t,100);
    RAISE EXCEPTION 'Insufficient funds accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  IF (SELECT balance FROM public.treasuries WHERE id=t)<>4000 THEN RAISE EXCEPTION 'Failure changed cash'; END IF;
END $$;
