# توثيق المعالجة المحاسبية والتعاقدية لبنود المقايسة ومشتريات مشاريع المقاولات
## Contracting BOQ Item Profitability & Purchase Semantics

---

### 1. المقدمة ونطاق المعالجة
يهدف هذا التوثيق إلى ضبط القواعد المحاسبية والتعاقدية لبنود المقايسة (BOQ Items) وقوائم المشتريات والمصروفات داخل منظومة "الفارس الذهبي / ركاز"، بما يضمن التطابق التام مع القواعد الأساسية المقفلة (FC-01 و FC-02) وعزل المفاهيم التعاقدية عن تدفقات السيولة النقدية.

---

### 2. مصفوفة إسناد التكاليف إلى بنود المقايسة (Cost Attribution Matrix)

| نطاق التكلفة (Cost Domain) | الجدول المعتمد | هل يدعم `project_item_id`؟ | الحماية على مستوى الخادم (Server Triggers) | الأثر في تكلفة البند | طريقة منع التكرار (Double-Count Prevention) |
|---|:---:|:---:|:---:|:---:|---|
| **العمالة والفنيون (Labor)** | `technician_progress_records` | **نعم (`NOT NULL`)** | FK مباشر إلى `project_items.id` | **نعم (أساسي ومعتمد)** | تجميع `SUM(earned_amount)` لجميع سجلات الإنجاز الفعلية المعتمدة لكل فني على البند. استبعاد `project_item_technicians.total_cost` (تقدير أولي فقط). |
| **مشتريات المواد (Materials)** | `purchases` (`material` / null) | **نعم (`NULLABLE`)** | `trg_validate_purchase_item_ownership` | **نعم (عند الربط بالبند)** | تُحسب القيمة الكاملة للفاتورة `total_amount` إذا كان `project_item_id = item.id` وصُنفت كشراء مواد وفق قواعد FC-01. |
| **خدمات الموردين (Services)** | `purchases` (`purchase_type = 'service'`) | **نعم (`NULLABLE`)** | `trg_validate_purchase_item_ownership` | **نعم (عند الربط بالبند)** | تُحسب القيمة الكاملة للفاتورة إذا كان `project_item_id = item.id` وصُنفت كخدمة مورد. |
| **المصروفات المباشرة (Expenses)** | `expenses` | **نعم (`NULLABLE`)** | `trg_validate_expense_item_ownership` | **نعم (عند الربط بالبند)** | تُحسب قيمة المصروف `amount` عند الربط المباشر ببند المقايسة. |
| **إيجار المعدات (Equipment Rentals)** | `equipment_rentals` | **لا** | مستوى المشروع فقط | **لا ($0$ للبند الفردي)** | لا يتم إسناد أو تخمين إيجارات المعدات على بنود المقايسة الفردية؛ تدخل حصراً في تكلفة المشروع المباشرة العامة. |

---

### 3. معادلات ربحية بنود المقايسة (BOQ Profitability Formulas)

```typescript
// القيمة التجارية التعاقدية للبند (المرجعية الصارمة للحقل: إذا لم يكن NULL يُعتمد total_price حتى لو كان 0، وإلا يُستخدم البديل)
commercialValue = item.total_price !== null && item.total_price !== undefined
  ? Number(item.total_price)
  : Number(item.quantity || 0) * Number(item.unit_price || 0)

// نسبة الإنجاز المعتمدة (المصدر الحصري: progress في جدول project_items)
approvedProgressPercent = Math.min(100, Math.max(0, item.progress || 0))

// القيمة المكتسبة حتى تاريخه
earnedCommercialValueToDate = commercialValue * (approvedProgressPercent / 100)

// التكلفة المتكبدة بالبند حتى تاريخه (استحقاق)
totalAttributedItemIncurred = laborIncurred + materialPurchasesIncurred + supplierServicesIncurred + directExpensesIncurred

// الربح الإجمالي حتى تاريخه
actualToDateGrossProfit = earnedCommercialValueToDate - totalAttributedItemIncurred

// نسبة هامش الربح حتى تاريخه (تكون null أو غير متاحة إذا كانت القيمة المكتسبة = 0)
actualToDateMarginPercent = earnedCommercialValueToDate > 0 
  ? (actualToDateGrossProfit / earnedCommercialValueToDate) * 100 
  : null
```

---

### 4. التوافق المحاسبي والتسوية (Financial Reconciliation)

1. **إجمالي تكلفة المشروع المباشرة المتكبدة**:
   $$\text{Project Incurred Cost} = \sum (\text{Attributed Item Incurred Cost}) + \text{Unattributed Project Cost}$$
2. **عزل السيولة النقدية عن التكلفة المتكبدة**:
   - سداد فواتير المشتريات أو مستحقات الفنيين يغير فقط أرصدة الخزينة والذمم الدائنة، ولا يؤثر إطلاقاً على تكلفة البند المتكبدة أو ربحه الإجمالي.
3. **منع الأرباح التقديرية الوهمية**:
   - لا يجوز حساب `Commercial Value - Incurred Cost` وتسميتها "ربح متوقع" أو "ربح نهائي" لبند لم يكتمل إنجازه.

---

### 5. حماية الخادم الصارمة (Server-Side Ownership Triggers)
تم تطبيق المشغل `validate_project_item_ownership()` على جدولي `purchases` و `expenses` لمنع إسناد أي فاتورة شراء أو مصروف مباشر تابع لمشروع إلى بند يتبع مشروعاً آخر:
```sql
CREATE OR REPLACE FUNCTION public.validate_project_item_ownership()
RETURNS TRIGGER AS $$
DECLARE
    v_item_project_id uuid;
BEGIN
    IF NEW.project_item_id IS NOT NULL THEN
        SELECT project_id INTO v_item_project_id
        FROM public.project_items
        WHERE id = NEW.project_item_id;
        
        IF v_item_project_id IS NULL OR v_item_project_id != NEW.project_id THEN
            RAISE EXCEPTION 'Cross-project item attribution violation: project_item % does not belong to project %',
                NEW.project_item_id, NEW.project_id
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 6. ملخص اختبارات التحقق من السلامة (Test Suite Status)
- **مجموعة اختبارات دلالات المقاولات (`npm run test:contracting-semantics`)**: 43/43 نجاح (100%).
- **المجموعة المالية الشاملة (`npm run test:financial`)**: 86/86 نجاح (100%).
- **مجموعة مسارات التنقل (`npm run test:navigation`)**: 15/15 نجاح (100%).
- **مجموعة المرحلة الثانية UX (`npm run test:ux-phase2`)**: 22/22 نجاح (100%).
- **مجموعة المرحلة الثالثة UX (`npm run test:ux-phase3`)**: 37/37 نجاح (100%).
- **مجموعة المرحلة الرابعة الهيكلية وقاعدة البيانات الحية (`npm run test:ux-phase4`)**: 35/35 نجاح (100%).
- **إجمالي اختبارات المنظومة (`npm run test:all`)**: 238/238 نجاح (100%).
- **بناء الإنتاج (`npm run build`)**: نجاح تام (0 أخطاء).
