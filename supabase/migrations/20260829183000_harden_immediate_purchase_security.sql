-- Migration: 20260829183000_harden_immediate_purchase_security.sql
-- Description: Complete security hardening, domain validation, role enforcement, and concurrency protection

-- 1. Database-enforced Global Unique Index on purchase_payments idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_payments_idempotency_global 
ON public.purchase_payments (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 2. Database-enforced Unique Index on opening_balance per treasury
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_treasury_opening_balance 
ON public.treasury_transactions (treasury_id) 
WHERE (source = 'opening_balance' OR reference_type = 'opening_balance');

-- 3. Hardened Opening Balance Trigger with row-level locking on treasuries
CREATE OR REPLACE FUNCTION public.validate_treasury_opening_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_treasury_exists boolean;
BEGIN
  IF NEW.source = 'opening_balance' OR NEW.reference_type = 'opening_balance' THEN
    -- Validate deposit type and positive amount
    IF NEW.type <> 'deposit' THEN
      RAISE EXCEPTION 'INVALID_OPENING_BALANCE_TYPE: Opening balance must be a deposit transaction'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.amount <= 0 THEN
      RAISE EXCEPTION 'INVALID_OPENING_BALANCE_AMOUNT: Opening balance amount must be greater than 0'
        USING ERRCODE = '23514';
    END IF;

    -- Concurrency-safe: Row lock the treasury to serialize against concurrent transactions
    SELECT true INTO v_treasury_exists 
    FROM public.treasuries 
    WHERE id = NEW.treasury_id 
    FOR UPDATE;

    IF v_treasury_exists IS NULL THEN
      RAISE EXCEPTION 'INVALID_TREASURY: Treasury % does not exist', NEW.treasury_id
        USING ERRCODE = '23503';
    END IF;

    -- Check if ANY prior transaction exists for this treasury (excluding current row if updating)
    IF EXISTS (
      SELECT 1 FROM public.treasury_transactions
      WHERE treasury_id = NEW.treasury_id
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'OPENING_BALANCE_FORBIDDEN: Opening balance is only allowed as the first transaction before operational history'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_treasury_opening_balance ON public.treasury_transactions;
CREATE TRIGGER trg_validate_treasury_opening_balance
  BEFORE INSERT OR UPDATE ON public.treasury_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_treasury_opening_balance();

-- 4. Hardened create_purchase_with_immediate_payment RPC
CREATE OR REPLACE FUNCTION public.create_purchase_with_immediate_payment(
  p_purchase jsonb,
  p_payment jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_purchase_id uuid;
  v_payment_id uuid := NULL;
  v_total_amount numeric;
  v_paid_amount numeric;
  v_invoice_number text;
  v_title text;
  v_notes text;
  v_purchase_type text;
  v_project_id uuid;
  v_project_type text;
  v_phase_id uuid;
  v_phase_project_id uuid;
  v_project_item_id uuid;
  v_item_project_id uuid;
  v_item_phase_id uuid;
  v_supplier_id uuid;
  v_supplier_exists uuid;
  v_treasury_id uuid;
  v_payment_method text;
  v_date date;
  v_items jsonb;
  v_idempotency_key text;
  v_t_root_id uuid;
  v_t_root_domain text;
  v_t_is_active boolean;
BEGIN
  -- A. Authentication & Authorization check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '42501';
  END IF;

  -- B. Project Validation (Mandatory for Project Purchases)
  IF (p_purchase->>'project_id') IS NULL OR TRIM(p_purchase->>'project_id') = '' THEN
    RAISE EXCEPTION 'PROJECT_ID_REQUIRED: project_id is mandatory for project purchases' USING ERRCODE = '23502';
  END IF;

  v_project_id := (p_purchase->>'project_id')::uuid;

  SELECT project_type INTO v_project_type 
  FROM public.projects 
  WHERE id = v_project_id;

  IF v_project_type IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROJECT: Project % does not exist', v_project_id USING ERRCODE = '23503';
  END IF;

  -- C. Phase Validation (if supplied, must belong to project)
  v_phase_id := CASE 
    WHEN (p_purchase->>'phase_id') IS NOT NULL AND TRIM(p_purchase->>'phase_id') <> '' AND TRIM(p_purchase->>'phase_id') <> 'none' AND TRIM(p_purchase->>'phase_id') <> '__none__'
    THEN (p_purchase->>'phase_id')::uuid 
    ELSE NULL 
  END;

  IF v_phase_id IS NOT NULL THEN
    SELECT project_id INTO v_phase_project_id 
    FROM public.project_phases 
    WHERE id = v_phase_id;

    IF v_phase_project_id IS NULL OR v_phase_project_id <> v_project_id THEN
      RAISE EXCEPTION 'INVALID_PHASE_PROJECT: Phase % does not belong to project %', v_phase_id, v_project_id USING ERRCODE = '23514';
    END IF;
  END IF;

  -- D. Project Item Validation
  v_project_item_id := CASE 
    WHEN (p_purchase->>'project_item_id') IS NOT NULL AND TRIM(p_purchase->>'project_item_id') <> '' AND TRIM(p_purchase->>'project_item_id') <> 'none' AND TRIM(p_purchase->>'project_item_id') <> '__none__'
    THEN (p_purchase->>'project_item_id')::uuid 
    ELSE NULL 
  END;

  -- For Finishing: project item is strictly forbidden
  IF v_project_type = 'finishing' AND v_project_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'FINISHING_PROJECT_ITEM_FORBIDDEN: Project item attribution is not allowed for finishing projects' USING ERRCODE = '23514';
  END IF;

  IF v_project_item_id IS NOT NULL THEN
    SELECT project_id, phase_id INTO v_item_project_id, v_item_phase_id 
    FROM public.project_items 
    WHERE id = v_project_item_id;

    IF v_item_project_id IS NULL OR v_item_project_id <> v_project_id THEN
      RAISE EXCEPTION 'INVALID_PROJECT_ITEM: Project item % does not belong to project %', v_project_item_id, v_project_id USING ERRCODE = '23514';
    END IF;

    IF v_phase_id IS NOT NULL AND v_item_phase_id IS NOT NULL AND v_item_phase_id <> v_phase_id THEN
      RAISE EXCEPTION 'PHASE_ATTRIBUTION_CONFLICT: Purchase phase % conflicts with item phase %', v_phase_id, v_item_phase_id USING ERRCODE = '23514';
    END IF;
  END IF;

  -- E. Supplier Validation
  IF (p_purchase->>'supplier_id') IS NULL OR TRIM(p_purchase->>'supplier_id') = '' THEN
    RAISE EXCEPTION 'SUPPLIER_ID_REQUIRED: supplier_id is mandatory' USING ERRCODE = '23502';
  END IF;

  v_supplier_id := (p_purchase->>'supplier_id')::uuid;

  SELECT id INTO v_supplier_exists 
  FROM public.suppliers 
  WHERE id = v_supplier_id;

  IF v_supplier_exists IS NULL THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER: Supplier % does not exist', v_supplier_id USING ERRCODE = '23503';
  END IF;

  -- F. Purchase Amount & Fields
  v_total_amount := (p_purchase->>'total_amount')::numeric;
  IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL_AMOUNT: Purchase total amount must be greater than 0' USING ERRCODE = '23514';
  END IF;

  v_date := (p_purchase->>'date')::date;
  v_invoice_number := NULLIF(TRIM(p_purchase->>'invoice_number'), '');
  v_purchase_type := COALESCE(NULLIF(TRIM(p_purchase->>'purchase_type'), ''), 'material');
  v_title := NULLIF(TRIM(p_purchase->>'title'), '');
  v_notes := NULLIF(TRIM(p_purchase->>'notes'), '');
  v_items := p_purchase->'items';

  -- 1. Insert Purchase
  INSERT INTO public.purchases (
    project_id,
    phase_id,
    project_item_id,
    supplier_id,
    date,
    invoice_number,
    purchase_type,
    title,
    items,
    total_amount,
    paid_amount,
    status,
    notes
  ) VALUES (
    v_project_id,
    v_phase_id,
    v_project_item_id,
    v_supplier_id,
    v_date,
    v_invoice_number,
    v_purchase_type,
    v_title,
    v_items,
    v_total_amount,
    0,
    'due',
    v_notes
  )
  RETURNING id INTO v_purchase_id;

  -- 2. Immediate Payment Validation & Execution (if requested)
  IF p_payment IS NOT NULL AND (p_payment->>'amount') IS NOT NULL AND ((p_payment->>'amount')::numeric > 0) THEN
    v_paid_amount := (p_payment->>'amount')::numeric;

    -- Amount check: positive and <= purchase total
    IF v_paid_amount <= 0 OR v_paid_amount > v_total_amount THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment amount % must be > 0 and <= total %', v_paid_amount, v_total_amount USING ERRCODE = '23514';
    END IF;

    -- Payment method check: mandatory, no silent fallback
    v_payment_method := NULLIF(TRIM(p_payment->>'payment_method'), '');
    IF v_payment_method IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_METHOD_REQUIRED: payment_method is mandatory for immediate payment' USING ERRCODE = '23502';
    END IF;

    -- Idempotency key check: mandatory
    v_idempotency_key := NULLIF(TRIM(p_payment->>'idempotency_key'), '');
    IF v_idempotency_key IS NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: idempotency_key is mandatory for immediate payment' USING ERRCODE = '23502';
    END IF;

    -- Treasury check: mandatory, active, and matching root domain
    IF (p_payment->>'treasury_id') IS NULL OR TRIM(p_payment->>'treasury_id') = '' THEN
      RAISE EXCEPTION 'TREASURY_ID_REQUIRED: treasury_id is mandatory for immediate payment' USING ERRCODE = '23502';
    END IF;

    v_treasury_id := (p_payment->>'treasury_id')::uuid;

    SELECT root_id, root_domain, is_active 
    INTO v_t_root_id, v_t_root_domain, v_t_is_active 
    FROM public.get_treasury_root_domain(v_treasury_id);

    IF v_t_root_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_TREASURY: Treasury % does not exist', v_treasury_id USING ERRCODE = '23503';
    END IF;

    IF v_t_is_active IS NULL OR v_t_is_active = false THEN
      RAISE EXCEPTION 'INACTIVE_TREASURY: Selected treasury % is inactive', v_treasury_id USING ERRCODE = '23514';
    END IF;

    -- Strict Domain Separation
    IF v_project_type = 'contracting' AND v_t_root_domain = 'finishing' THEN
      RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Contracting purchase cannot be paid from Finishing treasury' USING ERRCODE = '23514';
    END IF;

    IF v_project_type = 'finishing' AND v_t_root_domain = 'contracting' THEN
      RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Finishing purchase cannot be paid from Contracting treasury' USING ERRCODE = '23514';
    END IF;

    -- Insert Payment atomically (idempotency enforced by unique index idx_purchase_payments_idempotency_global)
    INSERT INTO public.purchase_payments (
      purchase_id,
      treasury_id,
      amount,
      payment_method,
      date,
      notes,
      idempotency_key
    ) VALUES (
      v_purchase_id,
      v_treasury_id,
      v_paid_amount,
      v_payment_method,
      COALESCE((p_payment->>'date')::date, v_date),
      NULLIF(TRIM(p_payment->>'notes'), ''),
      v_idempotency_key
    )
    RETURNING id INTO v_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'payment_id', v_payment_id,
    'success', true
  );
END;
$$;

-- 5. Revoke anon execution, Grant authenticated only
REVOKE EXECUTE ON FUNCTION public.create_purchase_with_immediate_payment(jsonb, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_immediate_payment(jsonb, jsonb) TO authenticated;
