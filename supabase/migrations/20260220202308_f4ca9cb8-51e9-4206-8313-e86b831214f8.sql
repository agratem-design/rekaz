
-- إنشاء trigger على جدول treasury_transactions لتحديث رصيد الخزينة تلقائياً
-- هذا يضمن دقة الأرصدة دائماً بدون الحاجة لتحديثها يدوياً في الكود

CREATE OR REPLACE TRIGGER trg_sync_treasury_balance_on_tx
AFTER INSERT OR UPDATE OR DELETE ON public.treasury_transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_sync_treasury_balance();

-- أيضاً trigger لتحديث balance_after في نفس الحركة بعد إدراجها
CREATE OR REPLACE FUNCTION public.update_balance_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- تحديث balance_after ليعكس الرصيد الفعلي للخزينة بعد الحركة
  UPDATE treasury_transactions
  SET balance_after = (SELECT balance FROM treasuries WHERE id = NEW.treasury_id)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_update_balance_after
AFTER INSERT OR UPDATE ON public.treasury_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_balance_after();

-- التحقق من وجود trigger على purchases لمزامنة الخزينة
-- (كان يُنشأ مسبقاً في المشروع)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_purchases_treasury_sync'
    AND event_object_table = 'purchases'
  ) THEN
    CREATE TRIGGER trg_purchases_treasury_sync
    AFTER INSERT OR UPDATE ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_purchase_treasury_sync();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_purchase_deletion'
    AND event_object_table = 'purchases'
  ) THEN
    CREATE TRIGGER trg_purchase_deletion
    BEFORE DELETE ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_purchase_deletion();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_client_payment_deletion'
    AND event_object_table = 'client_payments'
  ) THEN
    CREATE TRIGGER trg_client_payment_deletion
    BEFORE DELETE ON public.client_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_client_payment_deletion();
  END IF;
END $$;
