
-- 1. Add reference_id column to income table for linking to source records
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS reference_id uuid;

-- 2. Create trigger function to auto-update projects.spent
CREATE OR REPLACE FUNCTION public.update_project_spent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_project_id uuid;
  total_spent numeric;
BEGIN
  -- Determine the affected project_id
  IF TG_OP = 'DELETE' THEN
    affected_project_id := OLD.project_id;
  ELSE
    affected_project_id := NEW.project_id;
  END IF;

  -- Skip if no project_id
  IF affected_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate total spent from all sources
  SELECT COALESCE(
    (SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE project_id = affected_project_id),
    0
  ) + COALESCE(
    (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE project_id = affected_project_id),
    0
  ) + COALESCE(
    (SELECT COALESCE(SUM(total_amount), 0) FROM equipment_rentals WHERE project_id = affected_project_id),
    0
  ) + COALESCE(
    (SELECT COALESCE(SUM(amount), 0) FROM project_custody WHERE project_id = affected_project_id),
    0
  )
  INTO total_spent;

  UPDATE projects SET spent = total_spent WHERE id = affected_project_id;

  -- Handle UPDATE where project_id changed
  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id AND OLD.project_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE project_id = OLD.project_id),
      0
    ) + COALESCE(
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE project_id = OLD.project_id),
      0
    ) + COALESCE(
      (SELECT COALESCE(SUM(total_amount), 0) FROM equipment_rentals WHERE project_id = OLD.project_id),
      0
    ) + COALESCE(
      (SELECT COALESCE(SUM(amount), 0) FROM project_custody WHERE project_id = OLD.project_id),
      0
    )
    INTO total_spent;

    UPDATE projects SET spent = total_spent WHERE id = OLD.project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Attach triggers to all spending tables
CREATE TRIGGER trg_purchases_update_spent
AFTER INSERT OR UPDATE OR DELETE ON purchases
FOR EACH ROW EXECUTE FUNCTION update_project_spent();

CREATE TRIGGER trg_expenses_update_spent
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_project_spent();

CREATE TRIGGER trg_rentals_update_spent
AFTER INSERT OR UPDATE OR DELETE ON equipment_rentals
FOR EACH ROW EXECUTE FUNCTION update_project_spent();

CREATE TRIGGER trg_custody_update_spent
AFTER INSERT OR UPDATE OR DELETE ON project_custody
FOR EACH ROW EXECUTE FUNCTION update_project_spent();
