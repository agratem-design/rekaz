-- Function to update custody spent amount from purchases
CREATE OR REPLACE FUNCTION public.update_custody_from_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_custody_id uuid;
  new_custody_id uuid;
  old_amount numeric;
  new_amount numeric;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.fund_source = 'custody' AND OLD.custody_id IS NOT NULL THEN
      UPDATE project_custody
      SET spent_amount = spent_amount - OLD.total_amount,
          remaining_amount = amount - (spent_amount - OLD.total_amount)
      WHERE id = OLD.custody_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.fund_source = 'custody' AND NEW.custody_id IS NOT NULL THEN
      UPDATE project_custody
      SET spent_amount = spent_amount + NEW.total_amount,
          remaining_amount = amount - (spent_amount + NEW.total_amount)
      WHERE id = NEW.custody_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    old_custody_id := OLD.custody_id;
    new_custody_id := NEW.custody_id;
    old_amount := COALESCE(OLD.total_amount, 0);
    new_amount := COALESCE(NEW.total_amount, 0);

    -- If custody changed or fund_source changed
    IF (OLD.fund_source = 'custody' AND OLD.custody_id IS NOT NULL) AND 
       (NEW.fund_source != 'custody' OR NEW.custody_id IS NULL OR NEW.custody_id != OLD.custody_id) THEN
      -- Remove from old custody
      UPDATE project_custody
      SET spent_amount = spent_amount - old_amount,
          remaining_amount = amount - (spent_amount - old_amount)
      WHERE id = old_custody_id;
    END IF;

    IF NEW.fund_source = 'custody' AND NEW.custody_id IS NOT NULL THEN
      IF OLD.fund_source = 'custody' AND OLD.custody_id = NEW.custody_id THEN
        -- Same custody, update difference
        UPDATE project_custody
        SET spent_amount = spent_amount - old_amount + new_amount,
            remaining_amount = amount - (spent_amount - old_amount + new_amount)
        WHERE id = new_custody_id;
      ELSE
        -- New custody
        UPDATE project_custody
        SET spent_amount = spent_amount + new_amount,
            remaining_amount = amount - (spent_amount + new_amount)
        WHERE id = new_custody_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Function to update custody spent amount from equipment rentals
CREATE OR REPLACE FUNCTION public.update_custody_from_rental()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_custody_id uuid;
  new_custody_id uuid;
  old_amount numeric;
  new_amount numeric;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.fund_source = 'custody' AND OLD.custody_id IS NOT NULL THEN
      UPDATE project_custody
      SET spent_amount = spent_amount - COALESCE(OLD.total_amount, 0),
          remaining_amount = amount - (spent_amount - COALESCE(OLD.total_amount, 0))
      WHERE id = OLD.custody_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.fund_source = 'custody' AND NEW.custody_id IS NOT NULL THEN
      UPDATE project_custody
      SET spent_amount = spent_amount + COALESCE(NEW.total_amount, 0),
          remaining_amount = amount - (spent_amount + COALESCE(NEW.total_amount, 0))
      WHERE id = NEW.custody_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    old_custody_id := OLD.custody_id;
    new_custody_id := NEW.custody_id;
    old_amount := COALESCE(OLD.total_amount, 0);
    new_amount := COALESCE(NEW.total_amount, 0);

    -- If custody changed or fund_source changed
    IF (OLD.fund_source = 'custody' AND OLD.custody_id IS NOT NULL) AND 
       (NEW.fund_source != 'custody' OR NEW.custody_id IS NULL OR NEW.custody_id != OLD.custody_id) THEN
      -- Remove from old custody
      UPDATE project_custody
      SET spent_amount = spent_amount - old_amount,
          remaining_amount = amount - (spent_amount - old_amount)
      WHERE id = old_custody_id;
    END IF;

    IF NEW.fund_source = 'custody' AND NEW.custody_id IS NOT NULL THEN
      IF OLD.fund_source = 'custody' AND OLD.custody_id = NEW.custody_id THEN
        -- Same custody, update difference
        UPDATE project_custody
        SET spent_amount = spent_amount - old_amount + new_amount,
            remaining_amount = amount - (spent_amount - old_amount + new_amount)
        WHERE id = new_custody_id;
      ELSE
        -- New custody
        UPDATE project_custody
        SET spent_amount = spent_amount + new_amount,
            remaining_amount = amount - (spent_amount + new_amount)
        WHERE id = new_custody_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Create triggers for purchases
DROP TRIGGER IF EXISTS trigger_update_custody_from_purchase ON purchases;
CREATE TRIGGER trigger_update_custody_from_purchase
  AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_custody_from_purchase();

-- Create triggers for equipment rentals
DROP TRIGGER IF EXISTS trigger_update_custody_from_rental ON equipment_rentals;
CREATE TRIGGER trigger_update_custody_from_rental
  AFTER INSERT OR UPDATE OR DELETE ON equipment_rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_custody_from_rental();