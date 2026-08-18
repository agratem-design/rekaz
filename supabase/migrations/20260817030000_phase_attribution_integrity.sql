-- ============================================================================
-- PHASE ATTRIBUTION INTEGRITY & PROJECT BOUNDARY ENFORCEMENT
-- Enforces:
-- 1. phase_id on purchases/expenses must belong to the same project_id.
-- 2. If both project_item_id and phase_id are set, they must not conflict with item.phase_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_phase_attribution_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_phase_project_id uuid;
    v_item_phase_id uuid;
    v_item_project_id uuid;
BEGIN
    -- 1. If phase_id is set, ensure the phase belongs to the same project
    IF NEW.phase_id IS NOT NULL THEN
        SELECT project_id INTO v_phase_project_id
        FROM public.project_phases
        WHERE id = NEW.phase_id;

        IF v_phase_project_id IS NOT NULL AND NEW.project_id IS NOT NULL AND v_phase_project_id != NEW.project_id THEN
            RAISE EXCEPTION 'INVALID_PHASE_PROJECT: Phase (%) belongs to project (%) not project (%)', NEW.phase_id, v_phase_project_id, NEW.project_id;
        END IF;
    END IF;

    -- 2. If project_item_id is set, check for phase conflict
    IF NEW.project_item_id IS NOT NULL THEN
        SELECT project_id, phase_id INTO v_item_project_id, v_item_phase_id
        FROM public.project_items
        WHERE id = NEW.project_item_id;

        -- Ensure item belongs to same project
        IF v_item_project_id IS NOT NULL AND NEW.project_id IS NOT NULL AND v_item_project_id != NEW.project_id THEN
            RAISE EXCEPTION 'INVALID_ITEM_PROJECT: Project item (%) belongs to project (%) not project (%)', NEW.project_item_id, v_item_project_id, NEW.project_id;
        END IF;

        -- If both purchase/expense phase_id and item phase_id are explicitly set, they must match
        IF NEW.phase_id IS NOT NULL AND v_item_phase_id IS NOT NULL AND NEW.phase_id != v_item_phase_id THEN
            RAISE EXCEPTION 'PHASE_ATTRIBUTION_CONFLICT: Operation phase (%) conflicts with item phase (%)', NEW.phase_id, v_item_phase_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_purchase_phase_integrity ON public.purchases;
CREATE TRIGGER trg_validate_purchase_phase_integrity
BEFORE INSERT OR UPDATE OF project_id, phase_id, project_item_id ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.validate_phase_attribution_integrity();

DROP TRIGGER IF EXISTS trg_validate_expense_phase_integrity ON public.expenses;
CREATE TRIGGER trg_validate_expense_phase_integrity
BEFORE INSERT OR UPDATE OF project_id, phase_id, project_item_id ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.validate_phase_attribution_integrity();
