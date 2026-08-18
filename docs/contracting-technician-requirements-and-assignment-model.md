# نموذج متطلبات الفنيين وتعيين الكوادر (المقاولات)

## الهدف

يمكّن هذا النموذج البنود العامة (General Items) من تحديد **ما التخصصات الفنية المطلوبة عادةً** و**كم عدد الفنيين من كل تخصص**، ثم نسخ هذه المتطلبات تلقائياً (Snapshot) إلى بنود مقايسة المشاريع عند إنشائها من بند عام.

## المفاهيم الأساسية

### 1. أنواع الفنيين (Technician Types)
جدول مرجعي مركزي (`technician_types`) يحتوي على التصنيف القياسي:

| الكود | الاسم | حالة |
|-------|-------|------|
| `gypsum` | فني جبس | نشط |
| `assistant` | مساعد فني | نشط |
| `electrician` | كهربائي | نشط |
| `plumber` | سباك | نشط |
| `carpenter` | نجار | نشط |
| `blacksmith` | حداد | نشط |
| `painter` | دهان | نشط |
| `tiler` | مبلط | نشط |
| `aluminum` | ألمنيوم | نشط |
| `builder` | بنّاء | نشط |
| `other` | أخرى | نشط |

### 2. المرجعية الواحدة للتخصص
- `technicians.technician_type_id` → **المرجع الوحيد والحصري** لتصنيف الفني.
- `technicians.specialty` ← حقل نصي قديم يتم **مزامنته تلقائياً** عبر Trigger (`trg_sync_technician_specialty`) ولا يُعتد به مباشرة.

### 3. متطلبات البند العام (Template)
جدول `general_item_technician_requirements`:
- يحدد التخصصات والأعداد المطلوبة للبند العام القابل لإعادة الاستخدام.
- `UNIQUE(general_item_id, technician_type_id)` — لا يُسمح بتكرار نفس التخصص.
- `CHECK(required_count > 0)` — العدد المطلوب يجب أن يكون موجباً.

### 4. متطلبات بند المشروع (Snapshot)
جدول `project_item_technician_requirements`:
- **نسخة مستقلة** من متطلبات البند العام وقت إنشاء بند المشروع.
- تُنشأ تلقائياً عبر Trigger `trg_project_items_auto_snapshot_requirements`.
- تغيير البند العام لاحقاً **لا يؤثر** على البنود المنسوخة مسبقاً.
- حذف البند العام **لا يحذف** متطلبات بنود المشاريع (`ON DELETE SET NULL` على `general_item_id`).

### 5. تعيين الفنيين على بند المشروع
جدول `project_item_technicians`:
- `UNIQUE(project_item_id, technician_id)` — لا يُسمح بتعيين نفس الفني مرتين على نفس البند.

## معادلة اكتمال خطة العمالة

لكل تخصص مطلوب:
$$\text{assignedCount}(T) = \text{COUNT}(\text{assignments where technician.type\_id} = T)$$
$$\text{missingCount}(T) = \max(0, \text{requiredCount}(T) - \text{assignedCount}(T))$$

حالة البند الإجمالية:
$$\text{status} = \begin{cases} \text{no\_requirements} & \text{if requirements} = 0 \\ \text{complete} & \text{if } \forall T, \text{missingCount}(T) = 0 \\ \text{incomplete} & \text{otherwise} \end{cases}$$

## القواعد الحاكمة

| القاعدة | الوصف |
|---------|-------|
| **صفر أثر مالي** | المتطلبات والتعيينات لا تؤثر على حساب ربحية البند أو تكلفته المتكبدة |
| **نمط مطابق فقط** | فني بتخصص مختلف لا يحقق متطلب تخصص آخر |
| **نوع غير معرّف ≠ مطابقة** | فني بدون `technician_type_id` لا يحقق أي متطلب |
| **بنود تاريخية** | لا تُنسخ متطلبات حديثة بأثر رجعي لبنود قديمة |
| **استقلال النسخة** | تعديل/حذف البند العام لا يؤثر على النسخ المنشأة |
| **عملية ذرية** | إنشاء بند المشروع + نسخ المتطلبات = عملية واحدة أو لا شيء |

## مؤشر التنبيه في لوحة المشروع

في `ProjectOverviewHub`:
- يُحسب عدد **بنود المقايسة ذات خطة عمالة غير مكتملة** (وليس عدد الفنيين الناقصين).
- يظهر تنبيه تشغيلي فقط عندما `incompleteItemsCount > 0`.
- يُوجّه المستخدم مباشرة لشاشة بنود المقايسة.

## المحرك المركزي

ملف [`staffingCore.ts`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/src/lib/staffingCore.ts):
- `evaluateItemStaffing(requirements, assignments)` → تقييم اكتمال بند واحد.
- `countIncompleteStaffingProjectItems(items)` → عدد البنود غير المكتملة على مستوى المشروع.

## اختبارات التحقق

مجموعة اختبارات CTS-01 إلى CTS-28 + 5 اختبارات قاعدة بيانات حية:
```bash
npm run test:contracting-technician-staffing
```
