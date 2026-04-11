
-- 1. Remove duplicate treasury_transactions for client_payments (keep oldest)
DELETE FROM treasury_transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER(PARTITION BY reference_id, reference_type ORDER BY created_at ASC) as rn
    FROM treasury_transactions
    WHERE reference_type = 'client_payment'
  ) t
  WHERE t.rn > 1
);

-- 2. Update trigger function to check for existing transaction before inserting
CREATE OR REPLACE FUNCTION post_client_payment_to_treasury()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _client_name text;
  _project_name text;
  _existing_id uuid;
BEGIN
  IF NEW.treasury_id IS NOT NULL AND NEW.amount > 0 THEN
    -- Check if transaction already exists (prevent duplicates)
    SELECT id INTO _existing_id FROM treasury_transactions
    WHERE reference_id = NEW.id AND reference_type = 'client_payment' LIMIT 1;
    
    IF _existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT name INTO _client_name FROM clients WHERE id = NEW.client_id;
    SELECT name INTO _project_name FROM projects WHERE id = NEW.project_id;
    
    INSERT INTO treasury_transactions (
      treasury_id, type, amount, balance_after,
      description, reference_id, reference_type, date, source,
      client_id, project_id
    ) VALUES (
      NEW.treasury_id, 'deposit', NEW.amount, 0,
      'تسديد من ' || COALESCE(_client_name, 'زبون') || ' - ' || COALESCE(_project_name, ''),
      NEW.id, 'client_payment', NEW.date, 'client_payment',
      NEW.client_id, NEW.project_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Recalculate all treasury balances
UPDATE treasuries
SET balance = COALESCE((
  SELECT SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END)
  FROM treasury_transactions
  WHERE treasury_id = treasuries.id
), 0);
