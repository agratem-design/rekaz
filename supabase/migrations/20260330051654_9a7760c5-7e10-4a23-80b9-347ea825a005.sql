
-- Create missing triggers for treasury balance sync

-- 1. Trigger for client payments -> treasury
DROP TRIGGER IF EXISTS trg_post_client_payment_to_treasury ON client_payments;
CREATE TRIGGER trg_post_client_payment_to_treasury
  AFTER INSERT ON client_payments
  FOR EACH ROW
  EXECUTE FUNCTION post_client_payment_to_treasury();

-- 2. Trigger for auto sync treasury balance after transaction changes
DROP TRIGGER IF EXISTS trg_auto_sync_treasury_balance ON treasury_transactions;
CREATE TRIGGER trg_auto_sync_treasury_balance
  AFTER INSERT OR UPDATE OR DELETE ON treasury_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_sync_treasury_balance();

-- 3. Trigger for updating balance_after on new transactions
DROP TRIGGER IF EXISTS trg_update_balance_after ON treasury_transactions;
CREATE TRIGGER trg_update_balance_after
  AFTER INSERT ON treasury_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_balance_after();

-- 4. Backfill: insert treasury transactions for existing client payments that have no matching transaction
INSERT INTO treasury_transactions (treasury_id, type, amount, balance_after, description, reference_id, reference_type, date, source, client_id, project_id)
SELECT cp.treasury_id, 'deposit', cp.amount, 0,
  'تسديد من زبون (مزامنة)',
  cp.id, 'client_payment', cp.date, 'client_payment',
  cp.client_id, cp.project_id
FROM client_payments cp
WHERE cp.treasury_id IS NOT NULL
  AND cp.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM treasury_transactions tt 
    WHERE tt.reference_id = cp.id AND tt.reference_type = 'client_payment'
  );

-- 5. Recalculate all treasury balances
UPDATE treasuries
SET balance = COALESCE((
  SELECT SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END)
  FROM treasury_transactions
  WHERE treasury_id = treasuries.id
), 0);
