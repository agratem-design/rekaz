-- Migration: 20260831180000_harden_payment_headers_integrity.sql
-- Description: Hardens database integrity, RLS policies, immutability triggers, fail-closed auth/domain, and allocation invariants for Supplier and Technician On-Account Payments

-- ========================================================
-- 1. HARDEN RLS POLICIES FOR ALLOCATIONS (PREVENT DIRECT CLIENT MUTATIONS)
-- ========================================================

-- Drop permissive policies on allocations
DROP POLICY IF EXISTS "Enable all for authenticated on supplier_payment_allocations" ON public.supplier_payment_allocations;
DROP POLICY IF EXISTS "Enable all for authenticated on technician_payment_allocations" ON public.technician_payment_allocations;
DROP POLICY IF EXISTS "Allow read for authenticated on supplier_payment_allocations" ON public.supplier_payment_allocations;
DROP POLICY IF EXISTS "Allow read for authenticated on technician_payment_allocations" ON public.technician_payment_allocations;

-- Allocations: Read-only for authenticated, direct writes restricted to SECURITY DEFINER functions
CREATE POLICY "Allow read for authenticated on supplier_payment_allocations" 
  ON public.supplier_payment_allocations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated on technician_payment_allocations" 
  ON public.technician_payment_allocations FOR SELECT TO authenticated USING (true);

-- Drop permissive policies on payment headers
DROP POLICY IF EXISTS "Enable all for authenticated on supplier_payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Enable all for authenticated on technician_payments" ON public.technician_payments;
DROP POLICY IF EXISTS "Allow read for authenticated on supplier_payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Allow read for authenticated on technician_payments" ON public.technician_payments;

-- Headers: Read-only for authenticated, direct writes restricted to SECURITY DEFINER functions
CREATE POLICY "Allow read for authenticated on supplier_payments" 
  ON public.supplier_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated on technician_payments" 
  ON public.technician_payments FOR SELECT TO authenticated USING (true);

-- ========================================================
-- 2. PREVENT DIRECT DELETE OR FINANCIAL MUTATION OF HEADERS
-- ========================================================

CREATE OR REPLACE FUNCTION public.trg_prevent_payment_header_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.amount <> NEW.amount OR OLD.treasury_id <> NEW.treasury_id OR 
       OLD.idempotency_key <> NEW.idempotency_key OR
       (TG_TABLE_NAME = 'supplier_payments' AND OLD.supplier_id <> NEW.supplier_id) OR
       (TG_TABLE_NAME = 'technician_payments' AND OLD.technician_id <> NEW.technician_id) THEN
      RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_RECORD: Financial attributes (amount, party, treasury, idempotency_key) cannot be modified after posting.'
        USING ERRCODE = '55000';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DIRECT_DELETE_FORBIDDEN: Payment headers cannot be directly deleted. Use atomic reversal workflow.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_supplier_payments ON public.supplier_payments;
CREATE TRIGGER trg_protect_supplier_payments
  BEFORE UPDATE OR DELETE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_payment_header_mutation();

DROP TRIGGER IF EXISTS trg_protect_technician_payments ON public.technician_payments;
CREATE TRIGGER trg_protect_technician_payments
  BEFORE UPDATE OR DELETE ON public.technician_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_payment_header_mutation();

-- ========================================================
-- 3. HARDENED SUPPLIER ON-ACCOUNT PAYMENT RPC
-- ========================================================

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
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
  v_supplier RECORD;
  v_treasury RECORD;
  v_t_root_id UUID;
  v_t_root_domain TEXT;
  v_t_is_active BOOLEAN;
  v_domain_invoices NUMERIC := 0;
  v_domain_paid NUMERIC := 0;
  v_domain_due NUMERIC := 0;
  v_payment_id UUID;
  v_remaining_to_allocate NUMERIC;
  v_purchase RECORD;
  v_purchase_paid NUMERIC;
  v_purchase_due NUMERIC;
  v_alloc_amount NUMERIC;
  v_alloc_count INT := 0;
  v_alloc_summary JSONB := '[]'::JSONB;
  v_total_allocated NUMERIC := 0;
  v_existing_payment_id UUID;
