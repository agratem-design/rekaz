-- Migration: Flexible Contracting Technician Work & General Labor Support
CREATE OR REPLACE FUNCTION public.save_technician_work_v2(p_record_id uuid, p_payload jsonb, p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_result jsonb;
  v_project public.projects%ROWTYPE;
  v_id uuid;
  v_project_id uuid := (p_payload->>'project_id')::uuid;
  v_phase uuid := (p_payload->>'phase_id')::uuid;
  v_item uuid := nullif(trim(p_payload->>'project_item_id'), '')::uuid;
  v_tech uuid := (p_payload->>'technician_id')::uuid;
  v_qty numeric := (p_payload->>'quantity')::numeric;
  v_rate numeric := (p_payload->>'rate')::numeric;
  v_title text := nullif(trim(p_payload->>'title'), '');
BEGIN
  v_result := public.begin_workflow_request('technician_work', p_request_key, jsonb_build_object('id', p_record_id, 'data', p_payload));
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  IF v_qty IS NULL OR v_qty <= 0 OR v_rate IS NULL OR v_rate <= 0 OR v_qty::text IN ('NaN','Infinity','-Infinity')
    OR v_rate::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'الكمية والأجر يجب أن يكونا رقمين موجبين.';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = v_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المشروع غير موجود.'; END IF;

  PERFORM id FROM public.technicians WHERE id = v_tech FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفني غير موجود.'; END IF;

  IF v_phase IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_phases WHERE id = v_phase AND project_id = v_project_id) THEN
    RAISE EXCEPTION 'المرحلة لا تتبع المشروع.';
  END IF;

  -- Contracting project with BOQ item explicitly provided
  IF v_project.project_type = 'contracting' AND v_item IS NOT NULL THEN
    PERFORM id FROM public.project_items WHERE id = v_item AND project_id = v_project_id
      AND (v_phase IS NULL OR phase_id = v_phase) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'اختر بنداً من المشروع والمرحلة المحددين.'; END IF;

    IF p_record_id IS NOT NULL THEN
      -- Try finding in project_item_technicians
      SELECT id INTO v_id FROM public.project_item_technicians WHERE id = p_record_id AND project_item_id = v_item FOR UPDATE;
      IF NOT FOUND THEN
        -- Check if it's an existing purchase record
        SELECT id INTO v_id FROM public.purchases WHERE id = p_record_id AND project_id = v_project_id AND purchase_type = 'labor' FOR UPDATE;
        IF v_id IS NOT NULL THEN
          UPDATE public.purchases SET
            technician_id = v_tech,
            phase_id = v_phase,
            project_item_id = v_item,
            title = coalesce(v_title, 'عمل فني'),
            total_amount = v_qty * v_rate,
            date = coalesce((p_payload->>'date')::date, date),
            notes = p_payload->>'notes',
            items = jsonb_build_array(jsonb_build_object('name', coalesce(v_title, 'عمل فني'), 'qty', v_qty, 'price', v_rate)),
            status = CASE WHEN paid_amount >= v_qty * v_rate THEN 'paid' WHEN paid_amount > 0 THEN 'partial' ELSE 'pending' END
          WHERE id = v_id AND coalesce(paid_amount, 0) <= v_qty * v_rate;
          IF NOT FOUND THEN RAISE EXCEPTION 'العمل غير موجود أو قيمته الجديدة أقل من المبلغ المسدد.'; END IF;
          RETURN public.finish_workflow_request('technician_work', p_request_key, jsonb_build_object('id', v_id, 'success', true));
        ELSE
          RAISE EXCEPTION 'تعيين الفني غير موجود في البند.';
        END IF;
      END IF;
    ELSE
      SELECT id INTO v_id FROM public.project_item_technicians WHERE project_item_id = v_item AND technician_id = v_tech FOR UPDATE;
    END IF;

    IF v_id IS NOT NULL THEN
      UPDATE public.project_item_technicians SET
        technician_id = v_tech,
        rate = v_rate,
        quantity = v_qty,
        total_cost = v_rate * v_qty,
        notes = p_payload->>'notes'
      WHERE id = v_id;
    ELSE
      INSERT INTO public.project_item_technicians(project_item_id, technician_id, rate, quantity, total_cost, notes)
        VALUES(v_item, v_tech, v_rate, v_qty, v_rate * v_qty, p_payload->>'notes')
        RETURNING id INTO v_id;
    END IF;

  ELSE
    -- General labor (contracting without item, or finishing project)
    IF v_title IS NULL THEN RAISE EXCEPTION 'أدخل وصف العمل.'; END IF;

    IF p_record_id IS NOT NULL THEN
      UPDATE public.purchases SET
        technician_id = v_tech,
        phase_id = v_phase,
        project_item_id = v_item,
        title = v_title,
        total_amount = v_qty * v_rate,
        date = (p_payload->>'date')::date,
        notes = p_payload->>'notes',
        items = jsonb_build_array(jsonb_build_object('name', v_title, 'qty', v_qty, 'price', v_rate)),
        status = CASE WHEN paid_amount >= v_qty * v_rate THEN 'paid' WHEN paid_amount > 0 THEN 'partial' ELSE 'pending' END
      WHERE id = p_record_id AND project_id = v_project_id AND purchase_type = 'labor'
        AND coalesce(paid_amount, 0) <= v_qty * v_rate
      RETURNING id INTO v_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'العمل غير موجود أو قيمته الجديدة أقل من المبلغ المسدد.'; END IF;
    ELSE
      INSERT INTO public.purchases(project_id, phase_id, project_item_id, technician_id, purchase_type, title, total_amount, date, notes, items)
        VALUES(v_project_id, v_phase, v_item, v_tech, 'labor', v_title, v_qty * v_rate, (p_payload->>'date')::date, p_payload->>'notes',
          jsonb_build_array(jsonb_build_object('name', v_title, 'qty', v_qty, 'price', v_rate)))
        RETURNING id INTO v_id;
    END IF;
  END IF;

  RETURN public.finish_workflow_request('technician_work', p_request_key, jsonb_build_object('id', v_id, 'success', true));
END $$;

REVOKE ALL ON FUNCTION public.save_technician_work_v2(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_technician_work_v2(uuid, jsonb, text) TO authenticated;
