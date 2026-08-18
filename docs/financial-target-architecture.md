# وثيقة التصميم المالي المستهدف وقواعد المصدر الوحيد للحقيقة
## Target Financial Architecture & Single Source of Truth Specification

> **تاريخ الاعتماد:** 2026-08-15  
> **المرجع الإلزامي:** `MASTER_FINANCIAL_SYSTEM_REBUILD_PLAYBOOK_AR.md` — PHASE 2  
> **الحالة:** معتمد وملزم لجميع التعديلات والعمليات في قاعدة البيانات والواجهة الأمامية

---

## 1. مصفوفة المصدر الوحيد للحقيقة (Single Source of Truth Matrix)

لكل حقيقة مالية في المنظومة **مصدر وحيد لا يقبل التكرار أو التضارب**:

| الحقيقة المالية (Financial Fact) | المصدر الوحيد للحقيقة (Single Source of Truth) | طريقة الاحتساب والاشتقاق |
|---|---|---|
| **التزام الزبون (Client Obligation)** | `contracts.amount` أو `SUM(project_items.total_price)` | مجموع القيم التعاقدية المعتمدة للعميل |
| **ما دفعه الزبون (Client Paid)** | `client_payments.amount` | `SUM(amount) FROM client_payments WHERE client_id = ...` |
| **المتبقي على الزبون (Client Due)** | مشتق رياضياً فقط (Derived) | `التزام الزبون - ما دفعه الزبون` |
| **التزام المورد (Supplier Obligation)** | `purchases.total_amount` | `SUM(total_amount) FROM purchases WHERE supplier_id = ...` |
| **ما تم دفعه للمورد (Supplier Paid)** | `purchase_payments.amount` | `SUM(amount) FROM purchase_payments WHERE purchase_id IN (مشتريات المورد)` |
| **المتبقي للمورد (Supplier Due)** | مشتق رياضياً فقط (Derived) | `التزام المورد - ما تم دفعه للمورد` |
| **استحقاق الفني (Technician Obligation)** | `technician_progress_records` أو `project_item_technicians` | `SUM(quantity_completed * rate_per_unit)` |
| **ما تم دفعه للفني (Technician Paid)** | `purchase_payments.amount` (حيث `technician_id IS NOT NULL`) | `SUM(amount) FROM purchase_payments WHERE technician_id = ...` |
| **المتبقي للفني (Technician Due)** | مشتق رياضياً فقط (Derived) | `استحقاق الفني - ما تم دفعه للفني` |
| **المصروفات الفعلية (Expenses)** | `expenses.amount` | `SUM(amount) FROM expenses` |
| **المنصرف الفعلي للمشروع (Project Spent)** | مشتق من مشتريات + مصروفات + إيجارات + عهد المشروع | `purchases(total) + expenses + rentals + custody(spent)` |
| **الأثر النقدي ورصيد الخزينة (Treasury Cash Flow)** | `treasury_transactions` | `الرصيد الافتتاحي + SUM(deposit) - SUM(withdrawal)` |
| **التحويلات بين الحسابات (Transfers)** | `transfers` + زوج حركات متطابق في `treasury_transactions` | حركة سحب من المصدر + حركة إيداع في الوجهة |

---

## 2. آلات الحالات والتدفقات المحاسبية (State Machines)

```
========================================================================================
                                     STATE MACHINES
========================================================================================
```

### أ) دورة مدفوعات الزبائن (Client State Machine)
```
[ إنشاء العقد / البنود ]
         │
         ▼
[ التزام على الزبون لصالح الشركة ]  (لا يوجد أي تأثير على الخزينة)
         │
         ▼
[ تسديد دفعة من الزبون: INSERT client_payments ]
         │
         ├──► تخفيض دين الزبون فوراً
         └──► توليد حركة واحدة فقط: [ ONE Treasury IN (Deposit) ]
```

