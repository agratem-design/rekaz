-- Backfill existing payments that have no treasury transaction
INSERT INTO treasury_transactions (treasury_id, type, amount, balance_after, description, reference_id, reference_type, date, source, client_id, project_id)
SELECT cp.treasury_id, 'deposit', cp.amount, 0,
  'تسديد من زبون (مزامنة)',
  cp.id, 'client_payment', cp.date, 'client_payment',
  cp.client_id, cp.project_id
FROM client_payments cp
WHERE cp.treasury_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM treasury_transactions tt 
    WHERE tt.reference_id = cp.id AND tt.reference_type = 'client_payment'
  );