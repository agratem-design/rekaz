-- Migration: 20260903100000_finishing_technician_additive_and_cash_flow.sql
-- Ensure finishing technician labor from assigned project items and labor purchases are additive rather than exclusive fallbacks.

CREATE OR REPLACE FUNCTION public.get_project_authoritative_remaining(p_project_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_cost numeric;
  v_work numeric;
  v_item_work numeric;
  v_progress_work numeric;
  v_labor_work numeric;
  v_obligation numeric;
  v_cash numeric;
  v_excess numeric;
  v_credit numeric;
  v_rentals numeric;
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
    
    -- Additive technician work: assigned items + finishing labor purchases
    SELECT coalesce(sum(coalesce(nullif(t.total_cost,0), t.rate * coalesce(t.quantity,1))),0)
      INTO v_item_work FROM public.project_item_technicians t JOIN public.project_items i ON i.id = t.project_item_id
      WHERE i.project_id = p_project_id;
      
    SELECT coalesce(sum(earned_amount),0) INTO v_progress_work FROM public.technician_progress_records WHERE project_id = p_project_id;
    
    SELECT coalesce(sum(total_amount),0) INTO v_labor_work FROM public.purchases
      WHERE project_id = p_project_id AND (technician_id IS NOT NULL OR purchase_type = 'labor')
        AND rental_id IS NULL AND purchase_type IS DISTINCT FROM 'rental';
        
    v_work := v_item_work + CASE WHEN v_progress_work > 0 THEN v_progress_work ELSE v_labor_work END;
    
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

REVOKE ALL ON FUNCTION public.get_project_authoritative_remaining(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_authoritative_remaining(uuid) TO authenticated;
