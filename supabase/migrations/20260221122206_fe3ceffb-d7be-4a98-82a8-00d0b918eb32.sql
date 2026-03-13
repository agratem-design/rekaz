
-- تنظيف الزنادات المكررة على جدول purchases
DROP TRIGGER IF EXISTS cleanup_purchase_on_delete ON public.purchases;
DROP TRIGGER IF EXISTS on_purchase_delete ON public.purchases;
-- نبقي فقط trg_purchase_deletion

DROP TRIGGER IF EXISTS on_purchase_treasury_sync ON public.purchases;
DROP TRIGGER IF EXISTS sync_purchase_to_treasury ON public.purchases;
-- نبقي فقط trg_purchases_treasury_sync

-- تنظيف الزنادات المكررة على جدول client_payments
DROP TRIGGER IF EXISTS cleanup_client_payment_on_delete ON public.client_payments;
DROP TRIGGER IF EXISTS on_client_payment_delete ON public.client_payments;
-- نبقي فقط trg_client_payment_deletion

-- تنظيف الزنادات المكررة على جدول treasury_transactions
DROP TRIGGER IF EXISTS trigger_auto_sync_treasury_balance ON public.treasury_transactions;
-- نبقي فقط trg_sync_treasury_balance_on_tx
