-- Migration: مزامنة حركات الخزينة المفقودة لمدفوعات المشتريات
-- التاريخ: 2026-08-06

-- 1. إدراج حركات السحب المفقودة لمدفوعات المشتريات (purchase_payments)
--    يحدث هذا عندما لم يعمل التريجر trg_sync_purchase_payment لأسباب تاريخية
INSERT INTO treasury_transactions (
  treasury_id,
  type,
  amount,
  balance_after,
  description,
  date,
  source,
  reference_type,
  reference_id,
  notes
)
SELECT 
  pp.treasury_id,
  'withdrawal',
  pp.amount + COALESCE(pp.commission, 0),
  0,
  COALESCE(
    'سداد دفعة: ' || COALESCE(s.name, t.name, pur.title, 'مشتريات') 
      || COALESCE(' - مشروع: ' || p.name, ''),
    'سداد مشتريات/فنيين'
  ),
  pp.date,
  'purchase_payments',
  'purchase_payment',
  pp.id,
  pp.notes
FROM purchase_payments pp
JOIN purchases pur ON pp.purchase_id = pur.id
LEFT JOIN suppliers s ON pur.supplier_id = s.id
LEFT JOIN technicians t ON pur.technician_id = t.id
LEFT JOIN projects p ON pur.project_id = p.id
WHERE pp.treasury_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM treasury_transactions tt 
    WHERE tt.reference_type = 'purchase_payment' 
      AND tt.reference_id = pp.id
  );

-- 2. إعادة حساب رصيد جميع الخزائن بعد المزامنة
UPDATE treasuries t
SET balance = (
  SELECT COALESCE(
    SUM(CASE WHEN tt.type = 'deposit' THEN tt.amount ELSE -tt.amount END), 
    0
  )
  FROM treasury_transactions tt 
  WHERE tt.treasury_id = t.id
);

-- 3. تحديث balance_after لكل الحركات (تسلسلياً لكل خزينة)
-- هذا يضمن صحة عمود "الرصيد بعدها" في واجهة المستخدم
UPDATE treasury_transactions tt
SET balance_after = (
  SELECT COALESCE(
    SUM(CASE WHEN tt2.type = 'deposit' THEN tt2.amount ELSE -tt2.amount END),
    0
  )
  FROM treasury_transactions tt2
  WHERE tt2.treasury_id = tt.treasury_id
    AND (tt2.date < tt.date OR (tt2.date = tt.date AND tt2.created_at <= tt.created_at))
);
