-- Migration: Simplify Technician & Supplier Accounts and Specialties Baseline
-- Date: 2026-08-31
-- Description:
-- 1. Insert master data baseline of technician specialties into technician_types.
-- 2. Create atomic on-account payment RPCs for Technicians and Suppliers.

-- ========================================================
-- 1. BASELINE TECHNICIAN SPECIALTIES MASTER DATA
-- ========================================================
INSERT INTO public.technician_types (code, name, description, is_active)
VALUES
  ('daily_worker', 'عامل / عمالة يومية', 'عمالة يومية ومياومة للموقع والأعمال المتنوعة', true),
  ('reinforced_carpenter', 'نجار مسلح', 'أعمال نجارة الخرسانة المسلحة والقواعد والأعمدة والأسقف', true),
  ('rebar_blacksmith', 'حداد مسلح', 'أعمال قص وثني وتركيب حديد التسليح للمنشآت الخرسانية', true),
  ('builder_mason', 'بنّاء', 'أعمال بناء الطوب والبلوك والأسوار والقواطع', true),
  ('electrician', 'كهربائي', 'تأسيس وتشطيب التمديدات والشبكات الكهربائية والإنارة', true),
  ('plumber', 'سباك', 'تأسيس وتشطيب شبكات التغذية والصرف الصحي والمضخات', true),
  ('hvac_technician', 'فني تكييف وتبريد', 'تمديد وصيانة وتركيب وحدات التكييف والتهوية والتبريد', true),
  ('gypsum_technician', 'فني جبس', 'أعمال الجبس بورد والأسقف المعلقة والكرانيش الديكورية', true),
  ('painter', 'فني دهان', 'أعمال المعجون والدهانات الداخلية والخارجية والديكورية', true),
  ('tile_ceramic_mason', 'فني بلاط وسيراميك', 'تركيب السيراميك والبورسلين والرخام للأرضيات والجدران', true),
  ('aluminum_technician', 'فني ألمنيوم', 'تصنيع وتركيب النوافذ والأبواب والواجهات الألومنيوم', true),
  ('welder', 'فني لحام', 'أعمال اللحام والحدادة العامة والهياكل المعدنية', true),
  ('insulation_technician', 'فني عزل', 'أعمال العزل المائي والحراري للأسطح والخزانات والقواعد', true),
  ('glass_technician', 'فني زجاج', 'توريد وتركيب الزجاج السيكوريت والواجهات والمرايا', true),
  ('carpenter', 'فني نجارة', 'أعمال النجارة العامة والأبواب والمطابخ والخزائن', true),
  ('door_installer', 'فني تركيب أبواب', 'تركيب الأبواب الخشبية والمعدنية والملحقات والأقفال', true),
  ('stone_marble_mason', 'فني حجر ورخام', 'أعمال تركيب وتلميع الحجر والرخام الطبيعي والصناعي', true)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true;

