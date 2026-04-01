
-- Delete orphaned client_payment transaction
DELETE FROM treasury_transactions WHERE id = '4177f7e1-1a96-42ae-a528-f86dbba4db32';

-- Recalculate treasury balance
UPDATE treasuries 
SET balance = (
  SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
  FROM treasury_transactions 
  WHERE treasury_id = 'e508a429-8317-464d-838f-2d4c6d9d6d41'
)
WHERE id = 'e508a429-8317-464d-838f-2d4c6d9d6d41';