BEGIN
  -- 1. Fail-Closed Authentication & Authorization Check
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
    RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to execute on-account payments'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Mandatory Idempotency Check
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: An idempotency key is mandatory for financial payments'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existing_payment_id
  FROM public.supplier_payments
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

  -- 4. Validate Supplier
  SELECT id, name INTO v_supplier
  FROM public.suppliers
  WHERE id = p_supplier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Supplier % does not exist.', p_supplier_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Validate Treasury & Fail-Closed Root Domain
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

  SELECT root_id, root_domain, is_active
  INTO v_t_root_id, v_t_root_domain, v_t_is_active
  FROM public.get_treasury_root_domain(p_treasury_id);

  IF v_t_is_active IS FALSE THEN
    RAISE EXCEPTION 'INACTIVE_TREASURY: Selected treasury % is inactive.', v_treasury.name
      USING ERRCODE = 'P0001';
  END IF;

  IF v_t_root_domain IS NULL OR v_t_root_domain NOT IN ('contracting', 'finishing') THEN
    RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Treasury domain must be contracting or finishing.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Calculate Strict Domain-Specific Balance
  SELECT COALESCE(SUM(p.total_amount), 0)
  INTO v_domain_invoices
  FROM public.purchases p
  JOIN public.projects pr ON pr.id = p.project_id
  WHERE p.supplier_id = p_supplier_id
    AND pr.project_type = v_t_root_domain;

  SELECT 
    COALESCE(
      (
        SELECT SUM(spa.amount)
        FROM public.supplier_payment_allocations spa
        JOIN public.purchases p ON p.id = spa.purchase_id
        JOIN public.projects pr ON pr.id = p.project_id
        WHERE p.supplier_id = p_supplier_id
          AND pr.project_type = v_t_root_domain
      ), 0
    ) +
    COALESCE(
      (
        SELECT SUM(pp.amount)
        FROM public.purchase_payments pp
        JOIN public.purchases p ON p.id = pp.purchase_id
        JOIN public.projects pr ON pr.id = p.project_id
        WHERE p.supplier_id = p_supplier_id
          AND pr.project_type = v_t_root_domain
      ), 0
    )
  INTO v_domain_paid;

  v_domain_due := GREATEST(0, v_domain_invoices - v_domain_paid);

  IF v_domain_due <= 0 THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_DUES: لا توجد التزامات مستحقة للمورد قابلة للسداد من خزينة قطاع %.', v_t_root_domain
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount > (v_domain_due + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: المبلغ المدخل (%) يتجاوز الرصيد المستحق في قطاع الخزينة المحدد (%).', p_amount, v_domain_due
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Insert Supplier Payment Header
  INSERT INTO public.supplier_payments (
    supplier_id,
    treasury_id,
    amount,
    payment_method,
    date,
    reference,
    notes,
    idempotency_key,
    created_by
  ) VALUES (
    p_supplier_id,
    p_treasury_id,
    p_amount,
    p_payment_method,
    p_date,
    p_reference,
    p_notes,
    TRIM(p_idempotency_key),
    v_caller_id
  )
  RETURNING id INTO v_payment_id;

  -- 8. Auto-allocate Oldest-First Across Domain Purchases
  v_remaining_to_allocate := p_amount;

  FOR v_purchase IN
    SELECT 
      p.id,
      p.invoice_number,
      p.total_amount
    FROM public.purchases p
    JOIN public.projects pr ON pr.id = p.project_id
    WHERE p.supplier_id = p_supplier_id
      AND pr.project_type = v_t_root_domain
    ORDER BY p.date ASC, p.created_at ASC
  LOOP
    -- Current paid for this specific purchase (legacy direct payments + allocations):
    SELECT 
      COALESCE((SELECT SUM(amount) FROM public.supplier_payment_allocations WHERE purchase_id = v_purchase.id), 0) +
      COALESCE((SELECT SUM(amount) FROM public.purchase_payments WHERE purchase_id = v_purchase.id), 0)
    INTO v_purchase_paid;

    v_purchase_due := GREATEST(0, v_purchase.total_amount - v_purchase_paid);

    IF v_purchase_due > 0 AND v_remaining_to_allocate > 0 THEN
      v_alloc_amount := LEAST(v_purchase_due, v_remaining_to_allocate);
      v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_amount;
      v_total_allocated := v_total_allocated + v_alloc_amount;
      v_alloc_count := v_alloc_count + 1;

      -- Insert allocation
      INSERT INTO public.supplier_payment_allocations (
        payment_id,
        purchase_id,
        amount
      ) VALUES (
        v_payment_id,
        v_purchase.id,
        v_alloc_amount
      );

      -- Update purchase paid_amount & status
      UPDATE public.purchases
      SET 
        paid_amount = v_purchase_paid + v_alloc_amount,
        status = CASE 
          WHEN (v_purchase_paid + v_alloc_amount) >= v_purchase.total_amount THEN 'paid'
          ELSE 'partial'
        END
      WHERE id = v_purchase.id;

      v_alloc_summary := v_alloc_summary || jsonb_build_object(
        'purchase_id', v_purchase.id,
        'invoice_number', v_purchase.invoice_number,
        'allocated_amount', v_alloc_amount
      );
    END IF;

    EXIT WHEN v_remaining_to_allocate <= 0;
  END LOOP;

  -- 9. Enforce Strict Allocation Equality: SUM(allocations) == Header amount
  IF v_remaining_to_allocate > 0.001 OR v_total_allocated < (p_amount - 0.001) THEN
    RAISE EXCEPTION 'ALLOCATION_MISMATCH: Failed to fully allocate payment across eligible invoices (Remaining: %). Entire transaction rolled back.', v_remaining_to_allocate
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Insert EXACTLY ONE Treasury OUT for the global payment
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
    'سداد دفعة على الحساب للمورد: ' || v_supplier.name,
    p_date,
    'supplier_payments',
    'supplier_payment',
    v_payment_id,
    COALESCE(p_notes, p_reference)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'supplier_name', v_supplier.name,
    'total_amount', p_amount,
    'date', p_date,
    'treasury_name', v_treasury.name,
    'payment_method', p_payment_method,
    'allocations_count', v_alloc_count,
    'allocations', v_alloc_summary
  );
