
-- Bug 1: Add supervision mode columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS supervision_mode text NOT NULL DEFAULT 'percentage';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS supervision_amount numeric DEFAULT 0;

-- Bug 2: Fix purchase trigger to skip returns
CREATE OR REPLACE FUNCTION public.handle_purchase_treasury_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  expected_amount NUMERIC;
  existing_tx RECORD;
BEGIN
  -- Skip return purchases - they handle their own treasury transactions
  IF NEW.is_return = true THEN
    RETURN NEW;
  END IF;

  -- Only process if treasury_id is set and there's a paid amount
  IF NEW.treasury_id IS NULL THEN
    RETURN NEW;
  END IF;

  expected_amount := COALESCE(NEW.paid_amount, 0) + COALESCE(NEW.commission, 0);

  -- Check if a treasury transaction already exists for this purchase
  SELECT id, amount, treasury_id INTO existing_tx
  FROM treasury_transactions
  WHERE reference_id = NEW.id AND reference_type = 'purchase'
  LIMIT 1;

  IF existing_tx.id IS NOT NULL THEN
    IF existing_tx.amount != expected_amount OR existing_tx.treasury_id != NEW.treasury_id THEN
      IF existing_tx.treasury_id != NEW.treasury_id THEN
        UPDATE treasury_transactions
        SET amount = expected_amount,
            treasury_id = NEW.treasury_id,
            description = 'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text)
        WHERE id = existing_tx.id;

        UPDATE treasuries
        SET balance = (
          SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
          FROM treasury_transactions WHERE treasury_id = existing_tx.treasury_id
        )
        WHERE id = existing_tx.treasury_id;
      ELSE
        UPDATE treasury_transactions
        SET amount = expected_amount,
            description = 'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text)
        WHERE id = existing_tx.id;
      END IF;

      UPDATE treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
      )
      WHERE id = NEW.treasury_id;
    END IF;
  ELSE
    IF expected_amount > 0 THEN
      INSERT INTO treasury_transactions (
        treasury_id, type, amount, balance_after, description,
        reference_id, reference_type, date, source
      ) VALUES (
        NEW.treasury_id, 'withdrawal', expected_amount, 0,
        'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text),
        NEW.id, 'purchase', NEW.date, 'purchases'
      );

      UPDATE treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
      )
      WHERE id = NEW.treasury_id;

      UPDATE treasury_transactions
      SET balance_after = (SELECT balance FROM treasuries WHERE id = NEW.treasury_id)
      WHERE reference_id = NEW.id AND reference_type = 'purchase';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Bug 4: Auto-post client payment to treasury via trigger
CREATE OR REPLACE FUNCTION public.post_client_payment_to_treasury()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.treasury_id IS NOT NULL AND NEW.amount > 0 THEN
    INSERT INTO treasury_transactions (
      treasury_id, type, amount, balance_after,
      description, reference_id, reference_type, date, source
    ) VALUES (
      NEW.treasury_id, 'deposit', NEW.amount, 0,
      'تسديد من الزبون', NEW.id, 'client_payment',
      NEW.date, 'client_payment'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trg_client_payment_treasury ON client_payments;
CREATE TRIGGER trg_client_payment_treasury
  AFTER INSERT ON client_payments
  FOR EACH ROW EXECUTE FUNCTION post_client_payment_to_treasury();
