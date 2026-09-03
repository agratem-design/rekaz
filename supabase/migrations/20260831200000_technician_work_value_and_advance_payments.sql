-- Migration: Canonical Technician Work Value & Advance Payments Architecture
-- 1. Auto-compute total_cost on project_item_technicians if 0 or null
CREATE OR REPLACE FUNCTION public.trg_auto_compute_project_item_technician_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
    NEW.total_cost := COALESCE(NEW.rate, 0) * COALESCE(NEW.quantity, 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_compute_item_technician_cost ON public.project_item_technicians;
CREATE TRIGGER trg_auto_compute_item_technician_cost
  BEFORE INSERT OR UPDATE ON public.project_item_technicians
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_compute_project_item_technician_cost();

-- Backfill existing project_item_technicians
UPDATE public.project_item_technicians
SET total_cost = COALESCE(NULLIF(total_cost, 0), COALESCE(rate, 0) * COALESCE(quantity, 1))
WHERE total_cost IS NULL OR total_cost = 0;

-- 2. CANONICAL ATOMIC TECHNICIAN ON-ACCOUNT PAYMENT RPC (Supports Advances)
CREATE OR REPLACE FUNCTION public.pay_technician_on_account_atomic(
  p_technician_id UUID,
  p_treasury_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_context_project_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
  v_technician RECORD;
  v_treasury RECORD;
  v_total_work NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_balance_after NUMERIC := 0;
  v_payment_id UUID;
  v_existing_payment_id UUID;
BEGIN
  -- 1. Fail-Closed Authentication & Authorization
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id
      AND role IN ('admin'::public.app_role, 'accountant'::public.app_role)
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to execute technician payments'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Mandatory Idempotency Check
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: An idempotency key is mandatory for financial payments'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existing_payment_id
  FROM public.technician_payments
  WHERE idempotency_key = TRIM(p_idempotency_key);

  IF v_existing_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_existing_payment_id,
      'is_duplicate', true,
      'message', 'Payment already processed.'
    );
  END IF;

  -- 3. Validate Amount (Must be positive; advance payments allowed)
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Validate Technician
  SELECT id, name INTO v_technician
  FROM public.technicians
  WHERE id = p_technician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TECHNICIAN_NOT_FOUND: Technician % does not exist.', p_technician_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Validate Treasury
  SELECT id, name, is_active INTO v_treasury
  FROM public.treasuries
  WHERE id = p_treasury_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREASURY_NOT_FOUND: Treasury % does not exist.', p_treasury_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_treasury.is_active IS FALSE THEN
    RAISE EXCEPTION 'TREASURY_INACTIVE: Treasury % is inactive.', v_treasury.name
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Insert Technician Payment Header (Party-Level Authority)
  INSERT INTO public.technician_payments (
    technician_id,
    treasury_id,
    amount,
    payment_method,
    date,
    reference,
    notes,
    idempotency_key,
    created_by,
    context_project_id,
    status
  ) VALUES (
    p_technician_id,
    p_treasury_id,
    p_amount,
    p_payment_method,
    p_date,
    p_reference,
    p_notes,
    TRIM(p_idempotency_key),
    v_caller_id,
    p_context_project_id,
    'completed'
  )
  RETURNING id INTO v_payment_id;

  -- 7. Insert EXACTLY ONE Treasury OUT
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
  ) VALUES (
    p_treasury_id,
    'withdrawal',
    p_amount,
    0,
    'صرف دفعة للفني على الحساب: ' || v_technician.name,
    p_date,
    'technician_payments',
    'technician_payment',
    v_payment_id,
    COALESCE(p_notes, p_reference)
  );

  -- 8. Compute Global Account Balance after payment
  SELECT COALESCE(
    (SELECT SUM(COALESCE(NULLIF(total_cost, 0), rate * COALESCE(quantity, 1)))
     FROM public.project_item_technicians
     WHERE technician_id = p_technician_id),
    0
  ) INTO v_total_work;

  SELECT 
    COALESCE((
      SELECT SUM(amount)
      FROM public.technician_payments
      WHERE technician_id = p_technician_id AND status = 'completed'
    ), 0) +
    COALESCE((
      SELECT SUM(amount)
      FROM public.expenses
      WHERE technician_id = p_technician_id AND type = 'labor'
    ), 0)
  INTO v_total_paid;

  v_balance_after := v_total_work - v_total_paid;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'technician_name', v_technician.name,
    'total_amount', p_amount,
    'date', p_date,
    'treasury_name', v_treasury.name,
    'payment_method', p_payment_method,
    'total_work', v_total_work,
    'total_paid', v_total_paid,
    'balance_after', v_balance_after
  );
END;
$$;

-- 3. CANONICAL ATOMIC TECHNICIAN PAYMENT UPDATE RPC
CREATE OR REPLACE FUNCTION public.update_technician_payment_atomic(
  p_payment_id UUID,
  p_amount NUMERIC,
  p_treasury_id UUID,
  p_payment_method TEXT,
  p_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
  v_payment RECORD;
  v_treasury RECORD;
BEGIN
  -- 1. Authorization
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id
      AND role IN ('admin'::public.app_role, 'accountant'::public.app_role)
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to edit payments'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validate Payment
  SELECT * INTO v_payment
  FROM public.technician_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Payment % does not exist.', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_payment.status = 'reversed' THEN
    RAISE EXCEPTION 'PAYMENT_REVERSED: Cannot edit a reversed payment.'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Validate Treasury
  SELECT id, name, is_active INTO v_treasury
  FROM public.treasuries
  WHERE id = p_treasury_id;

  IF NOT FOUND OR v_treasury.is_active IS FALSE THEN
    RAISE EXCEPTION 'INVALID_TREASURY: Selected treasury does not exist or is inactive.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Update Payment Header
  UPDATE public.technician_payments
  SET
    amount = p_amount,
    treasury_id = p_treasury_id,
    payment_method = p_payment_method,
    date = p_date,
    notes = p_notes,
    reference = p_reference,
    updated_at = now()
  WHERE id = p_payment_id;

  -- 5. Update Associated Treasury Transaction
  UPDATE public.treasury_transactions
  SET
    treasury_id = p_treasury_id,
    amount = p_amount,
    date = p_date,
    notes = COALESCE(p_notes, p_reference)
  WHERE reference_type = 'technician_payment' AND reference_id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'amount', p_amount,
    'treasury_name', v_treasury.name,
    'date', p_date,
    'message', 'تم تعديل الدفعة بنجاح'
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.pay_technician_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_technician_payment_atomic(UUID, NUMERIC, UUID, TEXT, DATE, TEXT, TEXT) TO authenticated;
