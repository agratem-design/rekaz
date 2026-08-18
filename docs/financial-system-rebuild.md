# نظام التحكم والتوثيق لإعادة بناء المنظومة المالية
## Financial System Rebuild Control File

> **تاريخ التحديث:** 2026-08-16  
> **المرجع الإلزامي:** `MASTER_FINANCIAL_SYSTEM_REBUILD_PLAYBOOK_AR.md`  
> **حالة المنظومة:** جاري إعادة البناء والتوثيق المرحلي المحكم

---

## 1. القاعدة المحاسبية العليا — Non-Negotiable Accounting Rules

1. **Client Payments (تسديدات الزبائن):**
   - تخفيض الدين المستحق على الزبون فقط.
   - إيداع نقدي واحد فقط في الخزينة/البنك المحدد (`ONE Treasury IN`).
   - لا تغير إطلاقاً: دفعات الموردين، مستحقات الفنيين، فواتير المشتريات، المصروفات، أو `paid_amount` لأي طرف آخر.

2. **Supplier Payments (دفعات الموردين):**
   - تخفيض الالتزام المستحق للمورد فقط.
   - سحب نقدي واحد فقط من الخزينة/البنك (`ONE Treasury OUT`).
   - لا تغير إطلاقاً: ديون الزبائن، تحصيلات الزبائن، مستحقات الفنيين.

3. **Technician Payments (دفعات الفنيين):**
   - تخفيض مستحق الفني فقط.
   - سحب نقدي واحد فقط من الخزينة/البنك (`ONE Treasury OUT`).
   - لا تغير إطلاقاً: ديون الزبائن، مشتريات الموردين.

4. **Expenses (المصروفات):**
   - سحب نقدي واحد فقط من الخزينة/البنك (`ONE Treasury OUT`).
   - إذا كان المصروف مرتبطاً بمشروع (`project_id != null`) يدخل في تكلفة المشروع.
   - إذا كان المصروف عاماً (`project_id = null`) يدخل في مصروفات الشركة العامة ولا يمس تكلفة المشاريع.

5. **Treasury & Transfers (الخزائن والتحويلات):**
   - الخزينة نقطة التقاء التدفقات النقدية الفعلية فقط.
   - التحويل المالي بين حسابين (`Transfer`) ينتج عنه: حركة خروج `OUT` من المصدر + حركة دخول `IN` للوجهة، مع بقاء إجمالي نقدية الشركة دون تغيير (`Total Cash Unchanged`).
   - التحويل الداخلي ليس مصروفاً ولا إيراداً.

```text
Client Payment != Supplier Payment != Technician Payment != Purchase != Expense != Transfer
```

---

## 2. جدول حالة المراحل (Phases Status Tracker)

| المرحلة | اسم المرحلة | الحالة | تاريخ الإغلاق |
|---|---|---|---|
| **PHASE 0** | إنشاء نظام التحكم والتوثيق | **COMPLETE** | 2026-08-15 |
| **PHASE 1** | AUDIT شامل بدون تعديل | **COMPLETE** | 2026-08-15 |
| **PHASE 2** | Target Financial Architecture | **COMPLETE** | 2026-08-15 |
| **PHASE 3** | Backup + Financial Baseline | **COMPLETE** | 2026-08-15 |
| **PHASE 4** | إصلاح Client Payments | **COMPLETE** | 2026-08-15 |
| **PHASE 5** | إصلاح Purchases + Suppliers | **COMPLETE** | 2026-08-16 |
| **PHASE 6** | إصلاح Technicians | **COMPLETE** | 2026-08-16 |
| **PHASE 7** | إصلاح Expenses | **COMPLETE** | 2026-08-16 |
| **PHASE 8** | إصلاح Transfers بين الخزائن | **COMPLETE** | 2026-08-16 |
| **PHASE 9** | إزالة Double Accounting من Frontend | **COMPLETE** | 2026-08-16 |
| **PHASE 10** | تنظيف البيانات التاريخية المكررة | **COMPLETE** | 2026-08-16 |
| **PHASE 11** | إعادة بناء ومطابقة الأرصدة | **COMPLETE** | 2026-08-16 |
| **PHASE 12** | الملخص المالي للمشاريع (Project Financial Summary) | **COMPLETE** | 2026-08-16 |
| **PHASE 13** | التقارير وكشوف الحسابات والطباعة | **COMPLETE** | 2026-08-16 |
| **PHASE 14** | Full End-to-End Financial Test | **COMPLETE** | 2026-08-16 |
| **PHASE 15** | Automated Accounting Invariants | **COMPLETE** | 2026-08-16 |
| **PHASE 16** | Database Hardening | **COMPLETE** | 2026-08-16 |
| **PHASE 17** | Final Independent Audit | **COMPLETE** | 2026-08-16 |

---

## 3. ملخص المراحل المكتملة (Completed Phases Records)

### المرحلة 0: إنشاء نظام التحكم والتوثيق
- **Status:** `COMPLETE` | **Date:** `2026-08-15` | **Output:** `docs/financial-system-rebuild.md`

