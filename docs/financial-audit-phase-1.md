# تقرير التدقيق المالي الشامل — المرحلة الأولى (PHASE 1 AUDIT REPORT)
## Comprehensive Financial System Audit (Read-Only Analysis)

> **تاريخ التدقيق:** 2026-08-15  
> **المرجع:** `MASTER_FINANCIAL_SYSTEM_REBUILD_PLAYBOOK_AR.md` — PHASE 1  
> **حالة التدقيق:** مكتمل بنسبة 100% بدون إجراء أي تعديل مالي أو حذف بيانات.

---

## 1. جدول مصفوفة التريغرات المالية (Trigger Inventory Matrix)

| الجدول المصدر (Table) | الحدث (Event) | اسم التريغر (Trigger Name) | الدالة المنفذة (Function) | العمليات والأثر المالي (Financial Effect) |
|---|---|---|---|---|
| `client_payments` | `INSERT` | `trg_post_client_payment_to_treasury` | `post_client_payment_to_treasury()` | إدراج قيد إيداع `deposit` في `treasury_transactions` |
| `client_payments` | `INSERT` | `trg_client_payment_treasury` *(مكرر)* | `post_client_payment_to_treasury()` | **تكرار استدعاء نفس دالة الإيداع** |
| `client_payments` | `INSERT` | `trg_auto_allocate_client_payment` | `trg_func_auto_allocate_on_client_payment()` | استدعاء `allocate_client_credit` لتوزيع الدفعة على البنود |
| `client_payments` | `DELETE` | `trg_client_payment_deletion` | `handle_client_payment_deletion()` | حذف قيود الخزينة والتخصيصات المرتبطة وإعادة حساب الرصيد |
| `client_payments` | `DELETE` | `trg_client_payment_before_delete` *(مكرر)* | `handle_client_payment_deletion()` | **تكرار استدعاء نفس دالة حذف القيود** |
| `purchases` | `INSERT/UPDATE` | `trg_purchases_treasury_sync` | `handle_purchase_treasury_sync()` | إنشاء/تحديث قيد سحب `withdrawal` للمشتريات المباشرة المسددة |
| `purchases` | `INSERT/UPDATE/DELETE` | `trg_purchases_update_spent` | `update_project_spent()` | تحديث إجمالي المصروف الفعلي للمشروع `projects.spent` |
| `purchases` | `DELETE` | `trg_purchase_deletion` | `handle_purchase_deletion()` | حذف قيود الخزينة المرتبطة بالفاتورة |
| `purchases` | `DELETE` | `trg_purchase_cleanup_allocations` | `handle_purchase_allocations_cleanup()` | تنظيف تخصيصات دفعات العملاء المرتبطة بالفاتورة |
| `purchase_payments` | `INSERT/UPDATE/DELETE` | `trg_sync_purchase_payment` | `handle_purchase_payment_sync()` | إنشاء/حذف قيد سحب الخزينة، وتحديث `purchases.paid_amount` و `status` |
| `expenses` | `INSERT/UPDATE/DELETE` | `trg_expense_treasury_sync` | `handle_expense_treasury_sync()` | إنشاء/تحديث/حذف قيد سحب الخزينة وإعادة حساب رصيد الخزينة |
| `expenses` | `INSERT/UPDATE/DELETE` | `trg_expenses_update_spent` | `update_project_spent()` | تحديث المنصرف الفعلي للمشروع `projects.spent` (إذا وجد `project_id`) |
| `expenses` | `UPDATE` | `trg_expenses_amount_change` | `trg_expenses_amount_change_recompute()` | استدعاء `recompute_expense_paid_amount` عند تغيير المبلغ |
| `treasury_transactions` | `INSERT/UPDATE/DELETE` | `trg_auto_sync_treasury_balance` | `auto_sync_treasury_balance()` | إعادة حساب وضبط `treasuries.balance` كإجمالي المقبوضات - المسحوبات |
| `treasury_transactions` | `INSERT` | `trg_update_balance_after` | `update_balance_after()` | تسجيل الرصيد بعد الحركة `balance_after` في حركة الخزينة |
| `project_custody` | `INSERT/UPDATE/DELETE` | `trg_custody_update_spent` | `update_project_spent()` | إضافة العهدة المنصرفة إلى `projects.spent` |
| `equipment_rentals` | `INSERT/UPDATE/DELETE` | `trg_rentals_update_spent` | `update_project_spent()` | إضافة قيمة تأجير المعدات إلى `projects.spent` |
| `project_phases` | `INSERT` | `generate_phase_reference_trigger` | `generate_phase_reference()` | توليد رقم مرجعي تسلسلي للمرحلة |
| `project_phases` | `INSERT` | `set_phase_reference` *(مكرر)* | `generate_phase_reference()` | **تكرار استدعاء دالة الترقيم مما يضاعف العداد التسلسلي** |

