
-- تصحيح رصيد خزينة التشطيب ليتطابق مع مجموع المعاملات الفعلية
UPDATE treasuries
SET balance = (
  SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
  FROM treasury_transactions
  WHERE treasury_id = '16476a4f-bf98-49e5-964a-c59a742dddcc'
)
WHERE id = '16476a4f-bf98-49e5-964a-c59a742dddcc';

-- إنشاء دالة لمزامنة أرصدة جميع الخزائن تلقائياً (لضمان الدقة دائماً)
CREATE OR REPLACE FUNCTION public.sync_treasury_balance(treasury_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE treasuries
  SET balance = (
    SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
    FROM treasury_transactions
    WHERE treasury_id = treasury_uuid
  )
  WHERE id = treasury_uuid;
END;
$$;

-- إضافة زناد يصحح رصيد الخزينة تلقائياً عند كل إدراج أو حذف أو تعديل في المعاملات
CREATE OR REPLACE FUNCTION public.auto_sync_treasury_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_treasury_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_treasury_id := OLD.treasury_id;
  ELSE
    affected_treasury_id := NEW.treasury_id;
  END IF;

  UPDATE treasuries
  SET balance = (
    SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
    FROM treasury_transactions
    WHERE treasury_id = affected_treasury_id
  )
  WHERE id = affected_treasury_id;

  -- إذا تغيرت الخزينة في UPDATE، صحّح الخزينة القديمة أيضاً
  IF TG_OP = 'UPDATE' AND OLD.treasury_id != NEW.treasury_id THEN
    UPDATE treasuries
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM treasury_transactions
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ربط الزناد بجدول المعاملات
DROP TRIGGER IF EXISTS trigger_auto_sync_treasury_balance ON treasury_transactions;
CREATE TRIGGER trigger_auto_sync_treasury_balance
AFTER INSERT OR UPDATE OR DELETE ON treasury_transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_sync_treasury_balance();
