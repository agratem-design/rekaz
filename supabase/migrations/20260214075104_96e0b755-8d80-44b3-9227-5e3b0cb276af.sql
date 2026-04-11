
-- Fix treasury transaction amount to match purchase paid_amount
UPDATE treasury_transactions 
SET amount = 6500, 
    balance_after = balance_after - 3500
WHERE id = '425e5e6f-0ccf-4020-b5ff-20d178796708';

-- Also fix the treasury balance (deduct the missing 3500)
UPDATE treasuries 
SET balance = balance - 3500 
WHERE id = '65b4503c-ba9b-47e2-abb6-a5d4b3b76dca';
