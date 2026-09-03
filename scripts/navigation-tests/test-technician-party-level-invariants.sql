-- Transactional Test: Verify Party-Level Technician Account & Payment Invariants
DO $$
DECLARE
  v_tech_id UUID;
  v_proj_a UUID;
  v_proj_b UUID;
  v_treasury_a UUID;
  v_treasury_b UUID;
  v_tr_a_initial NUMERIC := 10000;
  v_tr_b_initial NUMERIC := 10000;
  v_res JSONB;
  v_pay_id UUID;
  v_total_earned NUMERIC;
  v_total_paid NUMERIC;
  v_balance NUMERIC;
  v_tr_a_bal NUMERIC;
  v_tr_b_bal NUMERIC;
  v_alloc_tbl_exists BOOLEAN;
  v_err_caught BOOLEAN := FALSE;
  v_key TEXT;
BEGIN
  -- Setup test context
  -- 1. Create temporary test technician
  INSERT INTO public.technicians (name) VALUES ('Test Tech Invariants') RETURNING id INTO v_tech_id;

  -- 2. Create two test projects
  INSERT INTO public.projects (name, project_type, status) VALUES ('Project A Invariant', 'contracting', 'in_progress') RETURNING id INTO v_proj_a;
  INSERT INTO public.projects (name, project_type, status) VALUES ('Project B Invariant', 'finishing', 'in_progress') RETURNING id INTO v_proj_b;

  -- 3. Create two test treasuries
  INSERT INTO public.treasuries (name, treasury_type, balance, is_active) VALUES ('Treasury A Test', 'cash_fund', v_tr_a_initial, true) RETURNING id INTO v_treasury_a;
  INSERT INTO public.treasuries (name, treasury_type, balance, is_active) VALUES ('Treasury B Test', 'bank_account', v_tr_b_initial, true) RETURNING id INTO v_treasury_b;

  -- 4. TECH-PAY-01: Earned = 5,000 (Project A = 2,000, Project B = 3,000)
  INSERT INTO public.technician_progress_records (technician_id, project_id, earned_amount, date)
  VALUES (v_tech_id, v_proj_a, 2000, CURRENT_DATE);
  INSERT INTO public.technician_progress_records (technician_id, project_id, earned_amount, date)
  VALUES (v_tech_id, v_proj_b, 3000, CURRENT_DATE);

  -- Legacy labor expense = 1,000
  INSERT INTO public.expenses (technician_id, project_id, treasury_id, type, amount, date, description)
  VALUES (v_tech_id, v_proj_a, v_treasury_a, 'labor', 1000, CURRENT_DATE, 'Legacy labor');

  -- Verify initial state: Earned = 5000, Paid = 1000, Balance = 4000
  SELECT COALESCE(SUM(earned_amount), 0) INTO v_total_earned FROM public.technician_progress_records WHERE technician_id = v_tech_id;
  SELECT COALESCE((SELECT SUM(amount) FROM public.technician_payments WHERE technician_id = v_tech_id AND status = 'completed'), 0) +
         COALESCE((SELECT SUM(amount) FROM public.expenses WHERE technician_id = v_tech_id AND type = 'labor'), 0) INTO v_total_paid;
  v_balance := v_total_earned - v_total_paid;

  IF v_total_earned <> 5000 OR v_total_paid <> 1000 OR v_balance <> 4000 THEN
    RAISE EXCEPTION 'TECH-PAY-01 FAILED: Expected Earned=5000, Paid=1000, Balance=4000. Got Earned=%, Paid=%, Balance=%', v_total_earned, v_total_paid, v_balance;
  END IF;
  RAISE NOTICE 'TECH-PAY-01 PASS: Earned=5000, Paid=1000, Balance=4000';

  -- 5. TECH-PAY-02: Create payment from TechnicianDetail (500)
  v_key := 'KEY_' || gen_random_uuid()::TEXT;
  v_res := public.pay_technician_on_account_atomic(
    v_tech_id, v_treasury_a, 500, 'cash', CURRENT_DATE, 'Payment 1', NULL, v_key, NULL
  );
  v_pay_id := (v_res->>'payment_id')::UUID;

  SELECT COALESCE((SELECT SUM(amount) FROM public.technician_payments WHERE technician_id = v_tech_id AND status = 'completed'), 0) +
         COALESCE((SELECT SUM(amount) FROM public.expenses WHERE technician_id = v_tech_id AND type = 'labor'), 0) INTO v_total_paid;
  v_balance := v_total_earned - v_total_paid;
  SELECT balance INTO v_tr_a_bal FROM public.treasuries WHERE id = v_treasury_a;

  IF v_total_paid <> 1500 OR v_balance <> 3500 OR v_tr_a_bal <> (v_tr_a_initial - 1000 - 500) THEN
    RAISE EXCEPTION 'TECH-PAY-02 FAILED: Expected Paid=1500, Balance=3500, TrA=%. Got Paid=%, Balance=%, TrA=%', (v_tr_a_initial - 1500), v_total_paid, v_balance, v_tr_a_bal;
  END IF;
  RAISE NOTICE 'TECH-PAY-02 PASS: Payment 500 posted globally, Zero project allocation';

  -- 6. TECH-PAY-03: Create payment opened from Project A context (500)
  v_key := 'KEY_' || gen_random_uuid()::TEXT;
  v_res := public.pay_technician_on_account_atomic(
    v_tech_id, v_treasury_a, 500, 'cash', CURRENT_DATE, 'Payment 2 from Project A', NULL, v_key, v_proj_a
  );

  SELECT COALESCE((SELECT SUM(amount) FROM public.technician_payments WHERE technician_id = v_tech_id AND status = 'completed'), 0) +
         COALESCE((SELECT SUM(amount) FROM public.expenses WHERE technician_id = v_tech_id AND type = 'labor'), 0) INTO v_total_paid;
  v_balance := v_total_earned - v_total_paid;

  IF v_total_paid <> 2000 OR v_balance <> 3000 THEN
    RAISE EXCEPTION 'TECH-PAY-03 FAILED: Expected Paid=2000, Balance=3000. Got Paid=%, Balance=%', v_total_paid, v_balance;
  END IF;
  RAISE NOTICE 'TECH-PAY-03 PASS: Payment with context_project_id behaves identically to global payment';

  -- 7. TECH-PAY-04: Edit payment (500 -> 700)
  v_res := public.update_technician_payment_atomic(
    v_pay_id, 700, v_treasury_a, 'cash', CURRENT_DATE, 'Edited to 700', NULL
  );

  SELECT COALESCE((SELECT SUM(amount) FROM public.technician_payments WHERE technician_id = v_tech_id AND status = 'completed'), 0) +
         COALESCE((SELECT SUM(amount) FROM public.expenses WHERE technician_id = v_tech_id AND type = 'labor'), 0) INTO v_total_paid;
  v_balance := v_total_earned - v_total_paid;
  SELECT balance INTO v_tr_a_bal FROM public.treasuries WHERE id = v_treasury_a;

  IF v_total_paid <> 2200 OR v_balance <> 2800 OR v_tr_a_bal <> (v_tr_a_initial - 1000 - 700 - 500) THEN
    RAISE EXCEPTION 'TECH-PAY-04 FAILED: Expected Paid=2200, Balance=2800, TrA=%. Got Paid=%, Balance=%, TrA=%', (v_tr_a_initial - 2200), v_total_paid, v_balance, v_tr_a_bal;
  END IF;
  RAISE NOTICE 'TECH-PAY-04 PASS: Payment amount updated to 700 with exact Treasury delta';

  -- 8. TECH-PAY-05: Edit Treasury (Treasury A -> Treasury B)
  v_res := public.update_technician_payment_atomic(
    v_pay_id, 700, v_treasury_b, 'transfer', CURRENT_DATE, 'Moved to Treasury B', NULL
  );

  SELECT balance INTO v_tr_a_bal FROM public.treasuries WHERE id = v_treasury_a;
  SELECT balance INTO v_tr_b_bal FROM public.treasuries WHERE id = v_treasury_b;

  -- Tr A should be restored +700 (so only 1000 legacy + 500 pay2 deducted = 8500)
  -- Tr B should be deducted -700 (10000 - 700 = 9300)
  IF v_tr_a_bal <> (v_tr_a_initial - 1000 - 500) OR v_tr_b_bal <> (v_tr_b_initial - 700) THEN
    RAISE EXCEPTION 'TECH-PAY-05 FAILED: Expected TrA=%, TrB=%. Got TrA=%, TrB=%', (v_tr_a_initial - 1500), (v_tr_b_initial - 700), v_tr_a_bal, v_tr_b_bal;
  END IF;
  RAISE NOTICE 'TECH-PAY-05 PASS: Treasury switch correctly restores old treasury and deducts new treasury';

  -- 9. TECH-PAY-06: Reverse Payment
  v_res := public.reverse_technician_payment_atomic(
    v_pay_id, 'Test reversal'
  );

  SELECT COALESCE((SELECT SUM(amount) FROM public.technician_payments WHERE technician_id = v_tech_id AND status = 'completed'), 0) +
         COALESCE((SELECT SUM(amount) FROM public.expenses WHERE technician_id = v_tech_id AND type = 'labor'), 0) INTO v_total_paid;
  v_balance := v_total_earned - v_total_paid;
  SELECT balance INTO v_tr_b_bal FROM public.treasuries WHERE id = v_treasury_b;

  IF v_total_paid <> 1500 OR v_balance <> 3500 OR v_tr_b_bal <> v_tr_b_initial THEN
    RAISE EXCEPTION 'TECH-PAY-06 FAILED: Expected Paid=1500, Balance=3500, TrB=%. Got Paid=%, Balance=%, TrB=%', v_tr_b_initial, v_total_paid, v_balance, v_tr_b_bal;
  END IF;
  RAISE NOTICE 'TECH-PAY-06 PASS: Reversal correctly restores Treasury and decreases Paid';

  -- 10. TECH-PAY-07: Overpayment > Global Balance Rejection
  v_err_caught := FALSE;
  BEGIN
    v_key := 'KEY_' || gen_random_uuid()::TEXT;
    PERFORM public.pay_technician_on_account_atomic(
      v_tech_id, v_treasury_a, 999999, 'cash', CURRENT_DATE, 'Overpay', NULL, v_key, NULL
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%OVERPAYMENT_EXCEEDED%' THEN
      v_err_caught := TRUE;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TECH-PAY-07 FAILED: Overpayment was not rejected!';
  END IF;
  RAISE NOTICE 'TECH-PAY-07 PASS: Overpayment strictly rejected';

  -- Check technician_payment_allocations status
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'technician_payment_allocations'
  ) INTO v_alloc_tbl_exists;

  IF v_alloc_tbl_exists THEN
    RAISE EXCEPTION 'ALLOCATION TABLE STILL EXISTS!';
  END IF;
  RAISE NOTICE 'DEPRECATION PASS: technician_payment_allocations is dropped and unused';

  -- Clean up test records
  DELETE FROM public.treasury_transactions WHERE reference_id IN (SELECT id FROM public.technician_payments WHERE technician_id = v_tech_id);
  DELETE FROM public.technician_payments WHERE technician_id = v_tech_id;
  DELETE FROM public.expenses WHERE technician_id = v_tech_id;
  DELETE FROM public.technician_progress_records WHERE technician_id = v_tech_id;
  DELETE FROM public.technicians WHERE id = v_tech_id;
  DELETE FROM public.projects WHERE id IN (v_proj_a, v_proj_b);
  DELETE FROM public.treasuries WHERE id IN (v_treasury_a, v_treasury_b);

  RAISE NOTICE 'ALL 7 TECHNICIAN INVARIANT TESTS COMPLETED WITH 100%% SUCCESS';
END;
$$;
