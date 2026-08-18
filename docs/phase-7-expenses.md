# توثيق إنجاز المرحلة السابعة — إصلاح المصروفات العامة والتشغيلية (PHASE 7)
## Phase 7 Completion Report: General & Project Expenses Hardening

> **تاريخ الإنجاز:** 2026-08-16  
> **المرجع الإلزامي:** `MASTER_FINANCIAL_SYSTEM_REBUILD_PLAYBOOK_AR.md` — PHASE 7  
> **حالة المرحلة:** مكتملة بنجاح 100% مع اجتياز جميع اختبارات القبول الخمسة (Pass: 5/5)

---

## 1. نطاق العمل والتعديلات المطبقة في قاعدة البيانات (Applied DB Fixes)

1. **إزالة التريغرات والدوال التالفة القديمة:**
   - تم حذف التريغر المعطوب `trg_expenses_amount_change` والدالة المرتبطة به `trg_expenses_amount_change_recompute()` التي كانت تستدعي دالة غير موجودة وتعيق تحديث مبالغ المصروفات.
2. **تحصين دالة مزامنة الخزينة `handle_expense_treasury_sync()`:**
   - الحذف المسبق لأي قيد سابق يحمل نفس `reference_id` و `reference_type = 'expense'` لضمان الحصانة التامة من التكرار (`Idempotency`).
   - إنشاء قيد سحب وحيد `ONE Treasury OUT` في جدول `treasury_transactions`.
   - التعديل التلقائي لرصيد الخزينة المصدرية عند تعديل الخزينة في المصروف.
   - المعالجة النظيفة للحذف وإعادة موازنة الخزينة تلقائياً.
3. **الفصل المحاسبي الصارم بين المصروف العام ومصروف المشروع:**
   - المصروف العام (`project_id = null`): يخصم من الخزينة ولا يدخل في تكلفة أي مشروع إطلاقاً.
   - مصروف المشروع (`project_id != null`): يخصم من الخزينة ويدخل فورياً في `projects.spent` عبر دالة `update_project_spent()`.

---

## 2. نتائج اختبارات القبول الخمسة (Acceptance Tests Results)

| رقم الاختبار | السيناريو والمحددات | النتيجة المتوقعة | النتيجة الفعلية | الحالة |
|---|---|---|---|---|
| **Test 1** | تسجيل مصروف عام (ضيافة مكتب الإدارة: **500 د.ل**) | سحب 500 د.ل من الخزينة وبقاء تكلفة المشروع ثابتة (7,000 د.ل) | الخزينة تصبح 16k وتكلفة المشروع 7k وقيد سحب وحيد | **PASS** |
| **Test 2** | تسجيل مصروف تشغيلي للمشروع (**1,000 د.ل**) | سحب 1,000 د.ل من الخزينة وارتفاع تكلفة المشروع إلى 8,000 د.ل | الخزينة تصبح 15k وتكلفة المشروع 8k | **PASS** |
| **Test 3** | تعديل مصروف المشروع من **1,000 إلى 1,200 د.ل** | الخزينة = 14,800 د.ل، تكلفة المشروع = 8,200 د.ل بدون قيود مكررة | الخزينة 14.8k وتكلفة المشروع 8.2k وقيد واحد | **PASS** |
| **Test 4** | حذف مصروف المشروع بالكامل (Reversal) | ارتداد الخزينة إلى 16,000 د.ل وتكلفة المشروع ترتد إلى 7,000 د.ل | الخزينة 16k وتكلفة المشروع 7k وحذف القيد بنظافة | **PASS** |
| **Test 5** | فحص العزل وعدم المساس بالزبائن/الموردين/الفنيين | بقاء ديون الزبائن والموردين والفنيين ثابتة 100% | ثبات تام لجميع الأرصدة بدون أي تسوية متقاطعة | **PASS** |

---

## 3. الحالة الحسابية المعتمدة (Current Live State)

```text
Client Total Obligation:      30,000.00 LYD
Client Total Paid:            20,000.00 LYD
Client Remaining Due:         10,000.00 LYD

Supplier Total Purchases:      4,000.00 LYD
Supplier Total Paid:           2,500.00 LYD
Supplier Remaining Due:        1,500.00 LYD

Technician Total Earned:       3,000.00 LYD
Technician Total Paid:         1,000.00 LYD
Technician Remaining Due:      2,000.00 LYD

General Expenses:                500.00 LYD (مكتب الإدارة)
Project Spent:                 7,000.00 LYD (4k مواد + 3k عمالة فني)

Treasury MAIN (Cash):         16,000.00 LYD (+20k عميل - 2.5k مورد - 1k فني - 500 مصروف عام)
Treasury BANK:                     0.00 LYD
```

---

## 4. بوابة القبول (Phase 7 Acceptance Gate)

```text
Each Expense = exactly 1 Treasury OUT + Correct Cost Assignment
Zero Cross-Settlement with Clients, Suppliers, or Technicians
PHASE 7 = COMPLETE
```
