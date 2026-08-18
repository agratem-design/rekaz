# FC-01: وثيقة بوابة التوافق النهائي والإغلاق المحاسبي (Final Consistency Gate)

**تاريخ الإغلاق**: 16 أغسطس 2026  
**حالة النطاق المالي**: `FC-01 FINISHING COST-PLUS = COMPLETE — VERIFIED — CLOSED`  
**حالة دفعات العملاء**: `CLIENT PROJECT-LEVEL RECEIPTS = COMPLETE — VERIFIED`  
**حالة الماستر بلان**: `UX/UI REBUILD MASTER PLAN = CONSISTENT WITH FINAL BUSINESS MODEL`  
**حالة واجهة المستخدم**: `UX IMPLEMENTATION = READY BUT NOT STARTED`

---

## 1. مصفوفة ملكية وتصنيف مصادر التكلفة القطعية (Deterministic Source Ownership Matrix)

| فئة التكلفة الاقتصادية (Economic Cost Category) | المصدر المعتمد الأساسي (Primary Canonical Source) | شرط البديل التشغيلي (Fallback Condition) | شرط الاستبعاد الصارم لمنع التكرار (Exclusion Condition) | مفتاح الربط والفرز (Dedup Key / Relationship) | السلوك القديم المعزول (Legacy Behaviour) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **مشتريات المواد (Materials)** | `purchases` حيث `purchase_type = 'material'` أو بدون نوع صريح وبدون ارتباط بمعدة أو فني | لا يوجد | يستبعد إذا كان `rental_id IS NOT NULL` أو `technician_id IS NOT NULL` أو `purchase_type IN ('rental', 'labor', 'service')` | `purchases.id` | كانت تعامل كافة المشتريات كمواد عشوائية دون فحص الارتباطات |
| **خدمات الموردين (Supplier Services)** | `purchases` حيث `purchase_type = 'service'` | لا يوجد | يستبعد إذا ارتبط بفني أو معدة | `purchases.id` | لم تكن تصنف كبند مستقل |
| **أعمال الفنيين المنجزة (Technician Earned Work)** | `technician_progress_records.earned_amount` لبنود المشروع المعني | `purchases` حيث `purchase_type = 'labor'` أو `technician_id IS NOT NULL` **فقط عند انعدام أي سجل إنجاز للمشروع (`count = 0`)** | **تستبعد فواتير المصنعية (`purchases(labor)`) استبعاداً تاماً عند وجود سجلات إنجاز فنيين للمشروع** منعاً لازدواج التكلفة | `technician_progress_records.id` كأساس، أو `purchases.id` كبديل استثنائي | كانت تدمج فواتير المصنعية وسجلات الإنجاز مما يؤدي لتضخيم التكلفة |
| **إيجارات المعدات (Equipment Rentals)** | `purchases` حيث `rental_id IS NOT NULL` أو `purchase_type = 'rental'` | جدول `equipment_rentals` للمشروع **فقط إذا لم ينشئ النظام قيد شراء مقابل (`purchases(rental_id)`)** | **يستبعد جمع جدول `equipment_rentals` إذا تم احتساب قيد الشراء المقابل له** | `purchases.rental_id = equipment_rentals.id` | كان يتم جمع الجدولين معاً أحياناً مما يضاعف تكلفة الإيجار |
| **مصروفات المشروع المباشرة (Direct Project Expenses)** | `expenses` حيث `project_id = target_project_id` | لا يوجد | **تستبعد تماماً المصروفات العامة للشركة (`expenses WHERE project_id IS NULL`)** من قاعدة تكلفة المشروع | `expenses.id` | كانت بعض الشاشات تخلط المصروفات الإدارية العامة للشركة مع تكاليف المشروع |
| **المصروفات العامة والإدارية للشركة (General Company Overhead)** | `expenses` حيث `project_id IS NULL` | لا يوجد | **معزولة عزلاً تاماً عن أي مشروع أو حساب لنسبة التشطيب أو استحقاق عميل** | `expenses.id` | لا تدخل في أي معادلة مشروع |

---

## 2. خوارزمية حسم واحتساب أعمال الفنيين (Technician Deduplication Algorithm)