END;
$$;

-- ========================================================
-- 4. HARDENED TECHNICIAN ON-ACCOUNT PAYMENT RPC
-- ========================================================

CREATE OR REPLACE FUNCTION public.pay_technician_on_account_atomic(
  p_technician_id UUID,
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
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
  v_technician RECORD;
  v_treasury RECORD;
  v_t_root_id UUID;
  v_t_root_domain TEXT;
  v_t_is_active BOOLEAN;
  v_domain_earned NUMERIC := 0;
  v_domain_paid NUMERIC := 0;
  v_domain_due NUMERIC := 0;
  v_payment_id UUID;
  v_remaining_to_allocate NUMERIC;
  v_proj_row RECORD;
  v_proj_paid NUMERIC;
  v_proj_due NUMERIC;
  v_alloc_amount NUMERIC;
  v_alloc_count INT := 0;
  v_alloc_summary JSONB := '[]'::JSONB;
  v_total_allocated NUMERIC := 0;
  v_existing_payment_id UUID;
BEGIN
  -- 1. Fail-Closed Authentication & Authorization Check
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
    RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to execute on-account payments'
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

  -- 5. Validate Treasury & Fail-Closed Root Domain
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

  SELECT root_id, root_domain, is_active
  INTO v_t_root_id, v_t_root_domain, v_t_is_active
  FROM public.get_treasury_root_domain(p_treasury_id);

  IF v_t_is_active IS FALSE THEN
    RAISE EXCEPTION 'INACTIVE_TREASURY: Selected treasury % is inactive.', v_treasury.name
      USING ERRCODE = 'P0001';
  END IF;

  IF v_t_root_domain IS NULL OR v_t_root_domain NOT IN ('contracting', 'finishing') THEN
    RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Treasury domain must be contracting or finishing.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Calculate Strict Domain-Specific Balance
  SELECT COALESCE(SUM(tpr.earned_amount), 0)
  INTO v_domain_earned
  FROM public.technician_progress_records tpr
  JOIN public.projects pr ON pr.id = tpr.project_id
  WHERE tpr.technician_id = p_technician_id
    AND pr.project_type = v_t_root_domain;

  SELECT 
    COALESCE(
      (
        SELECT SUM(tpa.amount)
        FROM public.technician_payment_allocations tpa
        JOIN public.technician_payments tp ON tp.id = tpa.payment_id
        JOIN public.projects pr ON pr.id = tpa.project_id
        WHERE tp.technician_id = p_technician_id
          AND pr.project_type = v_t_root_domain
      ), 0
    ) +
    COALESCE(
      (
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.projects pr ON pr.id = e.project_id
        WHERE e.technician_id = p_technician_id
          AND e.type = 'labor'
          AND pr.project_type = v_t_root_domain
      ), 0
    )
  INTO v_domain_paid;

  v_domain_due := GREATEST(0, v_domain_earned - v_domain_paid);

  IF v_domain_due <= 0 THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_DUES: لا توجد مستحقات أعمال معتمدة للفني قابلة للصرف من خزينة قطاع %.', v_t_root_domain
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount > (v_domain_due + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: المبلغ المدخل (%) يتجاوز الرصيد المستحق للفني في قطاع الخزينة المحدد (%).', p_amount, v_domain_due
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Insert Technician Payment Header
  INSERT INTO public.technician_payments (
    technician_id,
    treasury_id,
    amount,
    payment_method,
    date,
    reference,
    notes,
    idempotency_key,
    created_by
  ) VALUES (
    p_technician_id,
    p_treasury_id,
    p_amount,
    p_payment_method,
    p_date,
    p_reference,
    p_notes,
    TRIM(p_idempotency_key),
    v_caller_id
  )
  RETURNING id INTO v_payment_id;

  -- 8. Auto-allocate Oldest-First Across Projects with Unpaid Progress
  v_remaining_to_allocate := p_amount;

  FOR v_proj_row IN
    SELECT 
      pr.id AS project_id,
      pr.name AS project_name,
      SUM(tpr.earned_amount) AS total_earned_on_project
    FROM public.technician_progress_records tpr
    JOIN public.projects pr ON pr.id = tpr.project_id
    WHERE tpr.technician_id = p_technician_id
      AND pr.project_type = v_t_root_domain
    GROUP BY pr.id, pr.name
    ORDER BY MIN(tpr.date) ASC, MIN(tpr.created_at) ASC
  LOOP
    -- Current paid on this project for this technician (legacy labor expenses + allocations):
    SELECT 
      COALESCE(
        (
          SELECT SUM(tpa.amount)
          FROM public.technician_payment_allocations tpa
          JOIN public.technician_payments tp ON tp.id = tpa.payment_id
          WHERE tp.technician_id = p_technician_id AND tpa.project_id = v_proj_row.project_id
        ), 0
      ) +
      COALESCE(
        (
          SELECT SUM(e.amount)
          FROM public.expenses e
          WHERE e.technician_id = p_technician_id AND e.type = 'labor' AND e.project_id = v_proj_row.project_id
        ), 0
      )
    INTO v_proj_paid;

    v_proj_due := GREATEST(0, v_proj_row.total_earned_on_project - v_proj_paid);

    IF v_proj_due > 0 AND v_remaining_to_allocate > 0 THEN
      v_alloc_amount := LEAST(v_proj_due, v_remaining_to_allocate);
      v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_amount;
      v_total_allocated := v_total_allocated + v_alloc_amount;
      v_alloc_count := v_alloc_count + 1;

      -- Insert allocation
      INSERT INTO public.technician_payment_allocations (
        payment_id,
        project_id,
        amount
      ) VALUES (
        v_payment_id,
        v_proj_row.project_id,
        v_alloc_amount
      );

      v_alloc_summary := v_alloc_summary || jsonb_build_object(
        'project_id', v_proj_row.project_id,
        'project_name', v_proj_row.project_name,
        'allocated_amount', v_alloc_amount
      );
    END IF;

    EXIT WHEN v_remaining_to_allocate <= 0;
  END LOOP;

  -- 9. Enforce Strict Allocation Equality: SUM(allocations) == Header amount
  IF v_remaining_to_allocate > 0.001 OR v_total_allocated < (p_amount - 0.001) THEN
    RAISE EXCEPTION 'ALLOCATION_MISMATCH: Failed to fully allocate payment across eligible projects (Remaining: %). Entire transaction rolled back.', v_remaining_to_allocate
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Insert EXACTLY ONE Treasury OUT for the global payment
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
    'allocations_count', v_alloc_count,
    'allocations', v_alloc_summary
  );
END;
$$;

-- ========================================================
-- 5. REVOKE PERMISSIONS FROM PUBLIC/ANON, GRANT TO AUTHENTICATED ONLY
-- ========================================================

REVOKE EXECUTE ON FUNCTION public.pay_supplier_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_supplier_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pay_technician_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_technician_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated;
