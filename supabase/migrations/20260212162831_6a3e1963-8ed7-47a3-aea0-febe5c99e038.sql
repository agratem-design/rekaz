
-- Trigger function: when a purchase is deleted, clean up treasury transactions and recalculate balance
CREATE OR REPLACE FUNCTION public.handle_purchase_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Delete related treasury transactions
  DELETE FROM treasury_transactions 
  WHERE reference_id = OLD.id AND reference_type = 'purchase';
  
  -- Recalculate treasury balance if treasury_id exists
  IF OLD.treasury_id IS NOT NULL THEN
    UPDATE treasuries 
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM treasury_transactions 
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger function: when a client payment is deleted, clean up treasury transactions and recalculate balance
CREATE OR REPLACE FUNCTION public.handle_client_payment_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Delete related treasury transactions
  DELETE FROM treasury_transactions 
  WHERE reference_id = OLD.id AND reference_type = 'client_payment';
  
  -- Delete related payment allocations
  DELETE FROM client_payment_allocations
  WHERE payment_id = OLD.id;
  
  -- Recalculate treasury balance
  IF OLD.treasury_id IS NOT NULL THEN
    UPDATE treasuries 
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM treasury_transactions 
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create triggers
CREATE TRIGGER on_purchase_delete
  BEFORE DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION handle_purchase_deletion();

CREATE TRIGGER on_client_payment_delete
  BEFORE DELETE ON client_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_client_payment_deletion();