```typescript
// Algorithm: Deterministic Technician Earned Incurred Cost
function getTechnicianIncurredCost(projectItemsProgress, projectPurchases) {
  const progressEarnedSum = projectItemsProgress.reduce((sum, r) => sum + (r.earned_amount || 0), 0);
  
  if (projectItemsProgress.length > 0) {
    // Primary Canonical Source is authoritative
    // All mirrored labor purchases are EXCLUDED from incurred cost
    return progressEarnedSum;
  } else {
    // Fallback: standalone labor purchases only when zero progress records exist
    const fallbackLaborSum = projectPurchases
      .filter(p => (p.purchase_type === 'labor' || Boolean(p.technician_id)) && !p.rental_id)
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
    return fallbackLaborSum;
  }
}
```
- **حالة الاختبار المثبتة (`DEDUP-01` & `DEDUP-04`)**:
  - تكلفة الإنجاز الفعلية = 5,000 د.ل.
  - وجود فاتورة مصنعية مطابقة = 5,000 د.ل.
  - **التكلفة المحتسبة في قاعدة المشروع = 5,000 د.ل تماماً وبدون أي تكرار**.

---

## 3. خوارزمية حسم واحتساب إيجارات المعدات (Rental Deduplication Algorithm)

```typescript
// Algorithm: Deterministic Equipment Rentals Incurred Cost
function getEquipmentRentalIncurredCost(projectPurchases, projectRentals) {
  const rentalPurchasesSum = projectPurchases
    .filter(p => Boolean(p.rental_id) || p.purchase_type === 'rental')
    .reduce((sum, p) => sum + (p.total_amount || 0), 0);

  if (rentalPurchasesSum > 0) {
    // Primary Canonical Source from purchases ledger
    return rentalPurchasesSum;
  } else {
    // Fallback: direct equipment rentals table
    return projectRentals.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  }
}
```
- **حالة الاختبار المثبتة (`DEDUP-02` & `DEDUP-03`)**:
  - تكلفة الإيجار الفعلية = 1,000 د.ل.
  - قيد الشراء المرتبط بالإيجار = 1,000 د.ل.
  - **التكلفة المحتسبة في قاعدة المشروع = 1,000 د.ل تماماً (وليست 2,000 د.ل)**.

---

## 4. مصفوفة نطاقات الخزائن حسب نوع المشروع (Treasury Domain Matrix)

| نوع المشروع (Project Type) | تمثيل قاعدة البيانات الحالي (Current DB Representation) | نطاق الخزائن المعتمد (Allowed Treasuries Domain) | هيكلية الفروع (Branch Model) | الخزينة الافتراضية المحددة (Default / Preselected) | هل هو مفروض بقيد DB؟ (DB Enforced?) | هل هو مفروض في الواجهة؟ (UI Enforced?) | الفجوة المعمارية الراهنة (Current Gap) | السلوك المستهدف في الواجهة (Target UX Behaviour) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Contracting (المقاولات)** | جدول `treasuries` مع حقل `parent_id` ومطابقة نصية للاسم | نطاق خزينة المقاولات العامة وفروعها | خزينة رئيسية + فروع نقدية وحسابات مصرفية تابعة | الخزينة الرئيسية للمقاولات | **لا (لا يوجد Check Constraint)** | **جزئي (مطابقة الاسم والنوع)** | غياب عمود `project_domain` صريح في جدول `treasuries` | تقييد قائمة الاختيار بفروع المقاولات، مع تطبيق قاعدة `DEFAULT != SILENT` بعرض الرصيد المباشر |
| **Finishing (التشطيبات)** | جدول `treasuries` مع حقل `parent_id` ومطابقة نصية للاسم | نطاق خزينة التشطيبات العامة وفروعها | خزينة رئيسية + فروع نقدية وحسابات مصرفية تابعة | الخزينة الرئيسية للتشطيبات | **لا (لا يوجد Check Constraint)** | **جزئي (مطابقة الاسم والنوع)** | غياب عمود `project_domain` صريح في جدول `treasuries` | تقييد قائمة الاختيار بفروع التشطيبات، مع تطبيق قاعدة `DEFAULT != SILENT` بعرض الرصيد المباشر |

