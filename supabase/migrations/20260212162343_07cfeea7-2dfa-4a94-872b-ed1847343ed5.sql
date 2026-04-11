-- Delete orphaned treasury transactions (client_payment references that no longer exist)
DELETE FROM treasury_transactions 
WHERE reference_type = 'client_payment' 
AND reference_id IS NOT NULL 
AND reference_id NOT IN (SELECT id FROM client_payments);

-- Delete orphaned treasury transactions (purchase references that no longer exist)
DELETE FROM treasury_transactions 
WHERE reference_type = 'purchase' 
AND reference_id IS NOT NULL 
AND reference_id NOT IN (SELECT id FROM purchases);

-- Recalculate balance for treasury e508a429 based on actual transactions
UPDATE treasuries 
SET balance = (
  SELECT COALESCE(
    SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0
  )
  FROM treasury_transactions 
  WHERE treasury_id = 'e508a429-8317-464d-838f-2d4c6d9d6d41'
)
WHERE id = 'e508a429-8317-464d-838f-2d4c6d9d6d41';