-- ========================================================
-- 2. ATOMIC TECHNICIAN ON-ACCOUNT PAYMENT RPC
-- ========================================================
CREATE OR REPLACE FUNCTION public.pay_technician_on_account_atomic(
  p_technician_id UUID,
  p_treasury_id UUID,
  p_amount NUMERIC,
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
  v_technician RECORD;
  v_treasury RECORD;
  v_total_earned NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_balance NUMERIC := 0;
  v_expense_id UUID;
  v_project_id UUID;
BEGIN
  -- 1. Authorization check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated.';
  END IF;

  -- 2. Validate technician
  SELECT id, name INTO v_technician
  FROM public.technicians
  WHERE id = p_technician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TECHNICIAN_NOT_FOUND: Technician % does not exist.', p_technician_id;
  END IF;

  -- 3. Validate treasury
  SELECT id, name, is_active INTO v_treasury
  FROM public.treasuries
  WHERE id = p_treasury_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREASURY_NOT_FOUND: Treasury % does not exist.', p_treasury_id;
  END IF;

  IF v_treasury.is_active IS FALSE THEN
    RAISE EXCEPTION 'TREASURY_INACTIVE: Treasury % is inactive.', v_treasury.name;
  END IF;

  -- 4. Calculate global balance
  SELECT COALESCE(SUM(earned_amount), 0)
  INTO v_total_earned
  FROM public.technician_progress_records
  WHERE technician_id = p_technician_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM public.expenses
  WHERE technician_id = p_technician_id AND type = 'labor';

  v_balance := GREATEST(0, v_total_earned - v_total_paid);

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.';
  END IF;

  IF v_balance > 0 AND p_amount > (v_balance + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: Payment amount % exceeds technician balance %.', p_amount, v_balance;
  END IF;

  -- 5. Find oldest project with unpaid work for attribution if available
  SELECT project_id INTO v_project_id
  FROM public.technician_progress_records
  WHERE technician_id = p_technician_id
  ORDER BY date ASC, created_at ASC
  LIMIT 1;

  -- 6. Insert ONE record into expenses (Triggers exactly ONE Treasury OUT)
  INSERT INTO public.expenses (
    technician_id,
    project_id,
    treasury_id,
    type,
    amount,
    date,
    payment_method,
    description,
    notes
  ) VALUES (
    p_technician_id,
    v_project_id,
    p_treasury_id,
    'labor',
    p_amount,
    p_date,
    p_payment_method,
    'دفعة على الحساب - ' || v_technician.name,
    COALESCE(p_notes, p_reference)
  )
  RETURNING id INTO v_expense_id;

  RETURN jsonb_build_object(
    'success', true,
    'expense_id', v_expense_id,
    'technician_name', v_technician.name,
    'amount', p_amount,
    'date', p_date,
    'treasury_name', v_treasury.name,
    'payment_method', p_payment_method
  );
END;
$$;

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
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_supplier RECORD;
  v_treasury RECORD;
  v_total_invoices NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_balance NUMERIC := 0;
  v_remaining_to_allocate NUMERIC;
  v_purchase RECORD;
  v_purchase_due NUMERIC;
  v_alloc_amount NUMERIC;
  v_alloc_count INT := 0;
  v_alloc_summary JSONB := '[]'::JSONB;
BEGIN
  -- 1. Authorization check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated.';
  END IF;

  -- 2. Validate supplier
  SELECT id, name INTO v_supplier
  FROM public.suppliers
  WHERE id = p_supplier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Supplier % does not exist.', p_supplier_id;
  END IF;

  -- 3. Validate treasury
  SELECT id, name, is_active INTO v_treasury
  FROM public.treasuries
  WHERE id = p_treasury_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREASURY_NOT_FOUND: Treasury % does not exist.', p_treasury_id;
  END IF;

  IF v_treasury.is_active IS FALSE THEN
    RAISE EXCEPTION 'TREASURY_INACTIVE: Treasury % is inactive.', v_treasury.name;
  END IF;

  -- 4. Calculate global balance
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_invoices
  FROM public.purchases
  WHERE supplier_id = p_supplier_id;

  SELECT COALESCE(SUM(pp.amount), 0)
  INTO v_total_paid
  FROM public.purchase_payments pp
  JOIN public.purchases p ON pp.purchase_id = p.id
  WHERE p.supplier_id = p_supplier_id;

  v_balance := GREATEST(0, v_total_invoices - v_total_paid);

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.';
  END IF;

  IF p_amount > (v_balance + 0.001) THEN
    RAISE EXCEPTION 'OVERPAYMENT_EXCEEDED: Payment amount % exceeds supplier balance %.', p_amount, v_balance;
  END IF;

  -- 5. Auto-allocate Oldest-First across unpaid purchases
  v_remaining_to_allocate := p_amount;

  FOR v_purchase IN
    SELECT 
      p.id,
      p.invoice_number,
      p.total_amount,
      COALESCE((SELECT SUM(amount) FROM public.purchase_payments WHERE purchase_id = p.id), 0) AS current_paid
    FROM public.purchases p
    WHERE p.supplier_id = p_supplier_id
    ORDER BY p.date ASC, p.created_at ASC
  LOOP
    v_purchase_due := GREATEST(0, v_purchase.total_amount - v_purchase.current_paid);
    
    IF v_purchase_due > 0 AND v_remaining_to_allocate > 0 THEN
      v_alloc_amount := LEAST(v_purchase_due, v_remaining_to_allocate);
      v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_amount;
      v_alloc_count := v_alloc_count + 1;

      -- Insert allocation to purchase_payments with treasury_id = NULL
      -- so trigger handles status/paid_amount updates without duplicate withdrawals
      INSERT INTO public.purchase_payments (
        purchase_id,
        treasury_id,
        amount,
        date,
        payment_method,
        notes
      ) VALUES (
        v_purchase.id,
        NULL,
        v_alloc_amount,
        p_date,
        p_payment_method,
        COALESCE(p_notes, 'دفعة على الحساب - سداد فاتورة ' || COALESCE(v_purchase.invoice_number, ''))
      );

      -- Update purchase paid_amount & status
      UPDATE public.purchases
      SET 
        paid_amount = v_purchase.current_paid + v_alloc_amount,
        status = CASE 
          WHEN (v_purchase.current_paid + v_alloc_amount) >= v_purchase.total_amount THEN 'paid'
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

  -- 6. Insert EXACTLY ONE Treasury OUT for the global payment
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
    'purchase_payments',
    'supplier_on_account_payment',
    p_supplier_id,
    COALESCE(p_notes, p_reference)
  );

  -- 7. Update treasury balance
  UPDATE public.treasuries
  SET balance = (
    SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
    FROM public.treasury_transactions
    WHERE treasury_id = p_treasury_id
  )
  WHERE id = p_treasury_id;

  -- 8. Update balance_after on the inserted transaction
  UPDATE public.treasury_transactions
  SET balance_after = (SELECT balance FROM public.treasuries WHERE id = p_treasury_id)
  WHERE treasury_id = p_treasury_id 
    AND reference_type = 'supplier_on_account_payment'
    AND reference_id = p_supplier_id
    AND date = p_date;

  RETURN jsonb_build_object(
    'success', true,
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.pay_technician_on_account_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_supplier_on_account_atomic TO authenticated;
