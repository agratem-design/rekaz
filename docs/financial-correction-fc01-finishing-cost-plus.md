# FC-01: التقرير النهائي للتصحيح المالي لنموذج مشاريع التشطيبات (Cost-Plus) ودفعات العملاء على مستوى المشروع

**تاريخ الإنجاز**: 16 أغسطس 2026  
**حالة الجلسة**: `FC-01 FINISHING COST-PLUS = COMPLETE — VERIFIED`  
**حالة الواجهات**: `UX IMPLEMENTATION = PAUSED / NOT STARTED`

---

## 1. الملخص التنفيذي وقرارات النموذج التجاري المعتمد

تم تنفيذ التصحيح المالي الشامل لمنظومة **مشاريع التشطيبات (Finishing Projects)** ونظام **تحصيل دفعات العملاء (Client Payments)** بناءً على القواعد التجارية القطعية:

1. **نموذج التشطيبات (Cost-Plus / Management Commission)**:
   - التشطيبات ليست قائمة على المشتريات فقط. الشركة تقدم وتدير جميع الموارد المباشرة للمشروع (مواد، خدمات موردين، أعمال فنيين منجزة، إيجارات معدات، ومصروفات مباشرة للمشروع).
   - تُحتسب نسبة إدارة الشركة (`Finishing Percentage %`) على **إجمالي القيمة المباشرة المعتمدة المستحقة للمشروع (Eligible Direct Incurred Cost Base)**.
   - المصروفات العامة للشركة (`project_id IS NULL`) **محظورة تماماً** من الدخول في قاعدة تكلفة المشروع أو احتساب نسبة عليها.

2. **دفعات العملاء على مستوى المشروع (Project-Level Client Receipts)**:
   - دفعات العميل تُسدد على **المشروع ككل** ولا يتم توزيعها محاسبياً على بنود المقايسة، أو الفواتير، أو الفنيين، أو المعدات، أو المصروفات.
   - $\text{Client Paid} = \sum \text{client\_payments.amount for project}$
   - $\text{Client Remaining} = \text{Project Client Obligation} - \text{Client Paid}$

3. **الفصل التام بين الاستحقاق والتدفق النقدي (Accrual vs. Cash Flow)**:
   - سداد المورد أو الفني يقلل الالتزام والنقدية في الخزينة، ولا يغير قيمة استحقاق العميل أو مجمل ربح المشروع.

---

## 2. مصفوفة ملكية وتصنيف مصادر التكلفة المباشرة (Source Ownership Matrix)

| فئة التكلفة المباشرة | الجدول المعتمد (Canonical Table) | شرط التضمين في التكلفة المباشرة | آلية منع التكرار (Deduplication) |
| :--- | :--- | :--- | :--- |
| **مشتريات المواد (Materials)** | `purchases` | `purchase_type = 'material'` أو بدون نوع مع وجود مورد وبدون تأجير | استبعاد أي سجل مرتبط بـ `rental_id` أو `technician_id` أو `service` |
| **خدمات الموردين (Supplier Services)** | `purchases` | `purchase_type = 'service'` | استبعاد المشتريات المكررة مع الفنيين |
| **أعمال الفنيين المنجزة (Technician Earned)** | `technician_progress_records` (أساسي) / `purchases(labor)` (بديل فواتير) | `earned_amount` من سجلات تقدم بنود المشروع | إذا وجدت سجلات إنجاز فهي المصدر الحصري المعتمد وتستبعد فواتير المصنعية العشوائية |
| **إيجارات المعدات (Equipment Rentals)** | `equipment_rentals` / `purchases(rental_id)` | إيجارات المعدات المحملة على المشروع | إذا احتسب من `purchases` المشتقة يتم الاعتماد عليها وتفادي جمع `equipment_rentals` مرتين |
| **مصروفات المشروع المباشرة (Direct Expenses)** | `expenses` | `project_id = target_project_id` | استبعاد `expenses WHERE project_id IS NULL` عزلاً تاماً |

---

## 3. المعادلات المحاسبية المركزية المعتمدة (Single Source of Truth)

### أ. مشاريع التشطيبات (Finishing Cost-Plus)

$$\text{Eligible Cost Base} = \text{Materials} + \text{Supplier Services} + \text{Technician Earned} + \text{Equipment Rentals} + \text{Direct Expenses}$$

