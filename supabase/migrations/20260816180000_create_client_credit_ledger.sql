-- ============================================================================
-- Migration: 20260816180000_create_client_credit_ledger.sql
-- Description: FC-02 Production Client Credit Ledger, Immutable Trigger & Hardened RPCs
-- ============================================================================

-- 1. Drop old automatic allocation trigger
DROP TRIGGER IF EXISTS trg_auto_allocate_client_payment ON public.client_payments;

-- 2. Create client_credit_ledger table (Immutable / Event-Based Ledger)
CREATE TABLE IF NOT EXISTS public.client_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (
    entry_type IN (
      'CREDIT_CREATED',
      'CREDIT_APPLIED',
      'CREDIT_APPLICATION_REVERSED',
      'CREDIT_CREATION_REVERSED'
    )
  ),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  source_payment_id UUID REFERENCES public.client_payments(id) ON DELETE RESTRICT,
  target_project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  reference_entry_id UUID REFERENCES public.client_credit_ledger(id) ON DELETE RESTRICT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_credit_ledger_entry_context CHECK (
    (entry_type = 'CREDIT_CREATED' AND source_payment_id IS NOT NULL) OR
    (entry_type = 'CREDIT_APPLIED' AND target_project_id IS NOT NULL) OR
    (entry_type = 'CREDIT_APPLICATION_REVERSED' AND reference_entry_id IS NOT NULL) OR
    (entry_type = 'CREDIT_CREATION_REVERSED' AND reference_entry_id IS NOT NULL)
  )
);

-- 3. Performance & Audit Indexes
CREATE INDEX IF NOT EXISTS idx_client_credit_ledger_client_id ON public.client_credit_ledger(client_id);
CREATE INDEX IF NOT EXISTS idx_client_credit_ledger_target_project ON public.client_credit_ledger(target_project_id);
CREATE INDEX IF NOT EXISTS idx_client_credit_ledger_source_payment ON public.client_credit_ledger(source_payment_id);
CREATE INDEX IF NOT EXISTS idx_client_credit_ledger_reference_entry ON public.client_credit_ledger(reference_entry_id);
CREATE INDEX IF NOT EXISTS idx_client_credit_ledger_entry_type ON public.client_credit_ledger(entry_type);

-- 4. Immutable Ledger Trigger (Blocks Direct UPDATE & DELETE)
CREATE OR REPLACE FUNCTION public.prevent_direct_credit_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'جدول دفتر الأرصدة الدائنة (client_credit_ledger) غير قابل للتعديل (Immutable). لا يمكن تعديل السجلات مباشرة.';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'جدول دفتر الأرصدة الدائنة (client_credit_ledger) غير قابل للحذف (Immutable). لا يمكن حذف السجلات مباشرة.';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_credit_ledger_immutable ON public.client_credit_ledger;
CREATE TRIGGER trg_client_credit_ledger_immutable
BEFORE UPDATE OR DELETE ON public.client_credit_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_credit_ledger_mutation();

-- 5. Row Level Security (RLS)
ALTER TABLE public.client_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view client_credit_ledger" ON public.client_credit_ledger;
CREATE POLICY "Authenticated users can view client_credit_ledger"
  ON public.client_credit_ledger FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Direct insert blocked for clients" ON public.client_credit_ledger;
CREATE POLICY "Direct insert blocked for clients"
  ON public.client_credit_ledger FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'accountant')
  );

-- 6. Helper: Raw Live Available Credit (No Greatest(0, x) Masking!)
CREATE OR REPLACE FUNCTION public.get_client_available_credit(p_client_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit NUMERIC := 0;
BEGIN
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN entry_type IN ('CREDIT_CREATED', 'CREDIT_APPLICATION_REVERSED') THEN amount
        WHEN entry_type IN ('CREDIT_APPLIED', 'CREDIT_CREATION_REVERSED') THEN -amount
        ELSE 0
      END
    ), 0
  )
  INTO v_credit
  FROM public.client_credit_ledger
  WHERE client_id = p_client_id;

  RETURN v_credit;
