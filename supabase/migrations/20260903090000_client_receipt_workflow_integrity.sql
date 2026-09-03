-- Deploy with the matching UI. No production data is deleted by this migration.
-- Receipts are reversed, never physically removed from the credit audit trail.
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE public.client_payments ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS reference_id uuid;

CREATE TABLE public.workflow_requests (
  actor_id uuid NOT NULL, operation text NOT NULL, request_key text NOT NULL,
  payload jsonb NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation, request_key)
);
ALTER TABLE public.workflow_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workflow_requests FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.require_finance_actor() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'accountant')) THEN
    RAISE EXCEPTION 'هذه العملية متاحة للمدير والمحاسب فقط.' USING ERRCODE = '42501';
  END IF;
  RETURN auth.uid();
END $$;

-- The unique row lock serializes retries. A failed transaction leaves no key behind.
CREATE FUNCTION public.begin_workflow_request(p_operation text, p_key text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.require_finance_actor(); v_request public.workflow_requests%ROWTYPE;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'مفتاح العملية مطلوب.';
  END IF;
  INSERT INTO public.workflow_requests(actor_id, operation, request_key, payload)
    VALUES(v_actor, p_operation, p_key, p_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_request FROM public.workflow_requests
    WHERE actor_id = v_actor AND operation = p_operation AND request_key = p_key FOR UPDATE;
  IF v_request.payload IS DISTINCT FROM p_payload THEN
    RAISE EXCEPTION 'مفتاح العملية مستخدم مع بيانات مختلفة.';
  END IF;
  RETURN v_request.result;
END $$;

CREATE FUNCTION public.finish_workflow_request(p_operation text, p_key text, p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.workflow_requests SET result = p_result
    WHERE actor_id = auth.uid() AND operation = p_operation AND request_key = p_key;
  RETURN p_result;
END $$;

-- Match only unambiguous old journal entries. Ambiguous entries remain untouched
-- and receipt reversal fails closed until their links have been reviewed.
WITH candidates AS (
  SELECT i.id AS income_id, p.id AS payment_id,
    count(*) OVER (PARTITION BY i.id) AS income_matches,
    count(*) OVER (PARTITION BY p.id) AS payment_matches
  FROM public.income i JOIN public.client_payments p ON i.amount = p.amount AND i.date = p.date
    AND i.client_id IS NOT DISTINCT FROM p.client_id
    AND i.project_id IS NOT DISTINCT FROM p.project_id
  WHERE i.reference_id IS NULL AND i.subtype = 'client_payment'
    AND NOT EXISTS (SELECT 1 FROM public.income linked WHERE linked.reference_id = p.id)
)
UPDATE public.income i SET reference_id = c.payment_id FROM candidates c
WHERE i.id = c.income_id AND c.income_matches = 1 AND c.payment_matches = 1;

CREATE OR REPLACE FUNCTION public.get_project_authoritative_remaining(p_project_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project public.projects%ROWTYPE; v_cost numeric; v_work numeric; v_obligation numeric;
  v_cash numeric; v_excess numeric; v_credit numeric; v_rentals numeric;
BEGIN
  PERFORM public.require_finance_actor();
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المشروع غير موجود.'; END IF;
  IF v_project.project_type = 'finishing' THEN
    SELECT coalesce(sum(total_amount), 0) INTO v_cost FROM public.purchases
      WHERE project_id = p_project_id AND rental_id IS NULL AND technician_id IS NULL
        AND coalesce(purchase_type,'material') IN ('material','service');
    SELECT coalesce(sum(total_amount),0) INTO v_rentals FROM public.purchases
      WHERE project_id=p_project_id AND (rental_id IS NOT NULL OR purchase_type='rental');
    IF v_rentals = 0 THEN
      SELECT coalesce(sum(total_amount),0) INTO v_rentals FROM public.equipment_rentals WHERE project_id=p_project_id;
    END IF;
    v_cost := v_cost + v_rentals;
    SELECT coalesce(sum(coalesce(nullif(t.total_cost,0), t.rate * coalesce(t.quantity,1))),0)
      INTO v_work FROM public.project_item_technicians t JOIN public.project_items i ON i.id = t.project_item_id
      WHERE i.project_id = p_project_id;
    IF v_work = 0 THEN
      SELECT coalesce(sum(earned_amount),0) INTO v_work FROM public.technician_progress_records WHERE project_id = p_project_id;
    END IF;
    IF v_work = 0 THEN
      SELECT coalesce(sum(total_amount),0) INTO v_work FROM public.purchases
        WHERE project_id = p_project_id AND (technician_id IS NOT NULL OR purchase_type = 'labor')
          AND rental_id IS NULL AND purchase_type IS DISTINCT FROM 'rental';
    END IF;
    v_cost := v_cost + v_work + (SELECT coalesce(sum(amount),0) FROM public.expenses
      WHERE project_id = p_project_id AND NOT (coalesce(type,'') = 'labor' AND technician_id IS NOT NULL));
    v_obligation := v_cost * (1 + coalesce(v_project.finishing_percentage,0) / 100);
  ELSE
    SELECT coalesce(sum(amount),0) INTO v_obligation FROM public.contracts
      WHERE project_id = p_project_id AND status IS DISTINCT FROM 'cancelled';
    IF v_obligation = 0 THEN
      SELECT coalesce(sum(total_price),0) INTO v_obligation FROM public.project_items WHERE project_id = p_project_id;
    END IF;
    IF v_obligation = 0 THEN v_obligation := coalesce(v_project.budget,0); END IF;
  END IF;
  SELECT coalesce(sum(amount),0) INTO v_cash FROM public.client_payments
    WHERE project_id = p_project_id AND reversed_at IS NULL;
  SELECT coalesce(sum(CASE WHEN e.entry_type = 'CREDIT_CREATED' THEN e.amount
    WHEN e.entry_type = 'CREDIT_CREATION_REVERSED' THEN -e.amount ELSE 0 END),0)
    INTO v_excess FROM public.client_credit_ledger e JOIN public.client_payments p ON p.id = e.source_payment_id
    WHERE p.project_id = p_project_id AND p.reversed_at IS NULL;
  SELECT coalesce(sum(CASE WHEN entry_type = 'CREDIT_APPLIED' THEN amount
    WHEN entry_type = 'CREDIT_APPLICATION_REVERSED' THEN -amount ELSE 0 END),0)
    INTO v_credit FROM public.client_credit_ledger WHERE target_project_id = p_project_id;
  RETURN greatest(0, v_obligation - greatest(0, v_cash - v_excess) - v_credit);
END $$;

CREATE FUNCTION public.record_client_receipt_v2(p_payload jsonb, p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb; v_id uuid; v_credit_id uuid; v_remaining numeric := 0;
  v_client uuid := (p_payload->>'client_id')::uuid; v_project uuid := (p_payload->>'project_id')::uuid;
  v_treasury uuid := (p_payload->>'treasury_id')::uuid; v_amount numeric := (p_payload->>'amount')::numeric;
  v_date date := coalesce((p_payload->>'date')::date, current_date);
  v_method text := coalesce(nullif(p_payload->>'payment_method',''),'cash'); v_notes text;
BEGIN
  v_result := public.begin_workflow_request('client_receipt',p_request_key,p_payload);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون رقماً موجباً.';
  END IF;
  PERFORM id FROM public.clients WHERE id = v_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الزبون غير موجود.'; END IF;
  IF v_project IS NOT NULL THEN
    PERFORM id FROM public.projects WHERE id = v_project AND client_id = v_client FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'المشروع لا يتبع الزبون المحدد.'; END IF;
    v_remaining := public.get_project_authoritative_remaining(v_project);
  END IF;
  PERFORM id FROM public.treasuries WHERE id = v_treasury AND is_active IS NOT FALSE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'اختر خزينة نشطة.'; END IF;
  v_notes := nullif(concat_ws(' — ',nullif(p_payload->>'notes',''),
    CASE WHEN nullif(p_payload->>'reference','') IS NOT NULL THEN 'مرجع: ' || (p_payload->>'reference') END),'');
  INSERT INTO public.client_payments(client_id,project_id,treasury_id,amount,date,payment_method,notes)
    VALUES(v_client,v_project,v_treasury,v_amount,v_date,v_method,v_notes) RETURNING id INTO v_id;
  IF v_amount > v_remaining THEN
    INSERT INTO public.client_credit_ledger(client_id,entry_type,amount,source_payment_id,notes,created_by)
      VALUES(v_client,'CREDIT_CREATED',v_amount-v_remaining,v_id,'رصيد دائن محفوظ على حساب الزبون',auth.uid())
      RETURNING id INTO v_credit_id;
  END IF;
  INSERT INTO public.income(client_id,project_id,amount,date,type,subtype,payment_method,status,notes,reference_id)
    VALUES(v_client,v_project,v_amount,v_date,'service','client_payment',v_method,'received',v_notes,v_id);
  INSERT INTO public.treasury_transactions(treasury_id,type,amount,balance_after,description,date,source,reference_type,reference_id,notes)
    SELECT v_treasury,'deposit',v_amount,0,'سند قبض من الزبون',v_date,'client_payment','client_payment',v_id,v_notes
    WHERE NOT EXISTS (SELECT 1 FROM public.treasury_transactions WHERE reference_type='client_payment' AND reference_id=v_id);
  IF (SELECT count(*) FROM public.treasury_transactions WHERE reference_type='client_payment' AND reference_id=v_id) <> 1 THEN
    RAISE EXCEPTION 'تعذر التحقق من حركة الخزينة المرتبطة.';
  END IF;
  UPDATE public.treasuries SET balance=(SELECT coalesce(sum(CASE WHEN type='deposit' THEN amount ELSE -amount END),0)
    FROM public.treasury_transactions WHERE treasury_id=v_treasury) WHERE id=v_treasury;
  UPDATE public.treasury_transactions SET balance_after=(SELECT balance FROM public.treasuries WHERE id=v_treasury)
    WHERE reference_type='client_payment' AND reference_id=v_id;
  RETURN public.finish_workflow_request('client_receipt',p_request_key,jsonb_build_object('success',true,'payment_id',v_id,
    'cash_applied_to_project',least(v_amount,v_remaining),'credit_created',greatest(0,v_amount-v_remaining),'credit_ledger_id',v_credit_id));
END $$;

CREATE FUNCTION public.reverse_client_receipt_v2(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payment public.client_payments%ROWTYPE; v_entry public.client_credit_ledger%ROWTYPE;
  v_client uuid; v_credit numeric;
BEGIN
  PERFORM public.require_finance_actor();
  SELECT client_id INTO v_client FROM public.client_payments WHERE id=p_payment_id;
  PERFORM id FROM public.clients WHERE id=v_client FOR UPDATE;
  SELECT * INTO v_payment FROM public.client_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'سند القبض غير موجود.'; END IF;
  IF v_payment.reversed_at IS NOT NULL THEN RETURN jsonb_build_object('success',true,'already_reversed',true); END IF;
  PERFORM id FROM public.projects WHERE id=v_payment.project_id FOR UPDATE;
  PERFORM id FROM public.treasuries WHERE id=v_payment.treasury_id FOR UPDATE;
  IF (SELECT count(*) FROM public.income WHERE reference_id=p_payment_id AND subtype='client_payment') <> 1
    OR (SELECT count(*) FROM public.treasury_transactions WHERE reference_type='client_payment'
      AND reference_id=p_payment_id AND treasury_id=v_payment.treasury_id AND type='deposit' AND amount=v_payment.amount) <> 1 THEN
    RAISE EXCEPTION 'السند القديم يحتاج مراجعة روابط الدخل والخزينة قبل إلغائه. لم يتم تغيير أي رصيد.';
  END IF;
  SELECT coalesce(sum(e.amount),0) INTO v_credit FROM public.client_credit_ledger e
    WHERE e.source_payment_id=p_payment_id AND e.entry_type='CREDIT_CREATED'
      AND NOT EXISTS(SELECT 1 FROM public.client_credit_ledger r WHERE r.reference_entry_id=e.id AND r.entry_type='CREDIT_CREATION_REVERSED');
  IF public.get_client_available_credit(v_client) < v_credit THEN
    RAISE EXCEPTION 'استُخدم رصيد هذا السند. ألغِ تطبيق الرصيد على المشاريع أولاً.';
  END IF;
  FOR v_entry IN SELECT * FROM public.client_credit_ledger e WHERE source_payment_id=p_payment_id AND entry_type='CREDIT_CREATED'
    AND NOT EXISTS(SELECT 1 FROM public.client_credit_ledger r WHERE r.reference_entry_id=e.id AND r.entry_type='CREDIT_CREATION_REVERSED')
  LOOP
    INSERT INTO public.client_credit_ledger(client_id,entry_type,amount,source_payment_id,reference_entry_id,notes,created_by)
      VALUES(v_client,'CREDIT_CREATION_REVERSED',v_entry.amount,p_payment_id,v_entry.id,'إلغاء رصيد سند القبض',auth.uid());
  END LOOP;
  UPDATE public.client_payments SET reversed_at=now() WHERE id=p_payment_id;
  DELETE FROM public.income WHERE reference_id=p_payment_id AND subtype='client_payment';
  INSERT INTO public.treasury_transactions(treasury_id,type,amount,balance_after,description,date,source,reference_type,reference_id)
    VALUES(v_payment.treasury_id,'withdrawal',v_payment.amount,0,'عكس سند قبض الزبون',current_date,'client_payment_reversal','client_payment_reversal',p_payment_id);
  UPDATE public.treasuries SET balance=(SELECT coalesce(sum(CASE WHEN type='deposit' THEN amount ELSE -amount END),0)
    FROM public.treasury_transactions WHERE treasury_id=v_payment.treasury_id) WHERE id=v_payment.treasury_id;
  UPDATE public.treasury_transactions SET balance_after=(SELECT balance FROM public.treasuries WHERE id=v_payment.treasury_id)
    WHERE reference_type='client_payment_reversal' AND reference_id=p_payment_id;
  RETURN jsonb_build_object('success',true,'payment_id',p_payment_id);
END $$;

-- Corrections preserve both versions. If replacement fails, the reversal rolls back too.
CREATE FUNCTION public.update_client_receipt_v2(p_payment_id uuid,p_payload jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb; v_payment public.client_payments%ROWTYPE; v_client uuid;
BEGIN
  v_result := public.begin_workflow_request('client_receipt_update',p_request_key,jsonb_build_object('id',p_payment_id,'data',p_payload));
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT client_id INTO v_client FROM public.client_payments WHERE id=p_payment_id;
  PERFORM id FROM public.clients WHERE id=v_client FOR UPDATE;
  SELECT * INTO v_payment FROM public.client_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'السند غير موجود أو ملغى.'; END IF;
  PERFORM id FROM public.projects WHERE id=v_payment.project_id FOR UPDATE;
  PERFORM id FROM public.treasuries WHERE id IN (v_payment.treasury_id,(p_payload->>'treasury_id')::uuid) ORDER BY id FOR UPDATE;
  PERFORM public.reverse_client_receipt_v2(p_payment_id);
  v_result := public.record_client_receipt_v2(p_payload || jsonb_build_object('client_id',v_payment.client_id,
    'project_id',v_payment.project_id,'reference','تصحيح السند ' || p_payment_id::text), 'correction:' || p_request_key);
  RETURN public.finish_workflow_request('client_receipt_update',p_request_key,v_result);
END $$;

-- Private helpers and obsolete write paths must not bypass validation.
REVOKE ALL ON FUNCTION public.require_finance_actor(), public.begin_workflow_request(text,text,jsonb),
  public.finish_workflow_request(text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.record_client_payment_atomic(uuid,uuid,uuid,numeric,text,date,text),
  public.reverse_client_payment_atomic(uuid) FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.client_payments,public.client_credit_ledger FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_client_receipt_v2(jsonb,text), public.reverse_client_receipt_v2(uuid),
  public.update_client_receipt_v2(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_client_receipt_v2(jsonb,text), public.reverse_client_receipt_v2(uuid),
  public.update_client_receipt_v2(uuid,jsonb,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_client_available_credit(uuid), public.get_project_authoritative_remaining(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_client_available_credit(uuid), public.get_project_authoritative_remaining(uuid) TO authenticated;

-- Financial data is never public, even on installations with legacy USING(true) policies.
DO $$ DECLARE v_table text; BEGIN
  FOREACH v_table IN ARRAY ARRAY['client_payments','client_credit_ledger','income','expenses','purchases',
    'purchase_payments','supplier_payments','supplier_payment_allocations','technician_payments',
    'treasuries','treasury_transactions','contracts','contract_items','project_items','project_item_technicians',
    'clients','suppliers','technicians','projects','project_phases','technician_progress_records','equipment_rentals',
    'project_custody','audit_logs','profiles','user_roles'] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon',v_table);
    END IF;
  END LOOP;
END $$;