### ب) دورة فواتير المشتريات والموردين (Purchase & Supplier State Machine)
```
[ إنشاء فاتورة مشتريات: INSERT purchases ]
         │
         ├──► نشوء التزام مالي على الشركة تجاه المورد (Supplier Due increases)
         ├──► احتساب الفاتورة ضمن تكلفة المشروع (Project Spent increases)
         └──► [ NO Treasury Change ] (لا تتأثر الخزينة إطلاقاً حتى يتم السداد)
         │
         ▼
[ سداد دفعة للمورد: INSERT purchase_payments ]
         │
         ├──► تخفيض التزام المورد (Supplier Due decreases)
         ├──► تحديث قيمة purchases.paid_amount كحقل مشتق
         └──► توليد حركة واحدة فقط: [ ONE Treasury OUT (Withdrawal) ]
```

### ج) دورة مستحقات الفنيين (Technician State Machine)
```
[ تسجيل إنجاز فني: INSERT technician_progress_records ]
         │
         ├──► زيادة استحقاق الفني المنجز (Technician Due increases)
         └──► [ NO Treasury Change ] (لا تتأثر الخزينة)
         │
         ▼
[ سداد دفعة للفني: INSERT purchase_payments (technician) ]
         │
         ├──► تخفيض مستحق الفني المتبقي (Technician Due decreases)
         └──► توليد حركة واحدة فقط: [ ONE Treasury OUT (Withdrawal) ]
```

### د) دورة المصروفات (Expenses State Machine)
```
[ تسجيل مصروف: INSERT expenses ]
         │
         ├──► توليد حركة واحدة فقط: [ ONE Treasury OUT (Withdrawal) ]
         └──► تصنيف الأثر الإداري:
                 ├── إذا كان (project_id != null) ──► يدخل في تكلفة المشروع (Project Cost)
                 └── إذا كان (project_id == null) ──► يسجل كمصروف عام للشركة فقط
```

### هـ) دورة التحويل بين الخزائن (Transfers State Machine)
```
[ تحويل مالي: INSERT transfers ]
         │
         ├──► حركة خروج: [ Source Treasury OUT (Withdrawal) ]
         ├──► حركة دخول: [ Destination Treasury IN (Deposit) ]
         └──► القاعدة: [ Total Company Cash Before == Total Company Cash After ]
```

---

## 3. حسم وضع حقل `purchases.paid_amount` (Purchase Paid Decision)

* **القرار المعتمد:** 
  * جدول `purchase_payments` هو **المصدر الوحيد للحقيقة (Source of Truth)** لجميع المدفوعات المسددة للمشتريات والموردين والفنيين.
  * حقل `purchases.paid_amount` يُعتبر **حقل مشتق للقراءة السريعة (Compatibility Cache)** فقط، ويتم تحديثه حصرياً بواسطة تريغر قاعدة البيانات كناتج:
    `SUM(amount) FROM purchase_payments WHERE purchase_id = NEW.purchase_id`
  * **ممنوع قطعيّاً** الاعتماد على `purchases.paid_amount` لإنشاء حركات سحب خزينة مستقلة في حال وجود سجلات في `purchase_payments` لمنع الازدواجية.

---

## 4. قاعدة منع التسوية المتقاطعة (PROHIBITED CROSS-SETTLEMENT RULE)

تعتبر هذه القاعدة ملزمة ومطلقة في جميع أجزاء المنظومة:

1. **Client Payment** لا تسدد موردين أو فنيين أو فواتير مشتريات أو مصروفات. تسديد الزبون يزيد نقدية الشركة ويخفض دين الزبون فقط.
2. **Supplier Payment** لا تغير دين الزبون أو تحصيلاته.
3. **Technician Payment** لا تغير دين الزبون أو مشتريات المورد.
4. **Expense** لا يغير حالة تسديدات الزبائن.
5. **الربط بالمشروع (`project_id`)** هو تصنيف تحليلي لتقارير الأرباح والتدفقات، ولا يعني إطلاقاً تسوية الديون بين أطراف المشروع.

---

## 5. بوابة القبول (Phase 2 Acceptance Gate)

* تم تحديد المصدر الوحيد للحقيقة لكل رقم ومؤشر مالي بدقة رياضية لا تحتمل اللبس.
* تم تعريف التدفقات ومخططات الحالات بدون أي تقاطع أو ازدواجية.

```text
PHASE 2 = COMPLETE
```
