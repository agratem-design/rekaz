CREATE OR REPLACE FUNCTION public.auto_sync_treasury_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_treasury_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    affected_treasury_id := OLD.treasury_id;
  ELSE
    affected_treasury_id := NEW.treasury_id;
  END IF;

  IF affected_treasury_id IS NOT NULL THEN
    UPDATE public.treasuries
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM public.treasury_transactions
      WHERE treasury_id = affected_treasury_id
    )
    WHERE id = affected_treasury_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.treasury_id IS DISTINCT FROM NEW.treasury_id AND OLD.treasury_id IS NOT NULL THEN
    UPDATE public.treasuries
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM public.treasury_transactions
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_balance_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE public.treasury_transactions
  SET balance_after = (
    SELECT balance FROM public.treasuries WHERE id = NEW.treasury_id
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_client_payment_to_treasury()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _client_name text;
  _project_name text;
  _existing_id uuid;
BEGIN
  IF NEW.treasury_id IS NULL OR COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _existing_id
  FROM public.treasury_transactions
  WHERE reference_id = NEW.id AND reference_type = 'client_payment'
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
  SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;

  INSERT INTO public.treasury_transactions (
    treasury_id, type, amount, balance_after,
    description, reference_id, reference_type, date, source,
    client_id, project_id
  ) VALUES (
    NEW.treasury_id, 'deposit', NEW.amount, 0,
    'تسديد من ' || COALESCE(_client_name, 'زبون') || ' - ' || COALESCE(_project_name, ''),
    NEW.id, 'client_payment', NEW.date, 'client_payment',
    NEW.client_id, NEW.project_id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_treasury_transactions_sync_balance ON public.treasury_transactions;
CREATE TRIGGER trg_treasury_transactions_sync_balance
AFTER INSERT OR UPDATE OR DELETE ON public.treasury_transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_sync_treasury_balance();

DROP TRIGGER IF EXISTS trg_treasury_transactions_update_balance_after ON public.treasury_transactions;
CREATE TRIGGER trg_treasury_transactions_update_balance_after
AFTER INSERT OR UPDATE ON public.treasury_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_balance_after();

DROP TRIGGER IF EXISTS trg_client_payment_treasury ON public.client_payments;
CREATE TRIGGER trg_client_payment_treasury
AFTER INSERT ON public.client_payments
FOR EACH ROW
EXECUTE FUNCTION public.post_client_payment_to_treasury();

UPDATE public.treasuries t
SET balance = COALESCE(src.balance, 0)
FROM (
  SELECT treasury_id,
         COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) AS balance
  FROM public.treasury_transactions
  GROUP BY treasury_id
) src
WHERE src.treasury_id = t.id;

UPDATE public.treasuries
SET balance = 0
WHERE id NOT IN (
  SELECT DISTINCT treasury_id
  FROM public.treasury_transactions
  WHERE treasury_id IS NOT NULL
);