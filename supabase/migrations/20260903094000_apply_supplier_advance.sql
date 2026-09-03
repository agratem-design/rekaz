-- Apply already-paid supplier advances to a chosen invoice; never move cash again.
CREATE FUNCTION public.apply_supplier_advance_v2(p_supplier_id uuid,p_purchase_id uuid,p_amount numeric,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; v_invoice public.purchases%ROWTYPE; v_payment record;
  v_paid numeric; v_remaining numeric:=p_amount; v_available numeric; v_take numeric;
  v_domain text; v_project_type text;
BEGIN
  v_result:=public.begin_workflow_request('supplier_advance_application',p_request_key,
    jsonb_build_array(p_supplier_id,p_purchase_id,p_amount));
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'مبلغ التسوية يجب أن يكون رقماً موجباً.';
  END IF;
  PERFORM id FROM public.suppliers WHERE id=p_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المورد غير موجود.'; END IF;
  SELECT * INTO v_invoice FROM public.purchases WHERE id=p_purchase_id FOR UPDATE;
  IF NOT FOUND OR v_invoice.supplier_id IS DISTINCT FROM p_supplier_id THEN
    RAISE EXCEPTION 'الفاتورة لا تخص هذا المورد.';
  END IF;
  SELECT project_type INTO v_project_type FROM public.projects WHERE id=v_invoice.project_id;
  SELECT coalesce((SELECT sum(amount) FROM public.supplier_payment_allocations WHERE purchase_id=p_purchase_id),0)
    +coalesce((SELECT sum(amount) FROM public.purchase_payments WHERE purchase_id=p_purchase_id),0) INTO v_paid;
  IF p_amount > greatest(0,v_invoice.total_amount-v_paid) THEN
    RAISE EXCEPTION 'المبلغ يتجاوز المتبقي على الفاتورة.';
  END IF;
  FOR v_payment IN SELECT * FROM public.supplier_payments WHERE supplier_id=p_supplier_id ORDER BY date,id FOR UPDATE LOOP
    SELECT root_domain INTO v_domain FROM public.get_treasury_root_domain(v_payment.treasury_id);
    IF v_domain IS NOT NULL AND v_domain IS DISTINCT FROM v_project_type THEN CONTINUE; END IF;
    SELECT greatest(0,v_payment.amount-coalesce(sum(amount),0)) INTO v_available
      FROM public.supplier_payment_allocations WHERE payment_id=v_payment.id;
    v_take:=least(v_available,v_remaining);
    IF v_take>0 THEN
      INSERT INTO public.supplier_payment_allocations(payment_id,purchase_id,amount) VALUES(v_payment.id,p_purchase_id,v_take);
      v_remaining:=v_remaining-v_take;
    END IF;
    EXIT WHEN v_remaining=0;
  END LOOP;
  IF v_remaining>0 THEN
    RAISE EXCEPTION 'الرصيد المقدم المتاح من خزائن قطاع المشروع لا يكفي. لم يتم تغيير أي تسوية.';
  END IF;
  UPDATE public.purchases SET paid_amount=v_paid+p_amount,
    status=CASE WHEN v_paid+p_amount>=total_amount THEN 'paid' ELSE 'partial' END WHERE id=p_purchase_id;
  RETURN public.finish_workflow_request('supplier_advance_application',p_request_key,
    jsonb_build_object('success',true,'purchase_id',p_purchase_id,'amount',p_amount,'cash_movement',0));
END $$;
REVOKE ALL ON FUNCTION public.apply_supplier_advance_v2(uuid,uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_supplier_advance_v2(uuid,uuid,numeric,text) TO authenticated;
