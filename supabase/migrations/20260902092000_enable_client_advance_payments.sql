-- Allow client payments to be recorded without a project and keep the amount
-- as an immutable client credit when there is no outstanding project balance.

ALTER TABLE public.client_payments
  ALTER COLUMN project_id DROP NOT NULL;

-- Older installations do not have the journal link used by the client
-- payment workflow; adding it is safe for already-upgraded databases.
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE OR REPLACE FUNCTION public.record_client_payment_atomic(
  p_project_id UUID,
  p_client_id UUID,
  p_treasury_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'cash',
  p_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_payment_id UUID;
  v_remaining_before NUMERIC := 0;
  v_cash_applied NUMERIC := 0;
  v_excess NUMERIC := 0;
  v_credit_ledger_id UUID := NULL;
  v_treasury_balance NUMERIC := 0;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'قيمة الدفعة المقبوضة يجب أن تكون أكبر من الصفر.';
  END IF;

  -- Lock the client first, then the optional project and treasury. This keeps
  -- concurrent payments deterministic while allowing a general client credit.
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE id = p_client_id
  FOR UPDATE;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'الزبون المحدد غير موجود.';
  END IF;

  IF p_project_id IS NOT NULL THEN
    PERFORM id
    FROM public.projects
    WHERE id = p_project_id
      AND client_id = p_client_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'المشروع المحدد غير موجود أو لا يتبع نفس الزبون.';
    END IF;
    v_remaining_before := public.get_project_authoritative_remaining(p_project_id);
  END IF;

  PERFORM id
  FROM public.treasuries
  WHERE id = p_treasury_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الخزينة المحددة غير موجودة.';
  END IF;

  INSERT INTO public.client_payments (
    client_id,
    project_id,
    treasury_id,
    amount,
    payment_method,
    date,
    notes
  ) VALUES (
    p_client_id,
    p_project_id,
    p_treasury_id,
    p_amount,
    COALESCE(NULLIF(trim(p_payment_method), ''), 'cash'),
    COALESCE(p_date, CURRENT_DATE),
    p_notes
  ) RETURNING id INTO v_payment_id;

  v_cash_applied := LEAST(p_amount, v_remaining_before);
  v_excess := GREATEST(0, p_amount - v_cash_applied);

  IF v_excess > 0 THEN
    INSERT INTO public.client_credit_ledger (
      client_id,
      entry_type,
      amount,
      source_payment_id,
      notes,
      created_by
    ) VALUES (
      p_client_id,
      'CREDIT_CREATED',
      v_excess,
      v_payment_id,
      CASE
        WHEN p_project_id IS NULL THEN 'دفعة مقدمة عامة محفوظة كرصد دائن للزبون'
        ELSE 'توليد رصيد دائن نتيجة فائض سداد عن مستحق المشروع'
      END,
      auth.uid()
    ) RETURNING id INTO v_credit_ledger_id;
  END IF;

  -- Keep the operational income journal and treasury ledger in the same
  -- transaction as the payment and credit event.
  INSERT INTO public.income (
    project_id,
    client_id,
    amount,
    date,
    type,
    subtype,
    payment_method,
    status,
    notes,
    reference_id
  ) VALUES (
    p_project_id,
    p_client_id,
    p_amount,
    COALESCE(p_date, CURRENT_DATE),
    'service',
    'client_payment',
    COALESCE(NULLIF(trim(p_payment_method), ''), 'cash'),
    'received',
    COALESCE(p_notes, CASE WHEN p_project_id IS NULL THEN 'تسديد دفعة عامة (رصيد زبون)' ELSE 'تسديد دفعة لمشروع' END),
    v_payment_id
  );

  INSERT INTO public.treasury_transactions (
    treasury_id,
    type,
    amount,
    balance_after,
    description,
    date,
    source,
    reference_type,
    reference_id,
    notes
  )
  SELECT
    p_treasury_id,
    'deposit',
    p_amount,
    0,
    CASE
      WHEN p_project_id IS NULL THEN 'دفعة مقدمة من الزبون (رصيد عام)'
      ELSE 'تسديد من الزبون عن مشروع'
    END,
    COALESCE(p_date, CURRENT_DATE),
    'client_payment',
    'client_payment',
    v_payment_id,
    p_notes
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.treasury_transactions
    WHERE reference_type = 'client_payment'
      AND reference_id = v_payment_id
  );

  SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
  INTO v_treasury_balance
  FROM public.treasury_transactions
  WHERE treasury_id = p_treasury_id;

  UPDATE public.treasuries
  SET balance = v_treasury_balance
  WHERE id = p_treasury_id;

  UPDATE public.treasury_transactions
  SET balance_after = v_treasury_balance
  WHERE reference_type = 'client_payment'
    AND reference_id = v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'cash_applied_to_project', v_cash_applied,
    'credit_created', v_excess,
    'credit_ledger_id', v_credit_ledger_id,
    'is_general_advance', (p_project_id IS NULL)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_client_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_client_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT) TO authenticated, service_role;