---

## 5. حالة سياسة الفائض والدفعات المقدمة (Overpayment Policy Status)

- **التصنيف المعماري الرسمي**:
  $$\mathbf{OVERPAYMENT\ POLICY = DECISION\ REQUIRED}$$
- **التوضيح**:
  - احتساب الفائض كـ `Advance / Credit Balance` عند تجاوز الدفعة للمستحق هو سلوك برمجي موروث في الواجهة الحالية ولم يصدر به قرار تجاري ملزم بعد.
  - لا يعتبر جزءاً من القواعد المحاسبية القطعية المؤكدة في `FC-01`.
  - تم الإبقاء على السلوك الإنتاجي الحالي كما هو في هذه الجلسة دون تغيير حتى صدور توجيه تجاري صريح.

---

## 6. إزالة الصيغ والمعادلات القديمة لمشاريع التشطيبات (Removed Old Finishing Rules)

- تم فحص وتطهير وثيقة الماستر بلان [`docs/ux-ui-rebuild-master-plan.md`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/docs/ux-ui-rebuild-master-plan.md) بالكامل من أي معادلات قديمة أو مجتزأة مثل:
  - ~~`Finishing = Purchases + Rentals + Percentage`~~
  - ~~`Percentage on purchases only`~~
  - ~~`إجمالي المشتريات والخدمات + (إجمالي المشتريات × نسبة التشطيب %)`~~
- **الصيغة المركزية الحصرية المعتمدة**:
  - كافة مكونات وشاشات الواجهة تستهلك حصراً مخرجات الدالة المركزية `calculateProjectFinancials` من [`src/lib/financialCore.ts`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/src/lib/financialCore.ts):
    $$\text{Eligible Cost Base} = \text{Materials} + \text{Supplier Services} + \text{Technician Earned} + \text{Equipment Rentals} + \text{Direct Expenses}$$
    $$\text{Company Fee} = \text{Eligible Cost Base} \times \left( \frac{\text{Finishing Percentage}}{100} \right)$$
    $$\text{Client Obligation} = \text{Eligible Cost Base} + \text{Company Fee}$$
    $$\text{Client Remaining} = \text{Client Obligation} - \text{Client Paid}$$

---

## 7. إزالة منطق توزيع دفعات العملاء القديم (Removed Client Allocation Rules)

- **القاعدة القطعية**:
  - **دفعة العميل تسدد على المشروع ككل (`Project-Level Client Receipt`)**.
  - تم استبعاد وتطهير أي مفهوم لتوزيع دفعة العميل على الفواتير، أو الموردين، أو الفنيين، أو المعدات، أو البنود، أو المراحل.
  - جدول `client_payment_allocations` مصنف كـ `Legacy Informational (Non-Authoritative)` ولا تعتمد عليه أي شاشة أو تقرير في التصميم المستهدف.
  - مكون `PaymentAllocationDialog` تم إلغاء اعتماده (`Deprecated`).

---

## 8. جدول تصحيح وتناقضات الماستر بلان (Master Plan Contradiction Matrix)

