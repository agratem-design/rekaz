
-- Delete the purchase
DELETE FROM purchases WHERE id = 'a6cd7c5a-bc59-46e2-8fed-2f98b845f0d2';

-- Delete the related treasury transaction
DELETE FROM treasury_transactions WHERE reference_id = 'a6cd7c5a-bc59-46e2-8fed-2f98b845f0d2' AND reference_type = 'purchase';

-- Recalculate treasury balance from all remaining transactions
UPDATE treasuries 
SET balance = (
  SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
  FROM treasury_transactions 
  WHERE treasury_id = 'e508a429-8317-464d-838f-2d4c6d9d6d41'
)
WHERE id = 'e508a429-8317-464d-838f-2d4c6d9d6d41';
