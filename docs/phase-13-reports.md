# PHASE 13 — Reports, Statements, Printing, Export

**حالة المرحلة**: مكتملة ومحققة بالكامل (COMPLETE — VERIFIED)  
**تاريخ التحقق والتثبيت**: 2026-08-16  
**المرجع الإلزامي الأعلى**: `MASTER_FINANCIAL_SYSTEM_REBUILD_PLAYBOOK_AR.md`

---

## 1. حصر شامل لمخرجات النظام المالي (Full Financial Report Inventory)

تم تدقيق ومراجعة جميع الشاشات والتقارير وكشوف الحسابات ومخرجات الطباعة والتصدير في المنظومة:

1. **كشف حساب العميل التفاعلي والمطبوع** (`src/pages/ClientDetail.tsx`).
2. **كشف حساب المورد التفاعلي وإيصالات الدفع** (`src/pages/SupplierDetail.tsx`).
3. **كشف حساب الفني وسجلات الإنجاز والمسحوبات** (`src/pages/TechnicianDetail.tsx`).
4. **كشف حركات الخزائن والحسابات المصرفية** (`src/pages/TreasuryDetail.tsx` & `src/pages/Treasuries.tsx`).
5. **التقرير المالي الشامل للمشروع (شاشة / طباعة / PDF)** (`src/pages/ProjectReport.tsx`).
6. **التقرير المالي والإداري العام للشركة** (`src/pages/Reports.tsx`).
7. **إيصالات القبض والصرف الرسمية** (`src/pages/ProjectPayments.tsx` & `src/lib/printStyles.ts`).
8. **كشف ديون ومستحقات العملاء** (`src/pages/Debts.tsx`).
9. **لوحة تحكم المحاسب المالي** (`src/pages/AccountantDashboard.tsx`).
10. **لوحة التحكم والإحصائيات الرئيسية** (`src/pages/Dashboard.tsx`).

---

## 2. مصفوفة مصادر الحقيقة للمخرجات المالية (Report Source Matrix)

| الحقل المالي | مصدر الحقيقة المعتمد (Authoritative Source) | المصدر الاحتياطي المتوافق (Fallback) | الاستخدامات المحظورة (Forbidden Practices) |
|---|---|---|---|
| **قيمة العقد / التزام العميل (مقاولات)** | `contracts.amount WHERE status != 'cancelled'` | `project_items.total_price` (عند عدم وجود عقد) | حظر إضافة الميزانية التقديرية `budget` أو مشتريات الشركة لحساب العميل |
| **التزام العميل (مشاريع تشطيب Cost Plus)** | `SUM(purchases.total_amount) + percentageFee` | نسبة المرحلة ثم نسبة المشروع | حظر الاعتماد على المدفوع للمورد `paid_amount` لتحديد فاتورة العميل |
| **تحصيلات ومقبوضات العميل** | `client_payments.amount` | — | حظر قراءة التحصيلات من جدول `income` العام |
| **المتبقي على العميل** | `التزام العميل - SUM(client_payments.amount)` | — | حظر أي تسوية متداخلة مع مصاريف أو فواتير الموردين |
| **فواتير ومشتريات الموردين** | `purchases.total_amount WHERE purchase_type = 'material'` | — | حظر خلط مشتريات المواد مع فواتير العمالة |
| **المدفوع الفعلي للمورد** | `purchase_payments.amount` | — | حظر الاعتماد على الكاش المشتق `purchases.paid_amount` كمصدر وحيد |
| **المتبقي للمورد** | `purchases.total_amount - purchase_payments.amount` | — | حظر خصم دفعات العملاء من مستحقات الموردين |
| **مستحقات الفنيين ومقاولي الباطن** | `technician_progress_records.earned_amount` | فواتير العمالة المستقلة `purchases (labor)` | حظر مضاعفة الحساب بجمع سجلات الإنجاز مع فواتير العمالة المكررة |
| **المدفوع الفعلي للفني** | `purchase_payments.amount` (أو `expenses` للفني) | — | حظر الخلط بين مسحوبات الفني ومصروفات المشروع العامة |
| **المتبقي للفني** | `المستحق المعتمد - المسدد الفعلي` | — | حظر إطفاء مستحقات الفني بتسديدات الزبون |
| **المصروفات المباشرة للمشروع** | `expenses WHERE project_id IS NOT NULL` | — | حظر إدخال المصروفات الإدارية العامة في تكاليف المشروع |
| **المصروفات العامة للشركة** | `expenses WHERE project_id IS NULL` | — | حظر تحميلها على حساب أي عميل أو مشروع |
| **حركات وأرصدة الخزائن** | `treasury_transactions` | `treasuries.balance` (Managed by Triggers) | حظر التعديل المباشر على الرصيد من الـ Frontend |
| **التحويلات بين الخزائن** | `treasury_transactions (transfer)` | — | حظر تصنيف التحويل الداخلي كإيراد أو مصروف نهائياً |
| **مجمل الربح التقديري (Accrual)** | `الإيراد التعاقدي - التكاليف المباشرة المعتمدة` | — | حظر استخدامه كبديل للسيولة النقدية |
| **صافي التدفق النقدي الفعلي (Cash Flow)** | `المقبوض نقداً فعلياً - المدفوع نقداً فعلياً` | — | حظر إدخال التكاليف الآجلة غير المدفوعة في التدفق النقدي |

