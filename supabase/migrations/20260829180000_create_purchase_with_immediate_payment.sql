-- Migration: Atomic Purchase with Immediate Payment RPC and Opening Balance Trigger
-- Date: 2026-08-29

-- 1. Hardened create_purchase_with_immediate_payment RPC with active treasury check, amount validation, and idempotency
CREATE OR REPLACE FUNCTION public.create_purchase_with_immediate_payment(
  p_purchase jsonb,
  p_payment jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase_id uuid;
  v_payment_id uuid := NULL;
  v_total_amount numeric;
  v_paid_amount numeric;
  v_invoice_number text;
  v_title text;
  v_notes text;
  v_purchase_type text;
  v_project_id uuid;
  v_phase_id uuid;
  v_project_item_id uuid;
  v_supplier_id uuid;
  v_treasury_id uuid;
  v_treasury_active boolean;
  v_date date;
  v_items jsonb;
  v_idempotency_key text;
BEGIN
  -- Parse fields safely
  v_project_id := CASE WHEN (p_purchase->>'project_id') IS NOT NULL AND (p_purchase->>'project_id') <> '' THEN (p_purchase->>'project_id')::uuid ELSE NULL END;
  v_phase_id := CASE WHEN (p_purchase->>'phase_id') IS NOT NULL AND (p_purchase->>'phase_id') <> '' THEN (p_purchase->>'phase_id')::uuid ELSE NULL END;
  v_project_item_id := CASE WHEN (p_purchase->>'project_item_id') IS NOT NULL AND (p_purchase->>'project_item_id') <> '' AND (p_purchase->>'project_item_id') <> 'none' AND (p_purchase->>'project_item_id') <> '__none__' THEN (p_purchase->>'project_item_id')::uuid ELSE NULL END;
  v_supplier_id := (p_purchase->>'supplier_id')::uuid;
  v_date := (p_purchase->>'date')::date;
  v_invoice_number := NULLIF(TRIM(p_purchase->>'invoice_number'), '');
  v_purchase_type := COALESCE(NULLIF(TRIM(p_purchase->>'purchase_type'), ''), 'material');
  v_title := NULLIF(TRIM(p_purchase->>'title'), '');
  v_notes := NULLIF(TRIM(p_purchase->>'notes'), '');
  v_items := p_purchase->'items';
  v_total_amount := (p_purchase->>'total_amount')::numeric;

  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'المورد مطلوب لإتمام عملية الشراء';
  END IF;

  IF v_total_amount <= 0 THEN
    RAISE EXCEPTION 'إجمالي الفاتورة يجب أن يكون أكبر من صفر';
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

  -- 2. If immediate payment provided and amount > 0, insert Purchase Payment atomically
  IF p_payment IS NOT NULL AND (p_payment->>'amount') IS NOT NULL AND ((p_payment->>'amount')::numeric > 0) THEN
    v_paid_amount := (p_payment->>'amount')::numeric;
    v_treasury_id := (p_payment->>'treasury_id')::uuid;
    v_idempotency_key := NULLIF(TRIM(p_payment->>'idempotency_key'), '');

    IF v_treasury_id IS NULL THEN
      RAISE EXCEPTION 'يرجى تحديد الخزينة للسداد الفوري';
    END IF;

    -- Validate treasury is active
    SELECT is_active INTO v_treasury_active FROM public.treasuries WHERE id = v_treasury_id;
    IF v_treasury_active IS NULL OR v_treasury_active = false THEN
      RAISE EXCEPTION 'الخزينة المحددة معطلة أو غير موجودة';
    END IF;

    -- Validate payment does not exceed total
    IF v_paid_amount > v_total_amount THEN
      RAISE EXCEPTION 'مبلغ السداد الفوري لا يمكن أن يتجاوز إجمالي الفاتورة';
    END IF;

    -- Check idempotency if key provided
    IF v_idempotency_key IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.purchase_payments WHERE idempotency_key = v_idempotency_key) THEN
        RAISE EXCEPTION 'هذه الدفعة مسجلة مسبقاً (مفتاح التكرار موجود)';
      END IF;
    END IF;

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
      COALESCE(NULLIF(TRIM(p_payment->>'payment_method'), ''), 'cash'),
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

GRANT EXECUTE ON FUNCTION public.create_purchase_with_immediate_payment(jsonb, jsonb) TO authenticated, anon;

-- 2. Server-side enforcement of opening balance rule: zero prior transactions
CREATE OR REPLACE FUNCTION public.validate_treasury_opening_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'opening_balance' OR NEW.reference_type = 'opening_balance' THEN
    -- Check if ANY prior transaction exists for this treasury (excluding current row if updating)
    IF EXISTS (
      SELECT 1 FROM public.treasury_transactions
      WHERE treasury_id = NEW.treasury_id
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'لا يمكن تسجيل رصيد افتتاحي لخزينة تمتلك حركات تشغيلية سابقة.';
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