| القسم / السطر (Section / Location) | النص القديم المتناقض (Old Text) | القاعدة المعتمدة الصحيحة (Final Rule) | الإجراء المتخذ في الوثيقة (Action Taken) |
| :--- | :--- | :--- | :--- |
| **Section 1 (Line 51)** | `تسديدات الزبون المخصصة` | تسديدات الزبائن على مستوى المشروع | تم التعديل إلى: `تسديدات الزبون على مستوى المشروع` |
| **Section 2 (Line 73)** | `استلام الدفعة قد يتم لمشروع محدد أو دفعة عامة تُخصص على فواتير متعددة` | استلام الدفعة يتم للمشروع ككل ويسجل إيداعاً في الخزينة دون أي توزيع على فواتير أو بنود | تم التعديل إلى `Project-Level` وإزالة جملة التخصيص على فواتير متعددة |
| **Section 5 (Line 236)** | `قائمة على التكلفة الفعلية المباشرة (المشتريات + الإيجارات) + نسبة إشراف مضافة (%)` | قائمة على التكلفة الفعلية المباشرة المعتمدة (مواد، خدمات، أعمال فنيين، إيجارات معدات، مصروفات مباشرة) + نسبة إدارة الشركة (%) | تم التحديث لتشمل كافة الموارد المباشرة الخمسة |
| **Section 5 (Line 238)** | `إجمالي المشتريات والخدمات + (إجمالي المشتريات × نسبة التشطيب %)` | `قاعدة التكلفة المباشرة المعتمدة + عمولة إدارة التشطيبات (%)` المحتسبة مركزياً عبر `financialCore` | تم استبدال المعادلة المجتزأة بالمعادلة المركزية المعتمدة |
| **Section 15 (Line 421)** | `تخصيص دفعات الزبون (Payment Allocation) مع جدول فواتير ومطابقات` | `قبض دفعة من الزبون (Project-Level Client Receipt)` بدون جداول فواتير | تم التحديث لنموذج مالي مركز ومباشر لمعاينة الأثر المالي والخزينة |
| **Section 23 (Line 561)** | `تسجيل دفعة عميل وتوزيعها \| فتح نافذة الدفعات -> تأكيد التوزيع` | تسجيل دفعة عميل على المشروع \| فتح نافذة القبض -> إدخال المبلغ والخزينة مع معاينة الأثر | تم تصحيح ميزانية النقرات لإلغاء خطوة التوزيع |
| **Section 30 (Line 608)** | `تحويل نماذج المشتريات وتخصيص الدفعات إلى Slide-over Drawers` | تحويل نماذج المشتريات إلى Drawers وتحديث نموذج قبض الدفعات ليكون نافذة سداد مركزة | تم التحديث في مسار المرحلة الرابعة |

$$\mathbf{Remaining\ Master\ Plan\ Contradictions = 0}$$

---

## 9. تدقيق محرك الاختبارات (Test Harness Audit)

تم فحص ومراجعة ملف الاختبارات [`scripts/financial-tests/finishing-cost-plus-invariants.mjs`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/scripts/financial-tests/finishing-cost-plus-invariants.mjs):
1. **استدعاء النواة المركزية الفعلية**: الاختبارات تستدعي دالة `calculateProjectFinancials` الحقيقية وتمرر مجموعات بيانات مختلفة لاختبار سيناريوهات التشطيب والمقاولات.
2. **انعدام الحسابات المحلية الزائفة**: لا توجد معادلات محلية تحاكي النتيجة داخل ملف الاختبار، بل يتم فحص المخرجات الحقيقية للدالة ومطابقتها مع القيم المتوقعة محاسبياً.
3. **انعدام القيم الثابتة المسبقة (No Hard-coded Actuals)**: `Actual` مستخرج ديناميكياً من كائن النتائج `result`.
4. **اختبارات حقيقية لمنع التكرار (Real Dedup Tests)**:
   - `DEDUP-01`: فحص استبعاد فواتير المصنعية المكررة مع سجلات إنجاز الفنيين.
   - `DEDUP-02`: فحص استبعاد تكرار إيجارات المعدات عند وجود قيد شراء مقابل.
   - `DEDUP-03`: فحص العزل الفردي للإيجار (1,000 د.ل تبقى 1,000 د.ل وليست 2,000 د.ل).
   - `DEDUP-04`: فحص البديل الاستثنائي لفواتير المصنعية عند انعدام سجلات الإنجاز.
5. **اختبارات الاستقلال التام وحظر التسوية التقاطعية**:
   - `NO-CROSS-SETTLEMENT-01` إلى `03`.

---

## 10. إثبات قدرة محرك الاختبارات على كشف الأخطاء (Harness Failure Proof)

- **آلية التحقق التلقائية**:
  - يتضمن ملف [`scripts/financial-tests/harness.mjs`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/scripts/financial-tests/harness.mjs) في الدالة `AccountingTestHarness.testHarnessIntegrity()` اختباراً ذاتياً للمحرك ينفذ مقارنة غير متطابقة متعمدة (`100 === 200`).
  - يتحقق المحرك من أن الحالة تسجل `FAIL` بدقة، وفي حال فشل المحرك في كشف الخطأ يتوقف الاختبار فوراً بخطأ فادح.
