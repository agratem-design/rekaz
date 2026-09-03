-- Migration: 20260831190000_party_level_technician_payments.sql
-- Description: Canonical Party-Level Technician Account & Payment Architecture (No Project Allocations)

-- 1. ADD AUDIT & CONTEXT COLUMNS TO technician_payments
ALTER TABLE public.technician_payments 
  ADD COLUMN IF NOT EXISTS context_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reversed')),
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_technician_payments_status ON public.technician_payments(status);
CREATE INDEX IF NOT EXISTS idx_technician_payments_context_project ON public.technician_payments(context_project_id);

-- 2. DROP OBSOLETE/UNUSED technician_payment_allocations SAFELY
DROP TABLE IF EXISTS public.technician_payment_allocations CASCADE;

-- 3. REVISE IMMUTABILITY TRIGGER TO PERMIT AUTHORITATIVE RPC UPDATES
CREATE OR REPLACE FUNCTION public.trg_prevent_payment_header_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent direct manual DELETE of payment headers
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DIRECT_DELETE_FORBIDDEN: Payment records cannot be directly deleted. Use authoritative reversal RPC.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. CANONICAL PARTY-LEVEL TECHNICIAN PAYMENT RPC (NO PROJECT ALLOCATIONS)
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
  v_total_earned NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_global_due NUMERIC := 0;
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

  -- 3. Validate Amount
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

  -- 6. Canonical Global Technician Account Balance
  -- Total Earned = SUM(technician_progress_records.earned_amount)
  SELECT COALESCE(SUM(earned_amount), 0)
  INTO v_total_earned
  FROM public.technician_progress_records
  WHERE technician_id = p_technician_id;

  -- Total Paid = SUM(technician_payments WHERE completed) + SUM(expenses WHERE labor)
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

  v_global_due := GREATEST(0, v_total_earned - v_total_paid);

  IF v_global_due <= 0 THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_DUES: لا توجد مستحقات أعمال متبقية للفني (الرصيد المستحق = 0).'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount > (v_global_due + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: المبلغ المدخل (%) يتجاوز صافي رصيد مستحقات الفني (%).', p_amount, v_global_due
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Insert Technician Payment Header (Party-Level Authority)
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

  -- 8. Insert EXACTLY ONE Treasury OUT (No Project Allocations)
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
    'صرف مستحقات فني على الحساب: ' || v_technician.name,
    p_date,
    'technician_payments',
    'technician_payment',
    v_payment_id,
    COALESCE(p_notes, p_reference)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'technician_name', v_technician.name,
    'total_amount', p_amount,
    'date', p_date,
    'treasury_name', v_treasury.name,
    'payment_method', p_payment_method,
    'balance_after', v_global_due - p_amount
  );
END;
$$;

-- 5. ATOMIC TECHNICIAN PAYMENT UPDATE RPC
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
  v_technician RECORD;
  v_treasury RECORD;
  v_total_earned NUMERIC := 0;
  v_other_paid NUMERIC := 0;
  v_max_allowed NUMERIC := 0;
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

  -- 4. Re-calculate Global Balance excluding this payment
  SELECT COALESCE(SUM(earned_amount), 0)
  INTO v_total_earned
  FROM public.technician_progress_records
  WHERE technician_id = v_payment.technician_id;

  SELECT 
    COALESCE((
      SELECT SUM(amount)
      FROM public.technician_payments
      WHERE technician_id = v_payment.technician_id AND status = 'completed' AND id <> p_payment_id
    ), 0) +
    COALESCE((
      SELECT SUM(amount)
      FROM public.expenses
      WHERE technician_id = v_payment.technician_id AND type = 'labor'
    ), 0)
  INTO v_other_paid;

  v_max_allowed := GREATEST(0, v_total_earned - v_other_paid);

  IF p_amount > (v_max_allowed + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: المبلغ المعدل (%) يتجاوز سقف مستحقات الفني المتاحة (%).', p_amount, v_max_allowed
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Update Payment Header
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

  -- 6. Update Associated Treasury Transaction
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

-- 6. ATOMIC TECHNICIAN PAYMENT REVERSAL RPC
CREATE OR REPLACE FUNCTION public.reverse_technician_payment_atomic(
  p_payment_id UUID,
  p_reversal_reason TEXT DEFAULT 'إلغاء دفعة بطلب المستخدم'
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
    RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to reverse payments'
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
    RAISE EXCEPTION 'PAYMENT_ALREADY_REVERSED: This payment is already reversed.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Mark Payment Reversed
  UPDATE public.technician_payments
  SET
    status = 'reversed',
    reversed_at = now(),
    reversed_by = v_caller_id,
    reversal_reason = p_reversal_reason,
    updated_at = now()
  WHERE id = p_payment_id;

  -- 4. Delete/Reverse Associated Treasury Transaction (Triggers auto-restore treasury balance)
  DELETE FROM public.treasury_transactions
  WHERE reference_type = 'technician_payment' AND reference_id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'reversed_amount', v_payment.amount,
    'message', 'تم إلغاء الدفعة واستعادة رصيد الخزينة بنجاح'
  );
END;
$$;

-- 7. GRANT EXECUTE TO AUTHENTICATED USERS
REVOKE EXECUTE ON FUNCTION public.pay_technician_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_technician_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_technician_payment_atomic(UUID, NUMERIC, UUID, TEXT, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_technician_payment_atomic(UUID, NUMERIC, UUID, TEXT, DATE, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reverse_technician_payment_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_technician_payment_atomic(UUID, TEXT) TO authenticated;