---

## 2. المسارات المالية التفصيلية (Financial Flow Paths)

### A. مسار دفعات العملاء (Client Payment Path)
1. **الواجهة:** يتم إدخال الدفعة من `ClientPayments.tsx` أو `ClientDetail.tsx` أو `ProjectPayments.tsx`.
2. **الجدول المصدر:** `INSERT INTO client_payments (client_id, project_id, amount, treasury_id, ...)`
3. **أثر قاعدة البيانات (Triggers):**
   - `trg_post_client_payment_to_treasury` يُدرج حركة إيداع `deposit` في `treasury_transactions`.
   - `trg_auto_sync_treasury_balance` يرفع رصيد الخزينة بمبلغ الدفعة.
   - `trg_auto_allocate_client_payment` يوزع الدفعة على بنود وفواتير المشروع.
4. **تضارب الواجهة المكتشف (Double Insertion):**
   - تقوم الواجهة الأمامية بسطر كود إضافي: `await supabase.from("treasury_transactions").insert(...)` مما يضيف إيداعاً ثانياً لنفس الدفعة.

---

### B. مسار دفعات الموردين (Supplier Payment Path)
1. **الواجهة:** يتم سداد دفعة لمورد من `SupplierDetail.tsx` أو `ProjectPurchases.tsx`.
2. **الجدول المصدر:** `INSERT INTO purchase_payments (purchase_id, amount, treasury_id, ...)`
3. **أثر قاعدة البيانات (Triggers):**
   - `trg_sync_purchase_payment` يُدرج حركة سحب `withdrawal` في `treasury_transactions`.
   - يحدث `purchases.paid_amount` بمجموع الدفعات المسددة.
   - يحدث `purchases.status` إلى (`partial` أو `paid`).
   - `trg_auto_sync_treasury_balance` يخفض رصيد الخزينة بمبلغ الدفعة.
4. **تضارب الواجهة المكتشف (Double Insertion):**
   - تقوم الواجهة بإدراج حركة سحب ثانية في `treasury_transactions` يدوياً بعد إدراج الدفعة.

---

### C. مسار مستحقات ودفعات الفنيين (Technician Payment Path)
1. **تسجيل الاستحقاق:** يتم تسجيل كميات الإنجاز في `technician_progress_records` (لا يوجد أثر على الخزينة).
2. **سداد الدفعة:** من شاشة `TechnicianDetail.tsx`، يتم إدراج السداد عبر `purchase_payments` أو ربط مباشر.
3. **تضارب الواجهة المكتشف:** الواجهة تقوم بإدراج حركة سحب يدوي في `treasury_transactions` بالتوازي مع التريغر.

---

### D. مسار المصروفات (Expenses Path)
1. **الواجهة:** يتم إضافة المصروف من `Expenses.tsx` أو `ProjectExpenses.tsx`.
2. **الجدول المصدر:** `INSERT INTO expenses (amount, treasury_id, project_id, ...)`
3. **أثر قاعدة البيانات (Triggers):**
   - `trg_expense_treasury_sync` يُدرج قيد سحب في `treasury_transactions`.
   - إذا كان `project_id != null`، يُحدث `trg_expenses_update_spent` المنصرف الفعلي `projects.spent`.
   - إذا كان `project_id == null`، لا يمس المشروع ويسجل كمصروف عام للشركة.
4. **تضارب الواجهة المكتشف:** الواجهة تقوم بإدراج قيد سحب يدوي ثانٍ في `treasury_transactions`.

---

### E. مسار التحويلات بين الخزائن (Transfers Path)
1. **الواجهة:** يتم التحويل من شاشة `Treasuries.tsx` أو `TreasuryDetail.tsx`.
2. **الآلية الحالية:** الواجهة تقوم مباشرة بإدراج حركتين في `treasury_transactions`:
   - حركة سحب `withdrawal` من الخزينة المصدرية `from_treasury_id`.
   - حركة إيداع `deposit` في الخزينة المستقبلة `to_treasury_id`.
3. **الأثر المالي:** تريغر `trg_auto_sync_treasury_balance` يخصم من الأولى ويضيف للثانية. إجمالي سيولة المنشأة يظل ثابتاً تماماً.

---

## 3. حصر التريغرات المكررة (Duplicate Triggers Inventory)

1. **`client_payments` (INSERT):**
   - `trg_post_client_payment_to_treasury`
   - `trg_client_payment_treasury`
   *(كلاهما ينفذان `post_client_payment_to_treasury()`)*
