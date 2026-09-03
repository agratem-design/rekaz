-- Migration: 20260831160000_authoritative_on_account_payment_headers.sql
-- Description: Authoritative Payment Header + Internal Allocations architecture for Supplier & Technician On-Account Payments

-- ========================================================
-- 1. SUPPLIER PAYMENTS & ALLOCATIONS TABLES
-- ========================================================
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  treasury_id UUID NOT NULL REFERENCES public.treasuries(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'check')),
  date DATE NOT NULL,
  reference TEXT,
  notes TEXT,
  idempotency_key TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.supplier_payments(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_treasury ON public.supplier_payments(treasury_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_allocations_payment ON public.supplier_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_allocations_purchase ON public.supplier_payment_allocations(purchase_id);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable all for authenticated on supplier_payments" ON public.supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Enable all for authenticated on supplier_payment_allocations" ON public.supplier_payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========================================================
-- 2. TECHNICIAN PAYMENTS & ALLOCATIONS TABLES
-- ========================================================
CREATE TABLE IF NOT EXISTS public.technician_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE RESTRICT,
  treasury_id UUID NOT NULL REFERENCES public.treasuries(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'check')),
  date DATE NOT NULL,
  reference TEXT,
  notes TEXT,
  idempotency_key TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.technician_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.technician_payments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technician_payments_technician ON public.technician_payments(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_payments_treasury ON public.technician_payments(treasury_id);
CREATE INDEX IF NOT EXISTS idx_technician_payment_allocations_payment ON public.technician_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_technician_payment_allocations_project ON public.technician_payment_allocations(project_id);

ALTER TABLE public.technician_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_payment_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable all for authenticated on technician_payments" ON public.technician_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Enable all for authenticated on technician_payment_allocations" ON public.technician_payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop all previous signatures of both functions
DROP FUNCTION IF EXISTS public.pay_supplier_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.pay_supplier_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.pay_technician_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.pay_technician_on_account_atomic(UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT);

-- ========================================================
-- 3. ATOMIC SUPPLIER ON-ACCOUNT PAYMENT RPC
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
  v_existing_payment_id UUID;
BEGIN
  -- 1. Authorization check
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller_id
        AND role IN ('admin'::public.app_role, 'accountant'::public.app_role)
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to execute on-account payments'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Idempotency check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
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
  END IF;

  -- 3. Validate supplier
  SELECT id, name INTO v_supplier
  FROM public.suppliers
  WHERE id = p_supplier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Supplier % does not exist.', p_supplier_id;
  END IF;

  -- 4. Validate treasury & root domain
  SELECT id, name, is_active INTO v_treasury
  FROM public.treasuries
  WHERE id = p_treasury_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREASURY_NOT_FOUND: Treasury % does not exist.', p_treasury_id;
  END IF;

  IF v_treasury.is_active IS FALSE THEN
    RAISE EXCEPTION 'TREASURY_INACTIVE: Treasury % is inactive.', v_treasury.name;
  END IF;

  SELECT root_id, root_domain, is_active
  INTO v_t_root_id, v_t_root_domain, v_t_is_active
  FROM public.get_treasury_root_domain(p_treasury_id);

  IF v_t_is_active IS FALSE THEN
    RAISE EXCEPTION 'INACTIVE_TREASURY: Selected treasury % is inactive.', v_treasury.name;
  END IF;

  -- 5. Calculate domain-specific balance
  -- Domain purchases:
  SELECT COALESCE(SUM(p.total_amount), 0)
  INTO v_domain_invoices
  FROM public.purchases p
  LEFT JOIN public.projects pr ON pr.id = p.project_id
  WHERE p.supplier_id = p_supplier_id
    AND (
      v_t_root_domain IS NULL 
      OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
      OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
    );

  -- Domain payments (both direct purchase_payments and supplier_payment_allocations):
  SELECT 
    COALESCE(
      (
        SELECT SUM(spa.amount)
        FROM public.supplier_payment_allocations spa
        JOIN public.purchases p ON p.id = spa.purchase_id
        LEFT JOIN public.projects pr ON pr.id = p.project_id
        WHERE p.supplier_id = p_supplier_id
          AND (
            v_t_root_domain IS NULL 
            OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
            OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
          )
      ), 0
    ) +
    COALESCE(
      (
        SELECT SUM(pp.amount)
        FROM public.purchase_payments pp
        JOIN public.purchases p ON p.id = pp.purchase_id
        LEFT JOIN public.projects pr ON pr.id = p.project_id
        WHERE p.supplier_id = p_supplier_id
          AND (
            v_t_root_domain IS NULL 
            OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
            OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
          )
      ), 0
    )
  INTO v_domain_paid;

  v_domain_due := GREATEST(0, v_domain_invoices - v_domain_paid);

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.';
  END IF;

  IF v_domain_due <= 0 THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_DUES: لا توجد التزامات مستحقة للمورد قابلة للسداد من خزينة قطاع %.', COALESCE(v_t_root_domain, 'المحدد');
  END IF;

  IF p_amount > (v_domain_due + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: المبلغ المدخل (%) يتجاوز الرصيد المستحق في قطاع الخزينة المحدد (%).', p_amount, v_domain_due;
  END IF;

  -- 6. Insert Supplier Payment Header
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
    NULLIF(TRIM(p_idempotency_key), ''),
    v_caller_id
  )
  RETURNING id INTO v_payment_id;

  -- 7. Auto-allocate Oldest-First across domain purchases
  v_remaining_to_allocate := p_amount;

  FOR v_purchase IN
    SELECT 
      p.id,
      p.invoice_number,
      p.total_amount
    FROM public.purchases p
    LEFT JOIN public.projects pr ON pr.id = p.project_id
    WHERE p.supplier_id = p_supplier_id
      AND (
        v_t_root_domain IS NULL 
        OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
        OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
      )
    ORDER BY p.date ASC, p.created_at ASC
  LOOP
    -- Current paid for this specific purchase:
    SELECT 
      COALESCE((SELECT SUM(amount) FROM public.supplier_payment_allocations WHERE purchase_id = v_purchase.id), 0) +
      COALESCE((SELECT SUM(amount) FROM public.purchase_payments WHERE purchase_id = v_purchase.id), 0)
    INTO v_purchase_paid;

    v_purchase_due := GREATEST(0, v_purchase.total_amount - v_purchase_paid);

    IF v_purchase_due > 0 AND v_remaining_to_allocate > 0 THEN
      v_alloc_amount := LEAST(v_purchase_due, v_remaining_to_allocate);
      v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_amount;
      v_alloc_count := v_alloc_count + 1;

      -- Insert into supplier_payment_allocations
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

  -- 8. Insert EXACTLY ONE Treasury OUT for the global payment
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
-- 4. ATOMIC TECHNICIAN ON-ACCOUNT PAYMENT RPC
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
  v_existing_payment_id UUID;
BEGIN
  -- 1. Authorization check
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller_id
        AND role IN ('admin'::public.app_role, 'accountant'::public.app_role)
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Only admins and accountants are authorized to execute on-account payments'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Idempotency check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
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
  END IF;

  -- 3. Validate technician
  SELECT id, name INTO v_technician
  FROM public.technicians
  WHERE id = p_technician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TECHNICIAN_NOT_FOUND: Technician % does not exist.', p_technician_id;
  END IF;

  -- 4. Validate treasury & root domain
  SELECT id, name, is_active INTO v_treasury
  FROM public.treasuries
  WHERE id = p_treasury_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREASURY_NOT_FOUND: Treasury % does not exist.', p_treasury_id;
  END IF;

  IF v_treasury.is_active IS FALSE THEN
    RAISE EXCEPTION 'TREASURY_INACTIVE: Treasury % is inactive.', v_treasury.name;
  END IF;

  SELECT root_id, root_domain, is_active
  INTO v_t_root_id, v_t_root_domain, v_t_is_active
  FROM public.get_treasury_root_domain(p_treasury_id);

  IF v_t_is_active IS FALSE THEN
    RAISE EXCEPTION 'INACTIVE_TREASURY: Selected treasury % is inactive.', v_treasury.name;
  END IF;

  -- 5. Calculate domain-specific balance
  -- Domain earned:
  SELECT COALESCE(SUM(tpr.earned_amount), 0)
  INTO v_domain_earned
  FROM public.technician_progress_records tpr
  JOIN public.projects pr ON pr.id = tpr.project_id
  WHERE tpr.technician_id = p_technician_id
    AND (
      v_t_root_domain IS NULL 
      OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
      OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
    );

  -- Domain paid (both legacy expenses and technician_payment_allocations):
  SELECT 
    COALESCE(
      (
        SELECT SUM(tpa.amount)
        FROM public.technician_payment_allocations tpa
        JOIN public.technician_payments tp ON tp.id = tpa.payment_id
        LEFT JOIN public.projects pr ON pr.id = tpa.project_id
        WHERE tp.technician_id = p_technician_id
          AND (
            v_t_root_domain IS NULL 
            OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
            OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
          )
      ), 0
    ) +
    COALESCE(
      (
        SELECT SUM(e.amount)
        FROM public.expenses e
        LEFT JOIN public.projects pr ON pr.id = e.project_id
        WHERE e.technician_id = p_technician_id
          AND e.type = 'labor'
          AND (
            v_t_root_domain IS NULL 
            OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
            OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
          )
      ), 0
    )
  INTO v_domain_paid;

  v_domain_due := GREATEST(0, v_domain_earned - v_domain_paid);

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.';
  END IF;

  IF v_domain_due <= 0 THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_DUES: لا توجد مستحقات أعمال معتمدة للفني قابلة للصرف من خزينة قطاع %.', COALESCE(v_t_root_domain, 'المحدد');
  END IF;

  IF p_amount > (v_domain_due + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: المبلغ المدخل (%) يتجاوز الرصيد المستحق للفني في قطاع الخزينة المحدد (%).', p_amount, v_domain_due;
  END IF;

  -- 6. Insert Technician Payment Header
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
    NULLIF(TRIM(p_idempotency_key), ''),
    v_caller_id
  )
  RETURNING id INTO v_payment_id;

  -- 7. Auto-allocate Oldest-First across projects with unpaid progress
  v_remaining_to_allocate := p_amount;

  FOR v_proj_row IN
    SELECT 
      pr.id AS project_id,
      pr.name AS project_name,
      SUM(tpr.earned_amount) AS total_earned_on_project
    FROM public.technician_progress_records tpr
    JOIN public.projects pr ON pr.id = tpr.project_id
    WHERE tpr.technician_id = p_technician_id
      AND (
        v_t_root_domain IS NULL 
        OR (v_t_root_domain = 'contracting' AND pr.project_type = 'contracting')
        OR (v_t_root_domain = 'finishing' AND pr.project_type = 'finishing')
      )
    GROUP BY pr.id, pr.name
    ORDER BY MIN(tpr.date) ASC, MIN(tpr.created_at) ASC
  LOOP
    -- Current paid on this project for this technician:
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

  -- If some amount remains unallocated to a specific project (e.g. general advance):
  IF v_remaining_to_allocate > 0 THEN
    INSERT INTO public.technician_payment_allocations (
      payment_id,
      project_id,
      amount
    ) VALUES (
      v_payment_id,
      NULL,
      v_remaining_to_allocate
    );
  END IF;

  -- 8. Insert EXACTLY ONE Treasury OUT for the global payment
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.pay_supplier_on_account_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_technician_on_account_atomic TO authenticated;
