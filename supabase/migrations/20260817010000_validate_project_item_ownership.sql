-- Migration: 20260817010000_validate_project_item_ownership.sql
-- Description: Enforces server-side ownership validation for project_item_id on purchases and expenses

CREATE OR REPLACE FUNCTION public.validate_project_item_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_project_id UUID;
BEGIN
  -- If project_item_id is provided, verify it belongs to NEW.project_id
  IF NEW.project_item_id IS NOT NULL THEN
    IF NEW.project_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PROJECT_ITEM_OWNERSHIP: project_item_id cannot be set when project_id is NULL'
        USING ERRCODE = '23503';
    END IF;

    SELECT project_id INTO v_item_project_id
    FROM public.project_items
    WHERE id = NEW.project_item_id;

    IF v_item_project_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PROJECT_ITEM_OWNERSHIP: Project item % does not exist', NEW.project_item_id
        USING ERRCODE = '23503';
    END IF;

    IF v_item_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'INVALID_PROJECT_ITEM_OWNERSHIP: Item % belongs to project %, but transaction is for project %',
        NEW.project_item_id, v_item_project_id, NEW.project_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on purchases table
DROP TRIGGER IF EXISTS trg_validate_purchase_item_ownership ON public.purchases;
CREATE TRIGGER trg_validate_purchase_item_ownership
  BEFORE INSERT OR UPDATE OF project_id, project_item_id
  ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_project_item_ownership();

-- Trigger on expenses table
DROP TRIGGER IF EXISTS trg_validate_expense_item_ownership ON public.expenses;
CREATE TRIGGER trg_validate_expense_item_ownership
  BEFORE INSERT OR UPDATE OF project_id, project_item_id
  ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_project_item_ownership();