$$\text{Company Fee} = \text{Eligible Cost Base} \times \left( \frac{\text{Finishing Percentage}}{100} \right)$$

$$\text{Client Obligation} = \text{Eligible Cost Base} + \text{Company Fee}$$

$$\text{Client Remaining} = \text{Client Obligation} - \sum \text{client\_payments}$$

$$\text{Accrual Gross Profit} = \text{Client Obligation} - \text{Eligible Cost Base} = \text{Company Fee}$$

### ب. مشاريع المقاولات (Contracting Fixed-Price)

$$\text{Contract Value} = \sum \text{contracts.amount} \quad (\text{أو } \sum \text{project\_items.total\_price} \text{ كبديل}) $$

$$\text{Client Obligation} = \text{Contract Value}$$

$$\text{Project Direct Incurred Cost} = \text{Materials} + \text{Services} + \text{Technician Obligations} + \text{Equipment Rentals} + \text{Direct Expenses}$$

$$\text{Accrual Gross Profit} = \text{Contract Value} - \text{Project Direct Incurred Cost}$$

### ج. التدفق النقدي الفعلي (Cash Flow - لكلا النوعين)

$$\text{Cash In} = \sum \text{client\_payments}$$

$$\text{Cash Out} = \sum \text{purchase\_payments (suppliers)} + \sum \text{purchase\_payments (technicians)} + \sum \text{direct expenses}$$

$$\text{Net Cash Flow} = \text{Cash In} - \text{Cash Out}$$

### د. الاستقلال التام بين تحصيلات الزبائن ومصروفات الشركة (Collections vs. Disbursements Independence)

- **مبدأ حرية الصرف والإدارة**:
  - تحصيل دفعة من الزبون يزيد المقبوض الفعلي للمشروع، ويقلل المتبقي على الزبون، ويولد قيد إيداع وحيد في الخزينة (`Treasury IN`).
  - تحصيل دفعة الزبون **لا يسدد فواتير موردين ولا يصرف مستحقات فنيين ولا يوزع أموالاً على البنود**.
  - قرار السداد للموردين أو الفنيين (متى، وكم، ومن أي خزينة) هو **قرار إدارة مستقل تماماً**، والخزينة هي مجمع النقدية وليست رابط تسوية بين دفعات الزبون ومصروفات الشركة.

---

## 4. تدقيق جدول ومكونات توزيع دفعات العملاء (Client Payment Allocation Legacy Audit)

| المكون / الجدول (Component/Table) | الغرض الحالي (Current Purpose) | هل هو مرجع محاسبي معتمد؟ (Accounting Authoritative?) | هل تعتمد عليه التقارير؟ (Report Dependency?) | هل توجد بيانات تاريخية؟ (Historical Data?) | الإجراء الموصى به (Action) | مخاطر الترحيل (Migration Risk) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `client_payment_allocations` | محاولة تجريبية سابقة لتوزيع الدفعة على الفواتير والبنود | **لا (Non-Authoritative)**. الرصيد المعتمد يقرأ من `client_payments`. | لا. التقارير المالية تقرأ من `client_payments`. | نعم (بيانات قديمة تجريبية). | **Keep in DB as Legacy Informational / Remove from UX Workflow** | **صفر (Zero Risk)**. لا يؤثر حذف الواجهة على سلامة الحسابات. |
| `PaymentAllocationDialog.tsx` | حوار معقد يعرض جدول فواتير لتوزيع الدفعة عليها | **لا**. يعتمد على محاكاة التوزيع. | لا. | لا. | **Deprecate / Replace with Project-Level Payment Modal** | **منعدم**. استبداله يبسط تجربة المستخدم ويمنع الخلط. |
| `ProjectPayments.tsx` | إدارة دفعات المشروع والتسديد | يسجل في `client_payments` (معتمد) وفي `allocations` (غير معتمد). | لا تعتمد على allocations. | نعم. | **تحديث الواجهة لتكون Project-Level بالكامل** | منعدم. |
| `ClientPayments.tsx` | تحصيل دفعات العميل العامة والمشاريع | يسجل في `client_payments` (معتمد). | لا تعتمد على allocations. | نعم. | **تحديث الاختيار: Client → Project فقط** | منعدم. |

---

## 5. سياسة الفائض والدفعات المقدمة (Overpayment & Advance Policy)