END;
$$;

-- 7. Authoritative Server-Side Function: Get Project Authoritative Remaining
CREATE OR REPLACE FUNCTION public.get_project_authoritative_remaining(p_project_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proj RECORD;
  v_mat NUMERIC := 0;
  v_serv NUMERIC := 0;
  v_rent NUMERIC := 0;
  v_labor NUMERIC := 0;
  v_exp NUMERIC := 0;
  v_base NUMERIC := 0;
  v_fee NUMERIC := 0;
  v_obligation NUMERIC := 0;
  v_cash_paid NUMERIC := 0;
  v_credit_applied NUMERIC := 0;
  v_cash_applicable NUMERIC := 0;
  v_total_settled NUMERIC := 0;
BEGIN
  SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
  IF v_proj.id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_proj.project_type = 'finishing' THEN
    SELECT COALESCE(SUM(total_amount), 0) INTO v_mat 
    FROM public.purchases 
    WHERE project_id = p_project_id 
      AND (purchase_type = 'material' OR purchase_type IS NULL) 
      AND rental_id IS NULL AND technician_id IS NULL 
      AND purchase_type != 'service' AND purchase_type != 'labor';

    SELECT COALESCE(SUM(total_amount), 0) INTO v_serv 
    FROM public.purchases 
    WHERE project_id = p_project_id 
      AND purchase_type = 'service' 
      AND rental_id IS NULL AND technician_id IS NULL;

    SELECT COALESCE(SUM(total_amount), 0) INTO v_rent 
    FROM public.purchases 
    WHERE project_id = p_project_id 
      AND (purchase_type = 'rental' OR rental_id IS NOT NULL);

    SELECT COALESCE(SUM(earned_amount), 0) INTO v_labor 
    FROM public.technician_progress_records 
    WHERE project_id = p_project_id;

    IF v_labor = 0 THEN
      SELECT COALESCE(SUM(total_amount), 0) INTO v_labor 
      FROM public.purchases 
      WHERE project_id = p_project_id 
        AND (purchase_type = 'labor' OR technician_id IS NOT NULL) 
        AND rental_id IS NULL;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_exp 
    FROM public.expenses 
    WHERE project_id = p_project_id;

    v_base := v_mat + v_serv + v_rent + v_labor + v_exp;
    v_fee := v_base * (COALESCE(v_proj.finishing_percentage, 0) / 100.0);
    v_obligation := v_base + v_fee;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_obligation 
    FROM public.contracts 
    WHERE project_id = p_project_id AND (status != 'cancelled' OR status IS NULL);

    IF v_obligation = 0 THEN
      SELECT COALESCE(SUM(total_price), 0) INTO v_obligation 
      FROM public.project_items 
      WHERE project_id = p_project_id;
    END IF;

    IF v_obligation = 0 THEN
      v_obligation := COALESCE(v_proj.budget, 0);
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_cash_paid 
  FROM public.client_payments 
  WHERE project_id = p_project_id;

  SELECT COALESCE(
    SUM(
      CASE 
        WHEN entry_type = 'CREDIT_APPLIED' THEN amount
        WHEN entry_type = 'CREDIT_APPLICATION_REVERSED' THEN -amount
        ELSE 0
      END
    ), 0
  ) INTO v_credit_applied
  FROM public.client_credit_ledger 
  WHERE target_project_id = p_project_id;

  v_cash_applicable := LEAST(v_cash_paid, v_obligation);
  v_total_settled := v_cash_applicable + v_credit_applied;

  RETURN GREATEST(0, v_obligation - v_total_settled);
END;
$$;

-- 8. Authoritative Atomic RPC: Record Client Payment & Derive Credit Server-Side
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
  v_proj RECORD;
  v_payment_id UUID;
  v_remaining_before NUMERIC := 0;
  v_excess NUMERIC := 0;
  v_credit_ledger_id UUID := NULL;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'قيمة الدفعة المقبوضة يجب أن تكون أكبر من الصفر.';
  END IF;

  -- Lock in deterministic order: Client -> Project -> Treasury
  PERFORM id FROM public.clients WHERE id = p_client_id FOR UPDATE;
  
  SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF v_proj.id IS NULL THEN
    RAISE EXCEPTION 'المشروع المحدد غير موجود.';
  END IF;

  -- Server-Side Check: Same Client Rule
  IF v_proj.client_id != p_client_id THEN
    RAISE EXCEPTION 'حظر أمان: لا يمكن تسجيل دفعة لمشروع لا يتبع نفس العميل المذكور.';
  END IF;

  PERFORM id FROM public.treasuries WHERE id = p_treasury_id FOR UPDATE;

  -- Derive Project Remaining Authoritatively
  v_remaining_before := public.get_project_authoritative_remaining(p_project_id);

  -- Insert payment (Triggers automatic treasury transaction & balance update)
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
    p_payment_method,
    p_date,
    p_notes
  ) RETURNING id INTO v_payment_id;

  -- Persist Credit Created if excess
  IF p_amount > v_remaining_before THEN
    v_excess := p_amount - v_remaining_before;
    
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
      'توليد رصيد دائن نتيجة فائض سداد عن مستحق المشروع',
      auth.uid()
    ) RETURNING id INTO v_credit_ledger_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'cash_applied_to_project', LEAST(p_amount, v_remaining_before),
    'credit_created', v_excess,
    'credit_ledger_id', v_credit_ledger_id
  );
