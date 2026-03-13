
-- Function to sync treasury transactions when a purchase is inserted or updated
CREATE OR REPLACE FUNCTION public.handle_purchase_treasury_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expected_amount NUMERIC;
  existing_tx RECORD;
BEGIN
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
    -- Transaction exists: update amount if different
    IF existing_tx.amount != expected_amount OR existing_tx.treasury_id != NEW.treasury_id THEN
      -- If treasury changed, recalculate old treasury balance
      IF existing_tx.treasury_id != NEW.treasury_id THEN
        UPDATE treasury_transactions
        SET amount = expected_amount,
            treasury_id = NEW.treasury_id,
            description = 'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text)
        WHERE id = existing_tx.id;

        -- Recalculate old treasury balance
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

      -- Recalculate current treasury balance
      UPDATE treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
      )
      WHERE id = NEW.treasury_id;
    END IF;
  ELSE
    -- No transaction exists yet: create one if amount > 0
    IF expected_amount > 0 THEN
      INSERT INTO treasury_transactions (
        treasury_id, type, amount, balance_after, description,
        reference_id, reference_type, date, source
      ) VALUES (
        NEW.treasury_id, 'withdrawal', expected_amount, 0,
        'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text),
        NEW.id, 'purchase', NEW.date, 'purchases'
      );

      -- Recalculate treasury balance
      UPDATE treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
      )
      WHERE id = NEW.treasury_id;

      -- Update balance_after on the newly inserted transaction
      UPDATE treasury_transactions
      SET balance_after = (SELECT balance FROM treasuries WHERE id = NEW.treasury_id)
      WHERE reference_id = NEW.id AND reference_type = 'purchase';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for INSERT and UPDATE on purchases
CREATE TRIGGER on_purchase_treasury_sync
AFTER INSERT OR UPDATE OF paid_amount, commission, treasury_id, invoice_number
ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.handle_purchase_treasury_sync();