- **السلوك المعتمد في المنظومة**:
  - إذا سدد العميل مبلغاً أكبر من المستحق الحالي ($\text{Payment} > \text{Remaining}$):
  - النظام يسجل الدفعة كاملة ويثبت الرصيد كـ **دفعة مقدمة / رصيد دائن للزبون (Advance / Credit Balance)**، بحيث يظهر $\text{Remaining} < 0$ باللون الأخضر كفائض لصالح الزبون يُستنفد مع تسجيل تكاليف مستقبلية في مشاريع التشطيبات أو مستخلصات المقاولات.
  - لا يتم حظر التحصيل المحاسبي، مع إظهار تنبيه بصري واضح للمستخدم في شاشة التحصيل بقيمة الفائض (`surplus`).

---

## 6. الملفات المعدلة وتوحيد النطاق المالي (Unified Codebase Architecture)

1. **`src/lib/financialCore.ts`**:
   - وحدة النطاق المالي الحصريّة (Single Source of Truth) الحاوية على الدالة النقية `calculateProjectFinancials`.
2. **`src/hooks/useProjectFinancialSummary.ts`**:
   - الربط الكامل مع `calculateProjectFinancials` لتزويد كل بطاقات وملخصات المشاريع ببيانات متطابقة لحظياً.
3. **`src/components/projects/ProjectFinancialSummaryCards.tsx`**:
   - تفصيل بطاقة حساب العميل لتعرض قاعدة التكلفة المعتمدة ونسبة الإدارة وإجمالي المستحق في مشاريع التشطيبات.
4. **`src/pages/ClientDetail.tsx`**:
   - توحيد احتساب استحقاقات العميل عبر `calculateProjectFinancials` وتضمين جميع الموارد المباشرة للفنيين والمصروفات.
5. **`src/pages/Clients.tsx`**:
   - توحيد قائمة العملاء وإجمالي المديونيات.
6. **`src/pages/Debts.tsx`**:
   - مطابقة صفحة الديون والذمم لتقرأ من نفس المعادلة المركزية.
7. **`scripts/financial-tests/finishing-cost-plus-invariants.mjs`**:
   - إضافة اختبارات الثبات الدائمة للمنظومة (FINISHING-01 إلى FINISHING-12، و CLIENT-PROJECT-01 إلى CLIENT-PROJECT-06، و NO-CROSS-SETTLEMENT-01 إلى 03).

---

## 7. نتائج اختبارات الثبات المالي وحالة النظام (Test Run Results)

```
================================================================
                      TEST RUN SUMMARY
================================================================
  Run ID:         AUTO-INV-1786887530270
  Total Tests:    50
  Passed:         50
  Failed:         0
  Warnings:       3 (Documented Phase 16 Candidates)
  Status:         ALL INVARIANTS PASSED
================================================================

✓ All accounting invariants passed with 100% mathematical precision.
```

### ملخص تغطية الاختبارات:
- **INV-01 إلى INV-24**: اختبارات تكامل الخزائن والقيود المحاسبية التلقائية (100% PASS).
- **FINISHING-01 إلى FINISHING-12**: اختبارات قاعدة تكلفة التشطيبات بكافة الفئات الخمس، وعزل المصروفات العامة، واحتساب النسبة، وفصل التدفق النقدي (100% PASS).
- **CLIENT-PROJECT-01 إلى CLIENT-PROJECT-06**: دورة حياة دفعات العميل على مستوى المشروع (سداد، إضافة ثانية، تعديل، حذف، ثبات مع سدادات الموردين والفنيين) (100% PASS).
- **NO-CROSS-SETTLEMENT-01 إلى NO-CROSS-SETTLEMENT-03**: اختبارات منع التسوية التقاطعية وضمان استقلال التحصيلات عن الصرف (100% PASS).
- **GOLDEN-01 إلى GOLDEN-05**: مطابقة منظومة المقاولات الذهبية السابقة بدون أدنى تغيير (100% PASS).

---

## 8. الحالة النهائية والبوابة الصارمة (Strict Gate Status)

> [!IMPORTANT]
> - **FC-01 FINISHING COST-PLUS = COMPLETE — VERIFIED**
> - **CLIENT PAYMENT PROJECT-LEVEL RECONCILIATION = COMPLETE — VERIFIED**
> - **UX REBUILD IMPLEMENTATION = PAUSED / NOT STARTED (Waiting for user review)**