END;
$$;

-- 9. Authoritative RPC: Apply Client Credit (Enforcing Available Credit & Project Remaining)
CREATE OR REPLACE FUNCTION public.apply_client_credit(
  p_client_id UUID,
  p_target_project_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proj RECORD;
  v_available_credit NUMERIC := 0;
  v_target_remaining NUMERIC := 0;
  v_new_entry_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'قيمة الرصيد المطلوب تطبيقها يجب أن تكون أكبر من الصفر.';
  END IF;

  -- Lock in deterministic order: Client -> Project
  PERFORM id FROM public.clients WHERE id = p_client_id FOR UPDATE;
  
  SELECT * INTO v_proj FROM public.projects WHERE id = p_target_project_id FOR UPDATE;
  IF v_proj.id IS NULL THEN
    RAISE EXCEPTION 'المشروع المستهدف غير موجود.';
  END IF;

  -- Server-Side Check 1: Same Client Only
  IF v_proj.client_id != p_client_id THEN
    RAISE EXCEPTION 'حظر تطبيقي: لا يمكن استخدام رصيد العميل لصالح مشروع يتبع عميلاً آخر.';
  END IF;

  -- Server-Side Check 2: Live Available Credit
  v_available_credit := public.get_client_available_credit(p_client_id);
  IF p_amount > v_available_credit THEN
    RAISE EXCEPTION 'رصيد العميل المتاح (% د.ل) لا يكفي لتطبيق المبلغ المطلوب (% د.ل).', v_available_credit, p_amount;
  END IF;

  -- Server-Side Check 3: Target Project Authoritative Remaining
  v_target_remaining := public.get_project_authoritative_remaining(p_target_project_id);
  IF p_amount > v_target_remaining THEN
    RAISE EXCEPTION 'حظر أمان: المبلغ المطلوب (% د.ل) يتجاوز المستحق المتبقي على المشروع المستهدف (% د.ل).', p_amount, v_target_remaining;
  END IF;

  -- Insert Credit Application Event (ZERO Treasury Movement)
  INSERT INTO public.client_credit_ledger (
    client_id,
    entry_type,
    amount,
    target_project_id,
    notes,
    created_by
  ) VALUES (
    p_client_id,
    'CREDIT_APPLIED',
    p_amount,
    p_target_project_id,
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_new_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_new_entry_id,
    'applied_amount', p_amount,
    'new_available_credit', v_available_credit - p_amount
  );
END;
$$;

-- 10. Authoritative RPC: Reverse Credit Application
CREATE OR REPLACE FUNCTION public.reverse_client_credit_application(
  p_entry_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig_entry RECORD;
  v_reversal_id UUID;
BEGIN
  SELECT * INTO v_orig_entry 
  FROM public.client_credit_ledger 
  WHERE id = p_entry_id 
  FOR UPDATE;

  IF v_orig_entry.id IS NULL THEN
    RAISE EXCEPTION 'سجل تطبيق الرصيد غير موجود.';
  END IF;

  IF v_orig_entry.entry_type != 'CREDIT_APPLIED' THEN
    RAISE EXCEPTION 'يمكن فقط عكس سجلات تطبيق الرصيد (CREDIT_APPLIED).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.client_credit_ledger 
    WHERE reference_entry_id = p_entry_id AND entry_type = 'CREDIT_APPLICATION_REVERSED'
  ) THEN
    RAISE EXCEPTION 'تم عكس هذا السجل مسبقاً.';
  END IF;

  PERFORM id FROM public.clients WHERE id = v_orig_entry.client_id FOR UPDATE;

  INSERT INTO public.client_credit_ledger (
    client_id,
    entry_type,
    amount,
    target_project_id,
    reference_entry_id,
    notes,
    created_by
  ) VALUES (
    v_orig_entry.client_id,
    'CREDIT_APPLICATION_REVERSED',
    v_orig_entry.amount,
    v_orig_entry.target_project_id,
    p_entry_id,
    COALESCE(p_notes, 'عكس تطبيق رصيد دائن'),
    auth.uid()
  ) RETURNING id INTO v_reversal_id;

  RETURN jsonb_build_object(
    'success', true,
    'reversal_entry_id', v_reversal_id,
    'restored_amount', v_orig_entry.amount
  );
END;
$$;

-- 11. Authoritative RPC: Safe Reversal of Client Cash Payment
CREATE OR REPLACE FUNCTION public.reverse_client_payment_atomic(
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_credit_created_entry RECORD;
  v_available_credit NUMERIC;
  v_consumed NUMERIC;
BEGIN
  SELECT * INTO v_payment 
  FROM public.client_payments 
  WHERE id = p_payment_id 
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'سند القبض غير موجود.';
  END IF;

  SELECT * INTO v_credit_created_entry
  FROM public.client_credit_ledger
  WHERE source_payment_id = p_payment_id AND entry_type = 'CREDIT_CREATED';

  IF v_credit_created_entry.id IS NOT NULL THEN
    PERFORM id FROM public.clients WHERE id = v_payment.client_id FOR UPDATE;
    
    v_available_credit := public.get_client_available_credit(v_payment.client_id);

    IF v_available_credit < v_credit_created_entry.amount THEN
      v_consumed := v_credit_created_entry.amount - v_available_credit;
      RAISE EXCEPTION 'حظر أمان: لا يمكن حذف أو عكس سند القبض لأن رصيداً بقيمة (% د.ل) تم استخدامه مسبقاً في تسديد مشاريع أخرى. يجب إلغاء استخدام الرصيد في تلك المشاريع أولاً.', v_consumed;
    END IF;

    INSERT INTO public.client_credit_ledger (
      client_id,
      entry_type,
      amount,
      source_payment_id,
      reference_entry_id,
      notes,
      created_by
    ) VALUES (
      v_payment.client_id,
      'CREDIT_CREATION_REVERSED',
      v_credit_created_entry.amount,
      p_payment_id,
      v_credit_created_entry.id,
      'عكس توليد الرصيد الدائن نتيجة إلغاء سند القبض',
      auth.uid()
    );
  END IF;

  DELETE FROM public.client_payments WHERE id = p_payment_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 12. Security Definer Grants
REVOKE EXECUTE ON FUNCTION public.get_client_available_credit(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_project_authoritative_remaining(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_client_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_client_credit(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_client_credit_application(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_client_payment_atomic(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_client_available_credit(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_project_authoritative_remaining(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_client_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_client_credit(UUID, UUID, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_client_credit_application(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_client_payment_atomic(UUID) TO authenticated, service_role;
