-- Keep the established allocation behavior while serializing account operations.
-- The original implementations become private, so clients cannot bypass locks.
ALTER FUNCTION public.pay_supplier_on_account_atomic(uuid,uuid,numeric,text,date,text,text,text)
  RENAME TO pay_supplier_on_account_unserialized;
ALTER FUNCTION public.pay_technician_on_account_atomic(uuid,uuid,numeric,text,date,text,text,text,uuid)
  RENAME TO pay_technician_on_account_unserialized;
REVOKE ALL ON FUNCTION public.pay_supplier_on_account_unserialized(uuid,uuid,numeric,text,date,text,text,text),
  public.pay_technician_on_account_unserialized(uuid,uuid,numeric,text,date,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.pay_supplier_on_account_atomic(p_supplier_id uuid,p_treasury_id uuid,p_amount numeric,
  p_payment_method text,p_date date,p_notes text DEFAULT NULL,p_reference text DEFAULT NULL,p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  v_result:=public.begin_workflow_request('supplier_payment',p_idempotency_key,
    jsonb_build_array(p_supplier_id,p_treasury_id,p_amount,p_payment_method,p_date,p_notes,p_reference));
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'المبلغ غير صحيح.'; END IF;
  PERFORM id FROM public.suppliers WHERE id=p_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المورد غير موجود.'; END IF;
  PERFORM id FROM public.treasuries WHERE id=p_treasury_id FOR UPDATE;
  PERFORM id FROM public.purchases WHERE supplier_id=p_supplier_id ORDER BY id FOR UPDATE;
  v_result:=public.pay_supplier_on_account_unserialized(p_supplier_id,p_treasury_id,p_amount,p_payment_method,p_date,p_notes,p_reference,
    auth.uid()::text || ':' || p_idempotency_key);
  RETURN public.finish_workflow_request('supplier_payment',p_idempotency_key,v_result);
END $$;

CREATE FUNCTION public.pay_technician_on_account_atomic(p_technician_id uuid,p_treasury_id uuid,p_amount numeric,
  p_payment_method text,p_date date,p_notes text DEFAULT NULL,p_reference text DEFAULT NULL,p_idempotency_key text DEFAULT NULL,p_context_project_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; v_work numeric; v_paid numeric;
BEGIN
  v_result:=public.begin_workflow_request('technician_payment',p_idempotency_key,
    jsonb_build_array(p_technician_id,p_treasury_id,p_amount,p_payment_method,p_date,p_notes,p_reference,p_context_project_id));
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'المبلغ غير صحيح.'; END IF;
  -- Match work-save order: optional project, party, then treasury.
  IF p_context_project_id IS NOT NULL THEN
    PERFORM id FROM public.projects WHERE id=p_context_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'المشروع المرجعي غير موجود.'; END IF;
  END IF;
  PERFORM id FROM public.technicians WHERE id=p_technician_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفني غير موجود.'; END IF;
  PERFORM id FROM public.treasuries WHERE id=p_treasury_id FOR UPDATE;
  v_result:=public.pay_technician_on_account_unserialized(p_technician_id,p_treasury_id,p_amount,p_payment_method,p_date,p_notes,p_reference,
    auth.uid()::text || ':' || p_idempotency_key,p_context_project_id);
  SELECT coalesce(sum(coalesce(nullif(total_cost,0),rate*coalesce(quantity,1))),0) INTO v_work
    FROM public.project_item_technicians WHERE technician_id=p_technician_id;
  v_work:=v_work+(SELECT coalesce(sum(total_amount),0) FROM public.purchases WHERE technician_id=p_technician_id);
  SELECT coalesce(sum(amount),0) INTO v_paid FROM public.technician_payments WHERE technician_id=p_technician_id AND status='completed';
  v_paid:=v_paid+(SELECT coalesce(sum(amount),0) FROM public.expenses WHERE technician_id=p_technician_id AND type='labor')
    +(SELECT coalesce(sum(pp.amount),0) FROM public.purchase_payments pp JOIN public.purchases p ON p.id=pp.purchase_id WHERE p.technician_id=p_technician_id);
  v_result:=v_result || jsonb_build_object('total_work',v_work,'total_paid',v_paid,'balance_after',v_work-v_paid);
  RETURN public.finish_workflow_request('technician_payment',p_idempotency_key,v_result);
END $$;
REVOKE ALL ON FUNCTION public.pay_supplier_on_account_atomic(uuid,uuid,numeric,text,date,text,text,text),
  public.pay_technician_on_account_atomic(uuid,uuid,numeric,text,date,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pay_supplier_on_account_atomic(uuid,uuid,numeric,text,date,text,text,text),
  public.pay_technician_on_account_atomic(uuid,uuid,numeric,text,date,text,text,text,uuid) TO authenticated;
