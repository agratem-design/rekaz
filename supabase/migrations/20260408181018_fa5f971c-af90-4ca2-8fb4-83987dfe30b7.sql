-- حذف الـ triggers المكررة والإبقاء على trg_auto_sync_treasury_balance فقط
DROP TRIGGER IF EXISTS trg_sync_treasury_balance_on_tx ON treasury_transactions;
DROP TRIGGER IF EXISTS trg_treasury_transactions_sync_balance ON treasury_transactions;
DROP TRIGGER IF EXISTS trg_treasury_transactions_update_balance_after ON treasury_transactions;

-- مزامنة جميع أرصدة الخزائن من الحركات الفعلية
UPDATE treasuries SET balance = (
  SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
  FROM treasury_transactions WHERE treasury_id = treasuries.id
);