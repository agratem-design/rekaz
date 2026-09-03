-- Supplier on-account payments can be advances. Existing invoice dues are
-- allocated oldest-first; any remainder stays as supplier credit.

CREATE OR REPLACE FUNCTION public.pay_supplier_on_account_atomic(
  p_supplier_id UUID,
  p_treasury_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_supplier RECORD;
  v_treasury RECORD;
  v_root_domain TEXT;
  v_payment_id UUID;
  v_existing_payment_id UUID;
  v_remaining NUMERIC := p_amount;
  v_allocated NUMERIC := 0;
  v_purchase RECORD;
  v_paid NUMERIC;
  v_due NUMERIC;
  v_alloc NUMERIC;
  v_alloc_count INTEGER := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id
      AND role IN ('admin'::public.app_role, 'accountant'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to execute supplier payments'
      USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: An idempotency key is mandatory for financial payments'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT id INTO v_existing_payment_id
  FROM public.supplier_payments
  WHERE idempotency_key = trim(p_idempotency_key);
  IF v_existing_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'payment_id', v_existing_payment_id, 'is_duplicate', true);
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, name INTO v_supplier FROM public.suppliers WHERE id = p_supplier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Supplier does not exist.' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, name, is_active INTO v_treasury FROM public.treasuries WHERE id = p_treasury_id;
  IF NOT FOUND OR v_treasury.is_active IS FALSE THEN
    RAISE EXCEPTION 'INVALID_TREASURY: Selected treasury does not exist or is inactive.' USING ERRCODE = 'P0001';
  END IF;
  SELECT root_domain INTO v_root_domain FROM public.get_treasury_root_domain(p_treasury_id);
  IF v_root_domain IS NOT NULL AND v_root_domain NOT IN ('contracting', 'finishing') THEN
    RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Treasury domain must be contracting or finishing.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.supplier_payments (
    supplier_id, treasury_id, amount, payment_method, date, reference, notes,
    idempotency_key, created_by
  ) VALUES (
    p_supplier_id, p_treasury_id, p_amount, p_payment_method, p_date,
    p_reference, p_notes, trim(p_idempotency_key), v_caller_id
  ) RETURNING id INTO v_payment_id;

  -- Apply the payment to outstanding invoices in the selected domain.
  FOR v_purchase IN
    SELECT p.id, p.total_amount
    FROM public.purchases p
    LEFT JOIN public.projects pr ON pr.id = p.project_id
    WHERE p.supplier_id = p_supplier_id
      AND (v_root_domain IS NULL OR pr.project_type = v_root_domain)
    ORDER BY p.date ASC, p.created_at ASC
  LOOP
    SELECT
      COALESCE((SELECT SUM(amount) FROM public.supplier_payment_allocations WHERE purchase_id = v_purchase.id), 0) +
      COALESCE((SELECT SUM(amount) FROM public.purchase_payments WHERE purchase_id = v_purchase.id), 0)
    INTO v_paid;
    v_due := GREATEST(0, v_purchase.total_amount - v_paid);
    IF v_due > 0 AND v_remaining > 0 THEN
      v_alloc := LEAST(v_due, v_remaining);
      INSERT INTO public.supplier_payment_allocations (payment_id, purchase_id, amount)
      VALUES (v_payment_id, v_purchase.id, v_alloc);
      UPDATE public.purchases
      SET paid_amount = COALESCE(paid_amount, 0) + v_alloc,
          status = CASE WHEN COALESCE(paid_amount, 0) + v_alloc >= total_amount THEN 'paid' ELSE 'partial' END
      WHERE id = v_purchase.id;
      v_remaining := v_remaining - v_alloc;
      v_allocated := v_allocated + v_alloc;
      v_alloc_count := v_alloc_count + 1;
    END IF;
    EXIT WHEN v_remaining <= 0.001;
  END LOOP;

  -- Exactly one treasury withdrawal is posted for both invoice settlement and advances.
  INSERT INTO public.treasury_transactions (
    treasury_id, type, amount, balance_after, description, date, source,
    reference_type, reference_id, notes
  ) VALUES (
    p_treasury_id, 'withdrawal', p_amount, 0,
    'صرف دفعة للمورد على الحساب: ' || v_supplier.name,
    p_date, 'supplier_payments', 'supplier_payment', v_payment_id,
    COALESCE(p_notes, p_reference)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'supplier_name', v_supplier.name,
    'total_amount', p_amount,
    'allocated_amount', v_allocated,
    'advance_amount', GREATEST(0, p_amount - v_allocated),
    'allocations_count', v_alloc_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_supplier_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_supplier_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated;

