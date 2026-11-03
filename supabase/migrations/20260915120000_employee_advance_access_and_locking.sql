-- Harden the existing, inspected employee advance procedures.

CREATE OR REPLACE FUNCTION public.disburse_employee_advance(p_employee_id uuid, p_amount numeric, p_treasury_id uuid, p_monthly_deduction numeric DEFAULT 0, p_notes text DEFAULT NULL::text, p_date date DEFAULT CURRENT_DATE)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
DECLARE
    v_advance_id UUID;
    v_emp_name TEXT;
BEGIN

    IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','accountant')) THEN
        RAISE EXCEPTION 'غير مصرح بإدارة السلف' USING ERRCODE='42501';
    END IF;
    IF p_date IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN
        RAISE EXCEPTION 'مبلغ أو تاريخ السلفة غير صالح';
    END IF;
    SELECT name INTO v_emp_name FROM public.employees WHERE id = p_employee_id;
    IF v_emp_name IS NULL THEN
        RAISE EXCEPTION 'الموظف غير موجود';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'مبلغ السلفة يجب أن يكون أكبر من الصفر';
    END IF;

    IF p_monthly_deduction<0 OR p_monthly_deduction::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'قسط السلفة غير صالح'; END IF;
    PERFORM 1 FROM public.treasuries WHERE id=p_treasury_id AND is_active IS DISTINCT FROM false AND balance>=p_amount FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الخزينة غير نشطة أو رصيدها غير كاف'; END IF;
    -- Insert advance record
    INSERT INTO public.employee_advances (
        employee_id, amount, paid_back_amount, remaining_amount,
        treasury_id, disbursement_date, monthly_deduction, status, notes
    ) VALUES (
        p_employee_id, p_amount, 0, p_amount,
        p_treasury_id, p_date, COALESCE(p_monthly_deduction, 0), 'active', p_notes
    ) RETURNING id INTO v_advance_id;

    -- Insert treasury withdrawal
    INSERT INTO public.treasury_transactions (
        treasury_id, type, amount, balance_after,
        source, source_details, reference_id, reference_type,
        description, date, notes
    ) VALUES (
        p_treasury_id, 'withdrawal', p_amount, 0,
        'advance', 'سلفة موظف', v_advance_id, 'employee_advance',
        'صرف سلفة للموظف: ' || v_emp_name, p_date, p_notes
    );

    -- Sync treasury balance
    UPDATE public.treasuries
    SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM public.treasury_transactions
        WHERE treasury_id = p_treasury_id
    ) WHERE id = p_treasury_id;

    -- Update balance_after
    UPDATE public.treasury_transactions
    SET balance_after = (SELECT balance FROM public.treasuries WHERE id = p_treasury_id)
    WHERE reference_id = v_advance_id AND reference_type = 'employee_advance';

    RETURN v_advance_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.repay_employee_advance(p_advance_id uuid, p_amount numeric, p_treasury_id uuid, p_notes text DEFAULT NULL::text, p_date date DEFAULT CURRENT_DATE)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
DECLARE
    v_repay_id UUID;
    v_adv RECORD;
    v_emp_name TEXT;
    v_new_paid NUMERIC;
    v_new_rem NUMERIC;
    v_new_status TEXT;
BEGIN

    IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','accountant')) THEN
        RAISE EXCEPTION 'غير مصرح بإدارة السلف' USING ERRCODE='42501';
    END IF;
    IF p_date IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN
        RAISE EXCEPTION 'مبلغ أو تاريخ السلفة غير صالح';
    END IF;
    SELECT * INTO v_adv FROM public.employee_advances WHERE id = p_advance_id FOR UPDATE;
    IF v_adv IS NULL THEN
        RAISE EXCEPTION 'سجل السلفة غير موجود';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'المبلغ المسدد يجب أن يكون أكبر من الصفر';
    END IF;

    IF p_amount > v_adv.remaining_amount THEN
        RAISE EXCEPTION 'المبلغ المدفوع أكبر من المتبقي على السلفة (المتبقي: %)', v_adv.remaining_amount;
    END IF;

    IF v_adv.status <> 'active' THEN RAISE EXCEPTION 'السلفة ليست نشطة'; END IF;
    PERFORM 1 FROM public.treasuries WHERE id=p_treasury_id AND is_active IS DISTINCT FROM false FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'اختر خزينة نشطة'; END IF;
    SELECT name INTO v_emp_name FROM public.employees WHERE id = v_adv.employee_id;

    v_new_paid := v_adv.paid_back_amount + p_amount;
    v_new_rem := v_adv.remaining_amount - p_amount;
    v_new_status := CASE WHEN v_new_rem <= 0 THEN 'settled' ELSE 'active' END;

    UPDATE public.employee_advances
    SET paid_back_amount = v_new_paid,
        remaining_amount = v_new_rem,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_advance_id;

    -- Insert repayment
    INSERT INTO public.employee_advance_repayments (
        advance_id, employee_id, amount, treasury_id, repayment_type, date, notes
    ) VALUES (
        p_advance_id, v_adv.employee_id, p_amount, p_treasury_id, 'cash_return', p_date, p_notes
    ) RETURNING id INTO v_repay_id;

    -- Insert treasury deposit
    INSERT INTO public.treasury_transactions (
        treasury_id, type, amount, balance_after,
        source, source_details, reference_id, reference_type,
        description, date, notes
    ) VALUES (
        p_treasury_id, 'deposit', p_amount, 0,
        'advance_repayment', 'سداد سلفة موظف', v_repay_id, 'advance_repayment',
        'استرداد نقدي لسلفة الموظف: ' || v_emp_name, p_date, p_notes
    );

    -- Sync treasury balance
    UPDATE public.treasuries
    SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM public.treasury_transactions
        WHERE treasury_id = p_treasury_id
    ) WHERE id = p_treasury_id;

    -- Update balance_after
    UPDATE public.treasury_transactions
    SET balance_after = (SELECT balance FROM public.treasuries WHERE id = p_treasury_id)
    WHERE reference_id = v_repay_id AND reference_type = 'advance_repayment';

    RETURN v_repay_id;
END;
$function$;

-- Restrict direct mutation: financial writes go through authenticated, guarded procedures.
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advance_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_slips ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['employee_advances','employee_advance_repayments','employee_payrolls','employee_payroll_slips'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t);
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.%I FROM authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    EXECUTE format('CREATE POLICY payroll_authenticated_read ON public.%I FOR SELECT TO authenticated USING (true)',t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.disburse_employee_advance(uuid,numeric,uuid,numeric,text,date),public.repay_employee_advance(uuid,numeric,uuid,text,date),public.disburse_payroll_slip(uuid,uuid,date,text),public.generate_monthly_payroll(integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.disburse_employee_advance(uuid,numeric,uuid,numeric,text,date),public.repay_employee_advance(uuid,numeric,uuid,text,date),public.disburse_payroll_slip(uuid,uuid,date,text),public.generate_monthly_payroll(integer,integer,text) TO authenticated;