2. **`client_payments` (DELETE):**
   - `trg_client_payment_deletion`
   - `trg_client_payment_before_delete`
   *(كلاهما ينفذان `handle_client_payment_deletion()`)*
3. **`project_phases` (INSERT):**
   - `generate_phase_reference_trigger`
   - `set_phase_reference`
   *(كلاهما ينفذان `generate_phase_reference()` مما يضاعف عداد الترقيم التسلسلي)*

---

## 4. حصر مسارات الازدواج المالي في الواجهة (Frontend Double-Accounting Audit)

تم فحص الكود البرمجي في مجلد `src/` بالكامل وتحديد جميع المواقع التي تقوم بكتابة مباشرة في `treasury_transactions` بينما تتولى قاعدة البيانات ذلك تلقائياً:

| الملف في الواجهة | رقم السطر | نوع العملية | سبب التضارب |
|---|---|---|---|
| `src/pages/ClientDetail.tsx` | 411 | `insert (deposit)` | تكرار مع تريغر `trg_post_client_payment_to_treasury` |
| `src/pages/ClientPayments.tsx` | 476 | `insert (deposit)` | تكرار مع تريغر `trg_post_client_payment_to_treasury` |
| `src/pages/ClientPayments.tsx` | 541 | `delete` | تكرار مع تريغر `trg_client_payment_deletion` |
| `src/pages/Expenses.tsx` | 146 | `insert (withdrawal)` | تكرار مع تريغر `trg_expense_treasury_sync` |
| `src/pages/ProjectExpenses.tsx` | 245 | `insert (withdrawal)` | تكرار مع تريغر `trg_expense_treasury_sync` |
| `src/pages/ProjectPayments.tsx` | 467 | `insert (deposit)` | تكرار مع تريغر `trg_post_client_payment_to_treasury` |
| `src/pages/ProjectPurchases.tsx` | 418 | `insert (withdrawal)` | تكرار مع تريغر `trg_sync_purchase_payment` |
| `src/pages/SupplierDetail.tsx` | 229 | `insert (withdrawal)` | تكرار مع تريغر `trg_sync_purchase_payment` |
| `src/pages/TechnicianDetail.tsx` | 265 | `insert (withdrawal)` | تكرار مع تريغر `trg_sync_purchase_payment` |

---

## 5. إجابات الأسئلة الإلزامية لبوابة القبول (Acceptance Gate Checklist)

- **كيف يتم تسجيل Client Payment؟**
  - عبر إدراج سجل في `client_payments`، ويتولى التريغر ترحيل الإيداع إلى `treasury_transactions` وتوزيع الرصيد.
- **كم Treasury Transaction تنتج منه حالياً؟**
  - ينتج قيدان (2) بسبب تكرار الإدراج بين التريغر وكود الواجهة، والمستهدف الصحيح هو قيد واحد فقط (1).
- **من يحسب دين العميل؟**
  - قيمة العقود/البنود ناقص إجمالي `client_payments`.
- **كيف يتم تسجيل Purchase؟**
  - عبر `purchases`، وتضاف القيمة إلى تكلفة المشروع `projects.spent`.
- **كيف يتم دفع المورد؟**
  - عبر إدراج سجل في `purchase_payments` يخصم من الخزينة ويخفض رصيد المورد.
- **كيف يتم حساب `paid_amount`؟**
  - عبر مجموع الدفعات المسددة في `purchase_payments`.
- **كيف يتم دفع الفني ومن يحسب مستحقاته؟**
  - استحقاق الفني = (المنجز × سعر الوحدة) - المسدد، والدفع يتم عبر سحب نقدي موثق.
- **كيف يتم تسجيل وتعديل وحذف Expense؟**
  - عبر `expenses`، والتريغرات تتولى فورياً السحب والتعديل والإرجاع في الخزينة وتكلفة المشروع.
- **كيف تعمل التحويلات Transfers؟**
  - قيد سحب من الخزينة أ + قيد إيداع في الخزينة ب، دون أي تغيير في إجمالي سيولة المنشأة.

---

## 6. قرار إغلاق المرحلة 1 (Phase 1 Gate Sign-off)

* تمت الإجابة على كافة الأسئلة المحاسبية والهندسية.
* تم حصر جميع التريغرات، الدوال، وملفات الواجهة وتحديد أسباب الخلل بدقة رياضية وبرمجية كاملة.
* تم الالتزام بعدم تعديل أي كود أو حذف أي بيانات أثناء هذه المرحلة.

```text
PHASE 1 = COMPLETE
```
