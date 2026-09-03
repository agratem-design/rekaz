-- Migration: 20260829190000_finalize_rpc_authorization_and_domain.sql
-- Description: Final role authorization, fail-closed domain and project-type checks, and strict immediate-payment scope

DROP FUNCTION IF EXISTS public.create_purchase_with_immediate_payment(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.create_purchase_with_immediate_payment(
  p_purchase jsonb,
  p_payment jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
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
  -- A. Authentication & Server-Side Role Authorization Check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Verify caller has admin or accountant role authority in user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_caller_id 
      AND role IN ('admin'::public.app_role, 'accountant'::public.app_role)
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to execute immediate purchase payments' 
      USING ERRCODE = '42501';
  END IF;

  -- B. Strict Scope Check: p_payment must NOT be null
  IF p_payment IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_REQUIRED: This RPC is exclusively for purchase with immediate payment. Use standard purchases table for unpaid purchases.' 
      USING ERRCODE = '23502';
  END IF;

  -- C. Project Validation (Fail-Closed)
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

  -- Fail-closed on project_type
  IF v_project_type NOT IN ('contracting', 'finishing') THEN
    RAISE EXCEPTION 'UNSUPPORTED_PROJECT_TYPE: Project type must be contracting or finishing' USING ERRCODE = '23514';
  END IF;

  -- D. Phase Validation (Fail-Closed)
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

  -- E. Project Item Validation (Fail-Closed)
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

  -- F. Supplier Validation
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

  -- G. Purchase Amount & Fields
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

  -- H. Immediate Payment Validation (Mandatory)
  IF (p_payment->>'amount') IS NULL OR (p_payment->>'amount')::numeric <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment amount must be greater than 0' USING ERRCODE = '23514';
  END IF;

  v_paid_amount := (p_payment->>'amount')::numeric;

  IF v_paid_amount > v_total_amount THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment amount % cannot exceed purchase total %', v_paid_amount, v_total_amount USING ERRCODE = '23514';
  END IF;

  v_payment_method := NULLIF(TRIM(p_payment->>'payment_method'), '');
  IF v_payment_method IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_REQUIRED: payment_method is mandatory for immediate payment' USING ERRCODE = '23502';
  END IF;

  v_idempotency_key := NULLIF(TRIM(p_payment->>'idempotency_key'), '');
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: idempotency_key is mandatory for immediate payment' USING ERRCODE = '23502';
  END IF;

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

  -- Domain Validation (Fail-Closed using IS DISTINCT FROM)
  IF v_project_type = 'contracting' AND v_t_root_domain IS DISTINCT FROM 'contracting' THEN
    RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Contracting purchase must be paid from Contracting treasury domain' USING ERRCODE = '23514';
  END IF;

  IF v_project_type = 'finishing' AND v_t_root_domain IS DISTINCT FROM 'finishing' THEN
    RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Finishing purchase must be paid from Finishing treasury domain' USING ERRCODE = '23514';
  END IF;

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

  -- 2. Insert Payment atomically
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

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'payment_id', v_payment_id,
    'success', true
  );
END;
$$;

-- Revoke anon execution, Grant authenticated only
REVOKE EXECUTE ON FUNCTION public.create_purchase_with_immediate_payment(jsonb, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_immediate_payment(jsonb, jsonb) TO authenticated;