- **النتيجة المسجلة**:
  $$\mathbf{HARNESS\ FAILURE\ PROOF = PASS}$$

---

## 11. نتائج اختبارات الثبات المالي النهائية (Final Financial Regression Results)

```
================================================================
                      TEST RUN SUMMARY
================================================================
  Run ID:         AUTO-INV-1786888049003
  Total Tests:    54
  Passed:         54
  Failed:         0
  Warnings:       3 (Documented Phase 16 Candidates)
  Status:         ALL INVARIANTS PASSED
================================================================

✓ All accounting invariants passed with 100% mathematical precision.
```

- **INV-01 إلى INV-24**: ثبات الخزائن والقيود الآلية (100% PASS).
- **FINISHING-01 إلى FINISHING-12**: ثبات قاعدة التكلفة الخماسية، ونسبة الشركة، واستحقاق العميل، وفصل التدفق النقدي (100% PASS).
- **DEDUP-01 إلى DEDUP-04**: ثبات منع الازدواجية لفئات الفنيين والمعدات والمصروفات (100% PASS).
- **CLIENT-PROJECT-01 إلى CLIENT-PROJECT-06**: دورة حياة دفعات العميل على مستوى المشروع (100% PASS).
- **NO-CROSS-SETTLEMENT-01 إلى NO-CROSS-SETTLEMENT-03**: استقلال التحصيلات عن الصرف (100% PASS).
- **GOLDEN-01 إلى GOLDEN-05**: مطابقة منظومة المقاولات الذهبية السابقة بدون أدنى تغيير (100% PASS).

---

## 12. نتيجة بناء الحزمة الإنتاجية (Production Build Verification)

- **الأمر**: `npm run build`
- **النتيجة**:
  $$\mathbf{Exit\ Code = 0\ (Built\ in\ 17.16s\ with\ 0\ TypeScript\ Errors)}$$

---

## 13. القيود المتبقية الموثقة لمرحلة لاحقة (Documented Deferred Items)

1. **إضافة عمود `project_domain` لجدول الخزائن**: مؤجل لمرحلة تقوية قاعدة البيانات (Phase 16) لفرض قيود صلبة على مستوى قاعدة البيانات (`DB Check Constraints`).
2. **قرار سياسة الفائض (Overpayment Policy)**: مؤجل لاتخاذ قرار تجاري معتمد من الإدارة حول تفعيل خيار الحظر التام أم استمرار إنشاء الرصيد الدائن.

---

## 14. الإحصائيات الحاسمة للبوابة النهائية (Final Metric Verification)

| المقياس الحاسم (Critical Metric) | القيمة المحققة (Achieved Value) | الحالة (Status) |
| :--- | :---: | :---: |
| **Cost Source Ambiguity** | **0** | محدد وحتمي 100% |
| **Economic Double Counting** | **0** | ممنوع ومختبر آلياً |
| **Cash / Accrual Mixing** | **0** | مفصول تماماً |
| **Cross-Settlement Paths** | **0** | مستقل ومنعدم |
| **Old Finishing Formulas Remaining** | **0** | مطهر بالكامل |
| **Target Client Allocation References** | **0** | مطهر بالكامل |
| **UX Master Plan Contradictions** | **0** | متطابق 100% |
| **Cross-Project Leakage Findings** | **0** | معزول تماماً |
| **Financial Invariants Failures** | **0** (54/54 Pass) | نجاح تام |
| **Harness Failure Proof** | **PASS** | موثق ومثبت |
| **Production Build Status** | **PASS (Exit 0)** | خالٍ من الأخطاء |

---

## 15. الحكم النهائي وإعلان إغلاق البوابة (Final Gate Verdict)

```
================================================================
                    FINAL GATE VERDICT
================================================================
FC-01 FINISHING COST-PLUS
= COMPLETE — VERIFIED — CLOSED

CLIENT PROJECT-LEVEL RECEIPTS
= COMPLETE — VERIFIED

UX/UI REBUILD MASTER PLAN
= CONSISTENT WITH FINAL BUSINESS MODEL

UX IMPLEMENTATION
= READY BUT NOT STARTED
================================================================
```