---

## 3. الملفات التي تم تدقيقها وتعديلها (Files Audited & Modified)

1. **[`src/pages/ClientDetail.tsx`](file:///e:/ركاز/src/pages/ClientDetail.tsx)**:
   - *التعديل*: تم تصحيح الأسطر 502-518 لعزل احتساب المقاولات (`contracts.amount` -> `itemsSum`) عن مشاريع التشطيب Cost-Plus (`purchSum + rentSum + percentageFee`).
   - *الأثر*: إصلاح فاتورة العميل من 57,000 د.ل (بسبب جمع الميزانية والمشتريات) إلى **30,000.00 د.ل** الصافية الصحيحة.

2. **[`src/pages/Debts.tsx`](file:///e:/ركاز/src/pages/Debts.tsx)**:
   - *التعديل*: تم تصحيح الأسطر 175-225 لنفس القاعدة الموحدة للربط بالعقود وبنود المقايسة للعملاء المدينين.

3. **[`src/pages/SupplierDetail.tsx`](file:///e:/ركاز/src/pages/SupplierDetail.tsx)**:
   - *التعديل*: تم تعديل الأسطر 535-618 ليتم احتساب `paidAmount` والمتبقي للمورد بالاستعلام المباشر من جدول `purchase_payments`.

4. **[`src/pages/TechnicianDetail.tsx`](file:///e:/ركاز/src/pages/TechnicianDetail.tsx)**:
   - *التعديل*: تم تعديل الأسطر 775-805 لمنع الازدواجية بين `technician_progress_records` وفواتير العمالة لنفس البنود.

5. **[`src/pages/Reports.tsx`](file:///e:/ركاز/src/pages/Reports.tsx)**:
   - *التعديل*: إعادة بناء كاملة للاستعلامات المالية بحيث تقرأ المقبوضات من `client_payments` والمدفوعات من `purchase_payments` وفصل مجمل الربح عن صافي التدفق النقدي، واستخدام قالب الطباعة الموحد `openPrintWindow`.

6. **[`src/pages/AccountantDashboard.tsx`](file:///e:/ركاز/src/pages/AccountantDashboard.tsx)**:
   - *التعديل*: تعديل الأسطر 65-110 لجلب إيرادات الزبائن من `client_payments` ومدفوعات المشتريات من `purchase_payments`.

7. **[`src/pages/Dashboard.tsx`](file:///e:/ركاز/src/pages/Dashboard.tsx)**:
   - *التعديل*: تعديل الأسطر 60-110 لإدراج تحصيلات الزبائن ومدفوعات الموردين الفعلية في بطاقات لوحة التحكم.

8. **[`src/pages/ProjectReport.tsx`](file:///e:/ركاز/src/pages/ProjectReport.tsx)**:
   - *التعديل*: إضافة جدول التدفق النقدي الفعلي المستقل في قسم الطباعة وتقارير الإدارة.

9. **[`scripts/advance-phase.mjs`](file:///e:/ركاز/scripts/advance-phase.mjs)**:
   - *التعديل*: تصحيح مسار توثيق المرحلة 12 والتأكد من الحفاظ على السلامة التاريخية للملف.

---

## 4. نتائج التحقق والتدقيق المالي الحي (Live Database & Output Verification)

### أ. التحقق من المشروع الذهبي والعميل الذهبي:
- **المشروع الذهبي**: `66666666-6666-6666-6666-666666666666` (الزبون: `11111111-1111-1111-1111-111111111111`)
- **قيمة العقد المعتمدة**: `30,000.00 د.ل` (من `contracts.amount`).
- **المقبوض من الزبون**: `20,000.00 د.ل` (من `client_payments`).
- **المتبقي على الزبون**: `10,000.00 د.ل`.
- **مشتريات المواد**: `4,000.00 د.ل` (من `purchases` مواد).
- **المسدد للمورد الذهبي**: `2,500.00 د.ل` (من `purchase_payments`).
- **المتبقي للمورد الذهبي**: `1,500.00 د.ل`.
- **مستحقات الفني الذهبي**: `3,000.00 د.ل` (من `technician_progress_records`).
- **المسدد للفني الذهبي**: `1,000.00 د.ل` (من `purchase_payments`).
- **المتبقي للفني الذهبي**: `2,000.00 د.ل`.
- **المصروفات المباشرة للمشروع**: `0.00 د.ل`.
- **إجمالي التكاليف المباشرة المعتمدة**: `7,000.00 د.ل` (`4,000 مواد + 3,000 عمالة`).
- **مجمل الربح التقديري (Accrual Basis)**: `23,000.00 د.ل` (`30,000 إيراد - 7,000 تكلفة`).
- **صافي التدفق النقدي الفعلي للمشروع (Cash Flow)**: `16,500.00 د.ل` (`20,000 مقبوض - 3,500 مدفوع`).
- **المصروف العام للشركة**: `500.00 د.ل` (معزول تماماً ولا يمس تكلفة المشروع الذهبي).
- **أرصدة الخزائن**:
  - الخزينة الرئيسية: `12,000.00 د.ل`.
  - الحساب المصرفي (مصرف الوحدة): `4,000.00 د.ل`.
  - إجمالي السيولة النقدية: `16,000.00 د.ل` (`16,500 تدفق المشروع - 500 مصروف عام`).

---

## 5. تدقيق وتحليل نموذج عقود التشطيب بالتكلفة ونسبة الإشراف (Cost-Plus Accounting Check)

بناءً على الفحص التفصيلي للنموذج المحاسبي لمشاريع التشطيب:

1. **كيف يتم تمييز Cost Plus project عن Contract project؟**
   - يتم التمييز عبر حقل `projects.project_type`: `"contracting"` (مقاولات - مقايسة/عقد إجمالي ثابت) مقابل `"finishing"` (تشطيبات - Cost Plus %).
2. **ما Source of Truth لنسبة الإشراف؟**
   - المصدر الأساسي: `project_phases.percentage_value` عند تفعيل `has_percentage = true` على مستوى المرحلة، أو `projects.finishing_percentage` على المستوى العام للمشروع.
3. **هل المشتريات المستخدمة هي accrued purchases أم paid purchases؟**
   - يتم استخدام `purchases.total_amount` (التكلفة المعتمدة المستحقة / Incurred Costs). لا يتم استخدام `paid_amount`.
4. **هل الإيجارات التزام أم Cash Expense؟**
   - يتم معاملة إيجارات المعدات كالتزام مشتريات معتمد (`purchases WHERE rental_id IS NOT NULL`) بمبلغ `total_amount`.
5. **هل Client Obligation في Cost Plus مشتق فعلاً من التكلفة + fee؟**
   - نعم: `فاتورة العميل = إجمالي تكاليف المواد + إيجارات المعدات + نسبة الأتعاب الإشرافية`.
6. **هل دفع المورد يؤثر على فاتورة العميل أم مجرد الدفع النقدي؟**
   - **قطعاً لا**: تم التحقق من أن دفعات الموردين `purchase_payments` تؤثر فقط على رصيد المورد والنقدية، ولا تغيّر التزام العميل الذي يظل مرتبطاً بالتكلفة المعتمدة `total_amount` فقط، مما يحقق الفصل التام بين `Cost Incurred` و `Cash Paid`.

---

## 6. سجل تشغيل اختبار البناء (Build Verification Record)

- **الأمر المنفذ**: `npm run build`
- **رمز الخروج (Exit Code)**: `0` (Success)
- **ملخص الناتج**:
  ```text
  vite v5.4.19 building for production...
  ✓ 4913 modules transformed.
  rendering chunks...
  dist/index.html                        1.32 kB │ gzip:     0.61 kB
  dist/assets/index-Drx6mzK9.css       114.93 kB │ gzip:    18.45 kB
  dist/assets/purify.es-C_uT9hQ1.js     21.98 kB │ gzip:     8.74 kB
  dist/assets/index.es-Cct3KkxR.js     150.11 kB │ gzip:    51.37 kB
  dist/assets/index-DlMG8Zgj.js      3,833.16 kB │ gzip: 1,000.42 kB
  ✓ built in 22.22s
  ```
- **النتيجة**: خلو الشيفرة بالكامل من أي أخطاء ترجمة (TypeScript / React) أو استيرادات مكسورة.

---

## 7. ملخص نتائج اختبارات القبول الـ 15 (Acceptance Tests: 15/15 PASS)

1. **TEST 1 (Client Statement)**: PASS — العقد: 30k، المدفوع: 20k، المتبقي: 10k.
2. **TEST 2 (Supplier Statement)**: PASS — الفواتير: 4k، المدفوع: 2.5k، المتبقي: 1.5k.
3. **TEST 3 (Technician Statement)**: PASS — المستحق: 3k، المدفوع: 1k، المتبقي: 2k.
4. **TEST 4 (Treasury Statement & Transfers)**: PASS — التحويلات معزولة بالكامل ومصنفة تحويلات داخلية.
5. **TEST 5 (Project Financial Report 6 Sections)**: PASS — استقلال تام للأقسام الستة دون تسوية متداخلة.
6. **TEST 6 (Gross Profitability)**: PASS — مجمل الربح 23,000.00 د.ل (76.67%).
7. **TEST 7 (Net Cash Flow)**: PASS — التدفق النقدي للمشروع 16,500.00 د.ل.
8. **TEST 8 (General Expenses Isolation)**: PASS — المصروف العام (500 د.ل) لا يظهر في تكاليف المشروع.
9. **TEST 9 (Screen vs Print Consistency)**: PASS — تطابق كامل بين شاشات العرض وقوالب الطباعة.
10. **TEST 10 (Screen vs PDF Consistency)**: PASS — مخرجات PDF مطابقة لشاشات العرض والطباعة.
11. **TEST 11 (Screen vs Export Consistency)**: PASS — تطابق كامل لبيانات التصدير مع مصادر الحقيقة.
12. **TEST 12 (Direct SQL Verification)**: PASS — تباين 0.00 د.ل في قاعدة البيانات.
13. **TEST 13 (Legacy Formulas Global Search)**: PASS — تم استبدال جميع الصيغ القديمة.
14. **TEST 14 (Cache Safety)**: PASS — جميع العمليات تقرأ من الجداول الأصلية وتستخدم الكاش للقراءة فقط.
15. **TEST 15 (Clean Build)**: PASS — أمر `npm run build` اجتاز بنجاح (Exit Code: 0).

---

## 8. المشاكل المتبقية خارج النطاق (Remaining Out-of-Scope Issues)

- لا توجد أي مشاكل تعيق إغلاق المرحلة 13.
- جاهز للانتقال إلى **PHASE 14 — Full End-to-End Financial Test** في الجلسة القادمة.
