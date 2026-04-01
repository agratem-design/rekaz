
-- Fix infinite trigger recursion by adding pg_trigger_depth() guard

CREATE OR REPLACE FUNCTION public.update_balance_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  -- Guard against recursive trigger calls
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  UPDATE treasury_transactions
  SET balance_after = (SELECT balance FROM treasuries WHERE id = NEW.treasury_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_sync_treasury_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  affected_treasury_id UUID;
BEGIN
  -- Guard against recursive trigger calls
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    affected_treasury_id := OLD.treasury_id;
  ELSE
    affected_treasury_id := NEW.treasury_id;
  END IF;

  UPDATE treasuries
  SET balance = (
    SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
    FROM treasury_transactions
    WHERE treasury_id = affected_treasury_id
  )
  WHERE id = affected_treasury_id;

  IF TG_OP = 'UPDATE' AND OLD.treasury_id != NEW.treasury_id THEN
    UPDATE treasuries
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM treasury_transactions
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