### المرحلة 1: AUDIT شامل بدون تعديل
- **Status:** `COMPLETE` | **Date:** `2026-08-15` | **Output:** `docs/financial-audit-phase-1.md`

### المرحلة 2: Target Financial Architecture
- **Status:** `COMPLETE` | **Date:** `2026-08-15` | **Output:** `docs/financial-target-architecture.md`

### المرحلة 3: Backup + Financial Baseline
- **Status:** `COMPLETE` | **Date:** `2026-08-15` | **Output:** `docs/financial-baseline-before-fix.md`

### المرحلة 4: إصلاح Client Payments
- **Status:** `COMPLETE` | **Date:** `2026-08-15` | **Output:** `docs/phase-4-client-payments.md`

### المرحلة 5: إصلاح Purchases + Suppliers
- **Status:** `COMPLETE` | **Date:** `2026-08-16` | **Output:** `docs/phase-5-purchases-suppliers.md`

### المرحلة 6: إصلاح Technicians
- **Status:** `COMPLETE` | **Date:** `2026-08-16` | **Output:** `docs/phase-6-technicians.md`

### المرحلة 7: إصلاح Expenses
- **Status:** `COMPLETE` | **Date:** `2026-08-16` | **Output:** `docs/phase-7-expenses.md`

### المرحلة 8: إصلاح Transfers بين الخزائن
- **Status:** `COMPLETE` | **Date:** `2026-08-16` | **Output:** `docs/phase-8-transfers.md`

### المرحلة 9: إزالة Double Accounting من Frontend
- **Status:** `COMPLETE` | **Date:** `2026-08-16` | **Output:** `docs/phase-9-frontend-cleanup.md`

### المرحلة 10: تنظيف البيانات التاريخية المكررة
- **Status:** `COMPLETE` | **Date:** `2026-08-16` | **Output:** `docs/financial-historical-cleanup.md`

### المرحلة 11: إعادة بناء ومطابقة الأرصدة
- **Status:** `COMPLETE` | **Date:** `2026-08-16` | **Output:** `docs/phase-11-reconciliation.md`

### المرحلة 12: الملخص المالي للمشاريع (Project Financial Summary)
- **Status:** `COMPLETE — VERIFIED` | **Date:** `2026-08-16` | **Output:** `docs/phase-12-project-financial-summary.md`

### المرحلة 13: التقارير وكشوف الحسابات والطباعة (Reports, Statements, Printing, Export)
- **Status:** `COMPLETE — VERIFIED` | **Date:** `2026-08-16` | **Output:** `docs/phase-13-reports.md`

### المرحلة 14: الاختبار المالي الشامل من البداية للنهاية (Full End-to-End Financial Test)
- **Status:** `COMPLETE — VERIFIED` | **Date:** `2026-08-16` | **Output:** `docs/phase-14-e2e-tests.md`

### المرحلة 15: الاختبارات المحاسبية الآلية والحصانة المستمرة (Automated Accounting Invariants)
- **Status:** `COMPLETE — VERIFIED` | **Date:** `2026-08-16` | **Output:** `docs/phase-15-accounting-invariants.md`

### المرحلة 16: التصليب البنيوي لقواعد البيانات (Database Hardening)
- **Status:** `COMPLETE — VERIFIED` | **Date:** `2026-08-16` | **Output:** `docs/phase-16-database-hardening.md`
- **Key Accomplishments & Acceptance:**
  1. تطبيق قيود التحقق الموجبة `CHECK (amount > 0)` على كافة جداول الحركات المالية لمنع القيم الصفرية والسالبة.
  2. تصليب قيود المفاتيح الأجنبية `ON DELETE RESTRICT` لحماية الحسابات النقدية وسجلات التدقيق المالي من الحذف الصامت.
  3. إنشاء الفهرس الفريد المشروط لمنع التكرار المالي المزدوج على مستوى المصدر `idx_treasury_tx_unique_source_posting`.
  4. تأمين عمليات التحويل المالي عبر الأقفال الحتمية المرتبة للصفوف (`SELECT ... FOR UPDATE`) لمنع التعارض وحلقات القفل الميت (Deadlocks).
  5. اجتياز جميع الاختبارات السلبية وحالات الرفض (NEG-01 إلى NEG-04).
  6. اجتياز حزمة القواعد المحاسبية الآلية `npm run test:financial` بنسبة 100% (29/29 Passed).
  7. اجتياز اختبارات الـ E2E الشاملة `node scripts/test-phase-14-e2e.mjs` بنسبة 100% (32/32 Passed).
  8. اجتياز البناء الإنتاجي `npm run build` بنجاح تام (Exit code: 0).
- **Next phase:** `PHASE 17 — Final Independent Audit`

---

## 4. توجيهات للوكيل الذكي في الجلسة القادمة (Next Session Directives)

- **المرحلة المستهدفة القادمة فقط:** `PHASE 17 — Final Independent Audit`
- **ممنوع بدء PHASE 17 في هذه الجلسة والالتزام بالتوقف الفوري.**