CREATE FUNCTION public.apply_client_credit_v2(p_payload jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; v_id uuid; v_client uuid:=(p_payload->>'client_id')::uuid;
  v_project uuid:=(p_payload->>'project_id')::uuid; v_amount numeric:=(p_payload->>'amount')::numeric;
BEGIN
  v_result:=public.begin_workflow_request('apply_credit',p_request_key,p_payload);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF v_amount IS NULL OR v_amount<=0 OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'المبلغ غير صحيح.'; END IF;
  PERFORM id FROM public.clients WHERE id=v_client FOR UPDATE;
  PERFORM id FROM public.projects WHERE id=v_project AND client_id=v_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المشروع لا يتبع الزبون.'; END IF;
  IF v_amount>public.get_client_available_credit(v_client) THEN RAISE EXCEPTION 'رصيد الزبون المتاح غير كافٍ.'; END IF;
  IF v_amount>public.get_project_authoritative_remaining(v_project) THEN RAISE EXCEPTION 'المبلغ يتجاوز المتبقي على المشروع.'; END IF;
  INSERT INTO public.client_credit_ledger(client_id,entry_type,amount,target_project_id,notes,created_by)
    VALUES(v_client,'CREDIT_APPLIED',v_amount,v_project,p_payload->>'notes',auth.uid()) RETURNING id INTO v_id;
  RETURN public.finish_workflow_request('apply_credit',p_request_key,jsonb_build_object('success',true,'entry_id',v_id));
END $$;

CREATE OR REPLACE FUNCTION public.reverse_client_credit_application(p_entry_id uuid,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_entry public.client_credit_ledger%ROWTYPE; v_client uuid; v_id uuid;
BEGIN
  PERFORM public.require_finance_actor();
  SELECT client_id INTO v_client FROM public.client_credit_ledger WHERE id=p_entry_id;
  PERFORM id FROM public.clients WHERE id=v_client FOR UPDATE;
  SELECT * INTO v_entry FROM public.client_credit_ledger WHERE id=p_entry_id;
  IF NOT FOUND OR v_entry.entry_type<>'CREDIT_APPLIED' THEN RAISE EXCEPTION 'سجل تطبيق الرصيد غير موجود.'; END IF;
  IF EXISTS(SELECT 1 FROM public.client_credit_ledger WHERE reference_entry_id=p_entry_id AND entry_type='CREDIT_APPLICATION_REVERSED') THEN
    RETURN jsonb_build_object('success',true,'already_reversed',true);
  END IF;
  PERFORM id FROM public.projects WHERE id=v_entry.target_project_id FOR UPDATE;
  INSERT INTO public.client_credit_ledger(client_id,entry_type,amount,target_project_id,reference_entry_id,notes,created_by)
    VALUES(v_client,'CREDIT_APPLICATION_REVERSED',v_entry.amount,v_entry.target_project_id,p_entry_id,p_notes,auth.uid()) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'entry_id',v_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_client_credit(uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_client_credit_v2(jsonb,text),public.reverse_client_credit_application(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_client_credit_v2(jsonb,text),public.reverse_client_credit_application(uuid,text) TO authenticated;

-- Incoming deposits are liabilities held for technicians, not negative work payments
-- or income. Refunds append another event; neither event can be edited or deleted.
CREATE TABLE public.technician_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE RESTRICT,
  treasury_id uuid NOT NULL REFERENCES public.treasuries(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK(entry_type IN ('receipt','refund')),
  amount numeric NOT NULL CHECK(amount>0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')),
  date date NOT NULL DEFAULT current_date,payment_method text NOT NULL DEFAULT 'cash',notes text,
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX technician_deposits_party_idx ON public.technician_deposits(technician_id,date);
ALTER TABLE public.technician_deposits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technician_deposits FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.technician_deposits TO authenticated;
CREATE POLICY technician_deposits_finance_read ON public.technician_deposits FOR SELECT TO authenticated
  USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));
CREATE FUNCTION public.prevent_deposit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'سجل الودائع غير قابل للتعديل أو الحذف. استخدم حركة رد الوديعة.'; END $$;
CREATE TRIGGER technician_deposits_immutable BEFORE UPDATE OR DELETE ON public.technician_deposits
  FOR EACH ROW EXECUTE FUNCTION public.prevent_deposit_mutation();

CREATE FUNCTION public.record_technician_deposit_v2(p_payload jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; v_id uuid; v_tech uuid:=(p_payload->>'technician_id')::uuid;
  v_treasury uuid:=(p_payload->>'treasury_id')::uuid; v_type text:=p_payload->>'entry_type';
  v_amount numeric:=(p_payload->>'amount')::numeric; v_available numeric;
BEGIN
  v_result:=public.begin_workflow_request('technician_deposit',p_request_key,p_payload);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF v_type IS NULL OR v_type NOT IN ('receipt','refund') OR v_amount IS NULL OR v_amount<=0
    OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'بيانات الوديعة غير صحيحة.'; END IF;
  PERFORM id FROM public.technicians WHERE id=v_tech FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفني غير موجود.'; END IF;
  PERFORM id FROM public.treasuries WHERE id=v_treasury AND is_active IS NOT FALSE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'اختر خزينة نشطة.'; END IF;
  SELECT coalesce(sum(CASE WHEN entry_type='receipt' THEN amount ELSE -amount END),0) INTO v_available
    FROM public.technician_deposits WHERE technician_id=v_tech;
  IF v_type='refund' AND v_amount>v_available THEN RAISE EXCEPTION 'المبلغ يتجاوز رصيد الوديعة المتاح للفني.'; END IF;
  INSERT INTO public.technician_deposits(technician_id,treasury_id,entry_type,amount,date,payment_method,notes,created_by)
    VALUES(v_tech,v_treasury,v_type,v_amount,coalesce((p_payload->>'date')::date,current_date),
      coalesce(p_payload->>'payment_method','cash'),p_payload->>'notes',auth.uid()) RETURNING id INTO v_id;
  INSERT INTO public.treasury_transactions(treasury_id,type,amount,balance_after,description,date,source,reference_type,reference_id,notes)
    VALUES(v_treasury,CASE WHEN v_type='receipt' THEN 'deposit' ELSE 'withdrawal' END,v_amount,0,
      CASE WHEN v_type='receipt' THEN 'استلام وديعة من الفني' ELSE 'رد وديعة للفني' END,
      coalesce((p_payload->>'date')::date,current_date),'technician_deposit','technician_deposit',v_id,p_payload->>'notes');
  UPDATE public.treasuries SET balance=(SELECT coalesce(sum(CASE WHEN type='deposit' THEN amount ELSE -amount END),0)
    FROM public.treasury_transactions WHERE treasury_id=v_treasury) WHERE id=v_treasury;
  UPDATE public.treasury_transactions SET balance_after=(SELECT balance FROM public.treasuries WHERE id=v_treasury)
    WHERE reference_type='technician_deposit' AND reference_id=v_id;
  RETURN public.finish_workflow_request('technician_deposit',p_request_key,jsonb_build_object('success',true,'id',v_id));
END $$;
REVOKE ALL ON FUNCTION public.record_technician_deposit_v2(jsonb,text),public.prevent_deposit_mutation() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_technician_deposit_v2(jsonb,text) TO authenticated;
