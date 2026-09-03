-- Save the item and its optional technician assignment as one transaction.
CREATE FUNCTION public.save_project_item_atomic(p_item_id uuid,p_payload jsonb,p_technician jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; v_item public.project_items%ROWTYPE; v_id uuid;
  v_tech uuid; v_rate numeric; v_qty numeric;
BEGIN
  v_result := public.begin_workflow_request('project_item',p_request_key,
    jsonb_build_object('id',p_item_id,'data',p_payload,'technician',p_technician));
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  v_item := jsonb_populate_record(NULL::public.project_items,p_payload);
  IF nullif(trim(v_item.name),'') IS NULL OR v_item.quantity IS NULL OR v_item.quantity < 0
    OR v_item.unit_price IS NULL OR v_item.unit_price < 0 OR v_item.total_price IS NULL OR v_item.total_price < 0
    OR v_item.quantity::text IN ('NaN','Infinity','-Infinity') OR v_item.unit_price::text IN ('NaN','Infinity','-Infinity')
    OR v_item.total_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'تحقق من اسم البند والكمية والسعر.'; END IF;
  PERFORM id FROM public.projects WHERE id=v_item.project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المشروع غير موجود.'; END IF;
  IF v_item.phase_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_phases WHERE id=v_item.phase_id AND project_id=v_item.project_id) THEN
    RAISE EXCEPTION 'المرحلة لا تتبع المشروع.';
  END IF;
  IF p_item_id IS NULL THEN
    INSERT INTO public.project_items(project_id,phase_id,name,description,measurement_type,quantity,unit_price,total_price,
      engineer_id,formula,length,width,height,notes,measurement_factor,measurement_config_id,component_values,general_item_id)
    VALUES(v_item.project_id,v_item.phase_id,v_item.name,v_item.description,v_item.measurement_type,v_item.quantity,v_item.unit_price,v_item.total_price,
      v_item.engineer_id,v_item.formula,v_item.length,v_item.width,v_item.height,v_item.notes,v_item.measurement_factor,v_item.measurement_config_id,v_item.component_values,v_item.general_item_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.project_items SET phase_id=v_item.phase_id,name=v_item.name,description=v_item.description,
      measurement_type=v_item.measurement_type,quantity=v_item.quantity,unit_price=v_item.unit_price,total_price=v_item.total_price,
      engineer_id=v_item.engineer_id,formula=v_item.formula,length=v_item.length,width=v_item.width,height=v_item.height,
      notes=v_item.notes,measurement_factor=v_item.measurement_factor,measurement_config_id=v_item.measurement_config_id,component_values=v_item.component_values
    WHERE id=p_item_id AND project_id=v_item.project_id RETURNING id INTO v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'البند غير موجود في المشروع.'; END IF;
  END IF;
  IF p_technician IS NOT NULL AND p_technician <> 'null'::jsonb THEN
    v_tech := (p_technician->>'technician_id')::uuid;
    v_rate := (p_technician->>'rate')::numeric; v_qty := (p_technician->>'quantity')::numeric;
    IF v_tech IS NULL OR v_rate IS NULL OR v_rate < 0 OR v_qty IS NULL OR v_qty < 0
      OR v_rate::text IN ('NaN','Infinity','-Infinity') OR v_qty::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'بيانات تكلفة الفني غير صحيحة.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.project_item_technicians WHERE project_item_id=v_id AND technician_id=v_tech) THEN
      RAISE EXCEPTION 'الفني معيّن بالفعل لهذا البند. عدّل تعيينه الحالي بدلاً من إضافته مرة أخرى.';
    END IF;
    INSERT INTO public.project_item_technicians(project_item_id,technician_id,rate_type,rate,quantity,total_cost)
      VALUES(v_id,v_tech,coalesce(p_technician->>'rate_type','meter'),v_rate,v_qty,v_rate*v_qty);
  END IF;
  RETURN public.finish_workflow_request('project_item',p_request_key,jsonb_build_object('id',v_id,'success',true));
END $$;

CREATE FUNCTION public.delete_project_items_atomic(p_project_id uuid,p_item_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer; v_progress numeric;
BEGIN
  PERFORM public.require_finance_actor();
  PERFORM id FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المشروع غير موجود.'; END IF;
  IF coalesce(cardinality(p_item_ids),0)=0 THEN RAISE EXCEPTION 'اختر بنداً للحذف.'; END IF;
  IF EXISTS(SELECT 1 FROM public.project_items WHERE id=ANY(p_item_ids) AND project_id<>p_project_id) THEN
    RAISE EXCEPTION 'لا يمكن حذف بند من مشروع آخر.';
  END IF;
  PERFORM id FROM public.project_items WHERE id=ANY(p_item_ids) ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.purchases WHERE project_item_id=ANY(p_item_ids))
    OR EXISTS(SELECT 1 FROM public.technician_progress_records WHERE project_item_id=ANY(p_item_ids)) THEN
    RAISE EXCEPTION 'توجد مشتريات أو سجلات عمل مرتبطة بالبند. راجعها قبل حذفه.';
  END IF;
  DELETE FROM public.project_item_technicians WHERE project_item_id=ANY(p_item_ids);
  DELETE FROM public.project_items WHERE id=ANY(p_item_ids) AND project_id=p_project_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  SELECT CASE WHEN sum(quantity)>0 THEN round(sum(coalesce(progress,0)*quantity)/sum(quantity))
    ELSE coalesce(round(avg(coalesce(progress,0))),0) END INTO v_progress
    FROM public.project_items WHERE project_id=p_project_id;
  UPDATE public.projects SET progress=v_progress WHERE id=p_project_id;
  RETURN jsonb_build_object('success',true,'deleted_count',v_count);
END $$;

CREATE FUNCTION public.save_technician_work_v2(p_record_id uuid,p_payload jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; v_project public.projects%ROWTYPE; v_id uuid;
  v_project_id uuid:=(p_payload->>'project_id')::uuid; v_phase uuid:=(p_payload->>'phase_id')::uuid;
  v_item uuid:=(p_payload->>'project_item_id')::uuid; v_tech uuid:=(p_payload->>'technician_id')::uuid;
  v_qty numeric:=(p_payload->>'quantity')::numeric; v_rate numeric:=(p_payload->>'rate')::numeric;
BEGIN
  v_result:=public.begin_workflow_request('technician_work',p_request_key,jsonb_build_object('id',p_record_id,'data',p_payload));
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF v_qty IS NULL OR v_qty<=0 OR v_rate IS NULL OR v_rate<=0 OR v_qty::text IN ('NaN','Infinity','-Infinity')
    OR v_rate::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'الكمية والأجر يجب أن يكونا رقمين موجبين.'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id=v_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المشروع غير موجود.'; END IF;
  PERFORM id FROM public.technicians WHERE id=v_tech FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفني غير موجود.'; END IF;
  IF v_phase IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_phases WHERE id=v_phase AND project_id=v_project_id) THEN
    RAISE EXCEPTION 'المرحلة لا تتبع المشروع.';
  END IF;
  IF v_project.project_type='contracting' THEN
    PERFORM id FROM public.project_items WHERE id=v_item AND project_id=v_project_id
      AND (v_phase IS NULL OR phase_id=v_phase) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'اختر بنداً من المشروع والمرحلة المحددين.'; END IF;
    IF p_record_id IS NOT NULL THEN
      SELECT id INTO v_id FROM public.project_item_technicians WHERE id=p_record_id AND project_item_id=v_item FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'تعيين الفني غير موجود في البند.'; END IF;
    ELSE
      SELECT id INTO v_id FROM public.project_item_technicians WHERE project_item_id=v_item AND technician_id=v_tech FOR UPDATE;
    END IF;
    IF v_id IS NOT NULL THEN
      UPDATE public.project_item_technicians SET technician_id=v_tech,rate=v_rate,quantity=v_qty,total_cost=v_rate*v_qty,notes=p_payload->>'notes' WHERE id=v_id;
    ELSE
      INSERT INTO public.project_item_technicians(project_item_id,technician_id,rate,quantity,total_cost,notes)
        VALUES(v_item,v_tech,v_rate,v_qty,v_rate*v_qty,p_payload->>'notes') RETURNING id INTO v_id;
    END IF;
  ELSE
    IF nullif(trim(p_payload->>'title'),'') IS NULL THEN RAISE EXCEPTION 'أدخل وصف العمل.'; END IF;
    IF p_record_id IS NOT NULL THEN
      UPDATE public.purchases SET technician_id=v_tech,phase_id=v_phase,title=p_payload->>'title',
        total_amount=v_qty*v_rate,date=(p_payload->>'date')::date,notes=p_payload->>'notes',
        items=jsonb_build_array(jsonb_build_object('name',p_payload->>'title','qty',v_qty,'price',v_rate)),
        status=CASE WHEN paid_amount>=v_qty*v_rate THEN 'paid' WHEN paid_amount>0 THEN 'partial' ELSE 'pending' END
      WHERE id=p_record_id AND project_id=v_project_id AND purchase_type='labor'
        AND coalesce(paid_amount,0)<=v_qty*v_rate RETURNING id INTO v_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'العمل غير موجود أو قيمته الجديدة أقل من المبلغ المسدد.'; END IF;
    ELSE
      INSERT INTO public.purchases(project_id,phase_id,technician_id,purchase_type,title,total_amount,date,notes,items)
        VALUES(v_project_id,v_phase,v_tech,'labor',p_payload->>'title',v_qty*v_rate,(p_payload->>'date')::date,p_payload->>'notes',
          jsonb_build_array(jsonb_build_object('name',p_payload->>'title','qty',v_qty,'price',v_rate))) RETURNING id INTO v_id;
    END IF;
  END IF;
  RETURN public.finish_workflow_request('technician_work',p_request_key,jsonb_build_object('id',v_id,'success',true));
END $$;

REVOKE ALL ON FUNCTION public.save_project_item_atomic(uuid,jsonb,jsonb,text),public.delete_project_items_atomic(uuid,uuid[]),
  public.save_technician_work_v2(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_project_item_atomic(uuid,jsonb,jsonb,text),public.delete_project_items_atomic(uuid,uuid[]),
  public.save_technician_work_v2(uuid,jsonb,text) TO authenticated;
