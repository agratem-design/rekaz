# MASTER FINANCIAL SYSTEM REBUILD PLAYBOOK
## خطة إعادة بناء النظام المالي — ملف التنفيذ المرحلي للوكيل الذكي

> هذا الملف هو المرجع الرئيسي والملزم لأي وكيل ذكاء اصطناعي يعمل على النظام المالي.
>
> **يجب قراءة هذا الملف كاملاً في بداية كل جلسة قبل تنفيذ أي تعديل.**
>
> الوكيل ينفذ **مرحلة واحدة فقط في كل جلسة**، ثم يتوقف بعد إغلاقها واختبارها وتوثيقها.
>
> لا يجوز الانتقال إلى المرحلة التالية في نفس الجلسة إلا إذا طلب المستخدم ذلك صراحة.

---

# 0) القاعدة المحاسبية العليا — NON-NEGOTIABLE ACCOUNTING RULE

يجب اعتبار القاعدة التالية أساس النظام بالكامل، وأي كود يخالفها يعتبر خطأً يجب اكتشافه ومعالجته:

## Client Payments

تسديد الزبون يعني فقط:

1. تخفيض الدين المستحق على الزبون.
2. زيادة رصيد الخزينة/البنك المختار.
3. إذا كانت الدفعة مرتبطة بمشروع، تظهر كتحصيل متعلق بذلك المشروع لأغراض التقارير فقط.

ولا يعني إطلاقاً:

- دفع مورد.
- دفع فني.
- تسديد فاتورة مشتريات.
- تغطية مصروف.
- تغيير حالة أي التزام على المشروع.
- تغيير `paid_amount` لمورد أو فني أو Purchase.
- اعتبار المشروع "ممولاً" أو "مسدداً" من الناحية التشغيلية.

## Supplier Payments

دفعة المورد تعني فقط:

1. تخفيض المبلغ المستحق للمورد.
2. تخفيض رصيد الخزينة/البنك الذي خرجت منه الأموال.

ولا تغيّر:

- دين الزبون.
- تحصيلات الزبون.
- مستحقات الفنيين.
- دفعات الفنيين.

## Technician Payments

دفعة الفني تعني فقط:

1. تخفيض مستحق الفني.
2. تخفيض رصيد الخزينة/البنك.

ولا تغيّر:

- دين الزبون.
- مشتريات المورد.
- مستحق المورد.

## Expenses

المصروف المدفوع يعني فقط:

1. تسجيل المصروف في نطاقه الصحيح.
2. تخفيض الخزينة/البنك.
3. إذا كان مصروف مشروع، يدخل في تكلفة المشروع.
4. إذا كان مصروفاً عاماً، لا يدخل في تكلفة مشروع.

## Treasury

الخزينة هي نقطة التقاء التدفقات النقدية فقط.

**العلاقة الوحيدة المشتركة بين جميع المجالات هي أن العمليات النقدية الفعلية تؤثر على Treasury.**

الصيغة الذهنية الإلزامية:

```text
Client Payment
!= Supplier Payment
!= Technician Payment
!= Purchase
!= Expense
!= Transfer
```

---

# 1) قاعدة Single Source of Truth

يجب أن يكون لكل حقيقة مالية مصدر واحد فقط.

النموذج المستهدف:

| الحقيقة المالية | المصدر الوحيد للحقيقة |
|---|---|
| قيمة التزام الزبون | العقود/الفواتير |
| ما دفعه الزبون | `client_payments` |
| المتبقي على الزبون | التزام الزبون - `client_payments` |
| التزام المورد | `purchases` |
| ما تم دفعه للمورد | `purchase_payments` |
| المتبقي للمورد | `purchases - purchase_payments` |
| استحقاق الفني | جدول/مصدر استحقاقات الفنيين |
| ما دفع للفني | `technician_payments` أو المصدر الفعلي المعتمد |
| المتبقي للفني | الاستحقاقات - الدفعات |
| المصروفات | جدول المصروفات المعتمد |
| الأثر النقدي | `treasury_transactions` |
| التحويل بين الحسابات | `transfers` + حركتا Treasury مرتبطتان |

ممنوع أن يكون هناك مصدران مستقلان قادران على تغيير الحقيقة المالية نفسها.

---

# 2) قواعد الجلسة الإلزامية

في بداية كل جلسة:

1. اقرأ هذا الملف كاملاً.
2. اقرأ ملف تقدم المشروع إن وجد:
   - `docs/financial-system-rebuild.md`
3. اقرأ تقارير المراحل السابقة ذات العلاقة.
4. حدد أول مرحلة حالتها:
   - `NOT STARTED`
   - أو `BLOCKED` وتم حل سبب الحظر.
5. نفذ **مرحلة واحدة فقط**.
6. لا تبدأ المرحلة التالية.
7. لا تعدّل خارج Scope المرحلة الحالية إلا إذا كان ذلك Dependency مباشر يمنع إكمال المرحلة.
8. إذا اضطررت لتعديل Dependency خارج النطاق:
   - وثّق السبب.
   - اجعل التعديل أقل ما يمكن.
   - لا توسع العمل إلى مرحلة أخرى.

---

# 3) ممنوعات عامة

ممنوع:

- التخمين في أسماء الجداول أو الحقول أو التريغرات.
- حذف Trigger قبل معرفة من يستدعيه.
- حذف Function قبل معرفة تأثيرها.
- حذف بيانات مالية بناءً فقط على:
  - المبلغ.
  - التاريخ.
  - الوصف.
- الاعتماد على `description` كمرجع أساسي للحركة.
- إضافة Patch سريع يخفي الخطأ.
- إنشاء Source of Truth إضافي.
- جعل Frontend وDatabase يكتبان نفس الحركة المالية.
- اعتبار نجاح Build دليلاً على صحة المحاسبة.
- ترك TODO داخل Scope المرحلة الحالية.
- إعلان COMPLETE مع وجود اختبار قبول فاشل.
- الانتقال لمرحلة أخرى بسبب توفر وقت إضافي في الجلسة.

---

# 4) قاعدة الإغلاق

لا تعتبر المرحلة مكتملة إلا إذا:

1. تم تنفيذ جميع بنود Scope.
2. تم تشغيل جميع اختبارات القبول.
3. جميع الاختبارات PASS.
4. تمت مراجعة النتائج الفعلية مقابل Expected.
5. تم توثيق الملفات المعدلة.
6. تم توثيق SQL/Migrations.
7. تم تحديث ملف التقدم.
8. لم يبق TODO داخل Scope المرحلة.
9. تم تسجيل المشاكل التي تقع خارج Scope.
10. تم كتابة الحالة:

```text
PHASE X = COMPLETE
```

إذا تعذر الإكمال:

```text
PHASE X = BLOCKED
```

ويجب توثيق:

- سبب الحظر.
- الدليل.
- ما تم تنفيذه.
- ما لم يتم تنفيذه.
- ما المطلوب لفك الحظر.

**ممنوع استخدام PARTIALLY COMPLETE كبديل للهروب من إكمال العمل.**

---

# 5) ملف التحكم الرئيسي

يجب إنشاء/تحديث:

```text
docs/financial-system-rebuild.md
```

ويحتوي دائماً على:

```text
PHASE 0: NOT STARTED
PHASE 1: NOT STARTED
PHASE 2: NOT STARTED
PHASE 3: NOT STARTED
PHASE 4: NOT STARTED
PHASE 5: NOT STARTED
PHASE 6: NOT STARTED
PHASE 7: NOT STARTED
PHASE 8: NOT STARTED
PHASE 9: NOT STARTED
PHASE 10: NOT STARTED
PHASE 11: NOT STARTED
PHASE 12: NOT STARTED
PHASE 13: NOT STARTED
PHASE 14: NOT STARTED
PHASE 15: NOT STARTED
PHASE 16: NOT STARTED
PHASE 17: NOT STARTED
```

وملخص لكل مرحلة مكتملة:

```text
Phase:
Status:
Date:
Migrations:
Modified files:
Tests:
Remaining out-of-scope issues:
Next phase:
```

---

# PHASE 0 — إنشاء نظام التحكم والتوثيق

## الهدف

إنشاء البنية المرجعية التي تضمن استمرار العمل بين الجلسات.

## المطلوب

إنشاء:

```text
docs/financial-system-rebuild.md
```

وإضافة:

- القاعدة المحاسبية العليا.
- قائمة المراحل.
- حالة كل مرحلة.
- قرارات التصميم.
- قائمة الجداول ذات العلاقة.
- قائمة الملفات الرئيسية ذات العلاقة.
- سجل المشاكل المكتشفة.
- سجل Migrations.
- سجل اختبارات القبول.

## ممنوع

- إجراء إصلاح محاسبي فعلي.
- حذف Triggers.
- تعديل Functions.
- تنظيف بيانات.

## Acceptance Gate

يجب أن يصبح من الممكن لوكيل جديد قراءة الملف وفهم:

- ما الهدف.
- ما القواعد.
- ما المرحلة التالية.
- ما الذي تم إنجازه.

عند النجاح:

```text
PHASE 0 = COMPLETE
```

ثم توقف.

---

# PHASE 1 — AUDIT شامل بدون تعديل

## الهدف

فهم النظام المالي الحالي بالكامل قبل أي إصلاح.

## ممنوع في هذه المرحلة

**أي تعديل مالي أو حذف أو Migration إصلاحية.**

يسمح فقط بعمليات القراءة والتحليل والتوثيق.

## Database Audit

افحص جميع العناصر المتعلقة مالياً:

```text
tables
columns
foreign keys
indexes
constraints
triggers
functions
views
RLS policies
RPC functions
```

ابحث خصوصاً حول:

```text
clients
projects
contracts
client_payments
suppliers
purchases
purchase_payments
technicians
technician_payments
expenses
project expenses
treasuries
treasury_transactions
transfers
project_phases
```

لا تقتصر على هذه الأسماء إذا ظهرت Dependencies إضافية.

## Trigger Inventory

أنشئ Matrix:

| Table | Event | Trigger | Function | Reads | Writes | Financial Effect |

## Frontend Audit

ابحث عالمياً عن:

```text
treasury_transactions
client_payments
purchase_payments
purchases
technician_payments
expenses
transfers
paid_amount
remaining_amount
balance
```

وابحث خصوصاً عن:

```typescript
.from('treasury_transactions').insert(...)
```

## يجب فحص الملفات المعروفة على الأقل

```text
Expenses.tsx
ClientPayments.tsx
ProjectPurchases.tsx
SupplierDetail.tsx
TechnicianDetail.tsx
ProjectExpenses.tsx
ClientDetail.tsx
```

لكن لا تعتبرها القائمة الكاملة.

## المخرج الإلزامي

أنشئ:

```text
docs/financial-audit-phase-1.md
```

ويحتوي على:

### A. مسارات Client Payment

```text
UI
↓
source table
↓
trigger/function
↓
treasury
```

### B. مسارات Supplier Payment

### C. مسارات Technician Payment

### D. مسارات Expenses

### E. مسارات Transfers

### F. جميع Duplicate Triggers

### G. جميع Double-Accounting Paths

### H. كل مكان يغير:

```text
paid_amount
remaining_amount
balance
status
treasury balance
```

### I. جميع المناطق ذات الخطر العالي

## أسئلة يجب الإجابة عنها قبل COMPLETE

- كيف يتم تسجيل Client Payment؟
- كم Treasury Transaction تنتج منه؟
- من يحسب دين العميل؟
- كيف يتم تسجيل Purchase؟
- كيف يتم دفع المورد؟
- كيف يتم حساب `paid_amount`؟
- كيف يعمل `purchase_payments`؟
- كيف يتم دفع الفني؟
- من يحسب مستحق الفني؟
- كيف يتم تسجيل Expense؟
- كيف يتم تعديل Expense؟
- كيف تعمل Transfers؟
- كيف تعمل DELETE؟
- كيف تعمل UPDATE؟
- أين يقوم Frontend بكتابة Treasury مباشرة؟
- ما Duplicate Triggers الموجودة؟
- ما Functions التي تحذف أو تستبدل Treasury entries؟

## Acceptance Gate

لا يوجد سؤال جوهري مالي بلا إجابة موثقة.

عند النجاح:

```text
PHASE 1 = COMPLETE
```

ثم توقف.

---

# PHASE 2 — Target Financial Architecture

## الهدف

تحويل Audit إلى تصميم مالي نهائي مكتوب قبل الإصلاح.

## المطلوب

أنشئ:

```text
docs/financial-target-architecture.md
```

## Source of Truth Matrix

وثّق المصدر الوحيد لكل:

- Client obligations.
- Client payments.
- Supplier obligations.
- Supplier payments.
- Technician obligations.
- Technician payments.
- Expenses.
- Treasury movements.
- Transfers.

## State Machines

### Client

```text
Contract / Invoice
↓
Client owes company

Client Payment
↓
Client debt decreases
↓
ONE Treasury IN
```

### Purchase

```text
Purchase created
↓
Supplier obligation increases
↓
NO Treasury change

Purchase Payment
↓
Supplier obligation decreases
↓
ONE Treasury OUT
```

### Technician

```text
Technician entitlement recorded
↓
Technician due increases
↓
NO Treasury change

Technician Payment
↓
Technician due decreases
↓
ONE Treasury OUT
```

### Expense

```text
Paid Expense
↓
ONE Treasury OUT
↓
Project cost only if project_id is present
```

### Transfer

```text
Transfer
↓
Source Treasury OUT
+
Destination Treasury IN
↓
Company total cash unchanged
```

## Purchase paid_amount Decision

يجب حسم وضع:

```text
purchases.paid_amount
```

القاعدة المفضلة:

```text
purchase_payments = Source of Truth
paid_amount = derived / compatibility cache only
```

إذا كان هناك سبب تقني للاحتفاظ به كحقل، يجب أن يكون مشتقاً ولا يُعامل كمصدر مستقل.

## Required Architecture Rule

اكتب صراحة:

```text
PROHIBITED CROSS-SETTLEMENT RULE
```

ويشمل:

- Client Payment لا يعدل Supplier/Technician/Purchase settlement.
- Supplier Payment لا يعدل Client debt.
- Technician Payment لا يعدل Client debt.
- Expense لا يعدل Client payment state.
- الربط بالمشروع لا يعني تسوية الديون بين الأطراف.

## Acceptance Gate

لكل رقم مالي Source of Truth واحد فقط.

عند النجاح:

```text
PHASE 2 = COMPLETE
```

ثم توقف.

---

# PHASE 3 — Backup + Financial Baseline

## الهدف

تثبيت صورة النظام قبل الإصلاح.

## المطلوب

خذ Snapshot/Backup مناسب لـ:

```text
client_payments
purchases
purchase_payments
technician payments
expenses
treasury_transactions
transfers
```

واحفظ تعريفات:

```text
triggers
functions
indexes
constraints
```

## Baseline Reconstruction

احسب دون إصلاح:

### Treasury

```text
stored/reported balance
vs
reconstructed balance from transactions
```

### Clients

```text
obligations
payments
expected remaining
reported remaining
difference
```

### Suppliers

```text
purchases
payments
expected remaining
reported remaining
difference
```

### Technicians

```text
obligations
payments
expected remaining
reported remaining
difference
```

## المخرج

أنشئ:

```text
docs/financial-baseline-before-fix.md
```

مثال:

```text
Treasury MAIN
Reported: 52,100
Reconstructed: 47,100
Difference: +5,000

Possible cause:
duplicate postings from client_payment #215
```

## ممنوع

- حذف Duplicate.
- تصحيح balances.
- إعادة كتابة البيانات.

## Acceptance Gate

يوجد Baseline يمكن الرجوع إليه بعد كل إصلاح.

عند النجاح:

```text
PHASE 3 = COMPLETE
```

ثم توقف.

---

# PHASE 4 — Client Payments فقط

## Scope

إصلاح دورة Client Payment كاملة فقط.

## الهدف

الوصول إلى:

```text
Client Payment
↓
Client debt decreases
↓
ONE Treasury IN
```

ولا شيء آخر.

## المطلوب

### Trigger Cleanup

افحص واحذف/عطّل التكرارات مثل:

```text
trg_client_payment_treasury
trg_post_client_payment_to_treasury
```

بحسب الموجود فعلياً.

اعتمد مساراً واحداً فقط.

### DELETE Trigger Cleanup

منع وجود مسارين لحذف/عكس الأثر المالي.

### Explicit Source Linking

يفضل:

```text
source_type = client_payment
source_id = client_payments.id
```

أو ما يعادله في Schema الفعلي.

### Idempotency

يجب أن يكون مستحيلاً أن تنتج Client Payment واحدة حركتي Treasury IN.

استخدم Constraint مناسب مثل:

```text
UNIQUE(source_type, source_id, entry_role)
```

إذا كان متوافقاً مع Architecture الفعلية.

### UPDATE

إذا تغيرت الدفعة:

```text
1000 → 1500
```

فالنتيجة النهائية للحركة يجب أن تكون 1500 فقط.

### DELETE / Reverse

يجب أن يرجع:

- Treasury.
- Client debt.

بدون المساس بالمورد أو الفني.

## اختبارات القبول

### Test 1

```text
Client obligation = 100,000
Payment = 30,000

Expected:
Client due = 70,000
Treasury = +30,000
```

### Test 2

تأكد:

```text
Supplier balances unchanged
Technician balances unchanged
Purchase balances unchanged
```

### Test 3

تعديل:

```text
30,000 → 25,000
```

Expected:

```text
Treasury effect final = +25,000
Client paid final = 25,000
```

وليس جمع القيمتين.

### Test 4

إلغاء الدفعة.

Expected:

```text
Client due returns correctly
Treasury returns correctly
```

### Test 5

كرر محاولة Posting لنفس source record.

Expected:

```text
No duplicate treasury entry
```

## Acceptance Gate

```text
1 Client Payment = exactly 1 accounting posting effect
```

عند النجاح:

```text
PHASE 4 = COMPLETE
```

ثم توقف.

---

# PHASE 5 — Purchases + Suppliers

## Scope

المشتريات ودفعات الموردين فقط.

## الهدف

فصل:

```text
Purchase obligation
```

عن:

```text
Supplier cash payment
```

## القاعدة

### Purchase

ينشئ التزاماً على الشركة تجاه المورد.

**لا يحرك Treasury إذا لم يتم الدفع.**

### Purchase Payment

يقلل التزام المورد ويولد:

```text
ONE Treasury OUT
```

## إصلاح المشكلة المعروفة

راجع منطق:

```text
handle_purchase_payment_sync
```

أو أي Function مماثلة.

ممنوع أن تقوم دفعة جديدة بحذف Treasury movement لدفعة سابقة.

## السيناريو المرجعي

```text
Purchase = 5,000
```

Expected:

```text
Supplier due = 5,000
Treasury unchanged
```

Payment 1:

```text
2,000
```

Expected:

```text
Supplier due = 3,000
Treasury OUT = 2,000
```

Payment 2:

```text
1,000
```

Expected:

```text
Supplier due = 2,000

Treasury entries:
-2,000
-1,000
```

لا يتم استبدال الأولى بالثانية.

## Frontend Scope

افحص خصوصاً:

```text
ProjectPurchases.tsx
SupplierDetail.tsx
```

وابحث عالمياً عن جميع write paths.

## اختبارات القبول

1. Purchase بلا Payment.
2. Partial Payment.
3. Multiple Payments.
4. Update Payment.
5. Delete/Reverse Payment.
6. Payment من خزائن مختلفة إن كان النظام يدعم.
7. Client due remains unchanged في جميع الحالات.
8. Technician due remains unchanged.

## Acceptance Gate

```text
Supplier balance = Purchases - Purchase Payments
```

ولا توجد Cross-Settlement مع Client.

عند النجاح:

```text
PHASE 5 = COMPLETE
```

ثم توقف.

---

# PHASE 6 — Technicians

## الهدف

تحقيق:

```text
Technician Balance
=
Technician Obligations
-
Technician Payments
```

## القاعدة

### تسجيل استحقاق الفني

```text
NO Treasury effect
```

### دفع الفني

```text
ONE Treasury OUT
```

## المطلوب

افحص:

- جداول/مصادر الاستحقاقات.
- جدول الدفعات.
- Triggers.
- Functions.
- Frontend writes.
- UPDATE.
- DELETE/Reverse.

## السيناريو المرجعي

```text
Technician due = 10,000
Payment = 3,000
```

Expected:

```text
Technician remaining = 7,000
Treasury OUT = 3,000
```

وتأكد:

```text
Client unchanged
Supplier unchanged
Purchases unchanged
```

## Acceptance Gate

كل دفعة فني = أثر Treasury واحد فقط.

عند النجاح:

```text
PHASE 6 = COMPLETE
```

ثم توقف.

---

# PHASE 7 — Expenses

## الهدف

ضبط المصروفات بدون Double Accounting.

## أنواع المصروف

### Project Expense

```text
project_id != null
```

يؤثر على:

- Treasury.
- تكلفة المشروع.

### General Company Expense

```text
project_id = null
```

يؤثر على:

- Treasury.
- مصروفات الشركة العامة.

ولا يدخل في تكلفة مشروع.

## المطلوب

راجع:

- Expenses table(s).
- Triggers.
- Frontend inserts.
- UPDATE.
- DELETE/Reverse.
- Project cost calculations.

## القاعدة

كل Paid Expense:

```text
ONE Treasury OUT
```

## Tests

1. Project Expense.
2. General Expense.
3. Update amount.
4. Change treasury source if allowed.
5. Delete/Reverse.
6. التأكد من عدم تغيير Client due.
7. التأكد من عدم تغيير Supplier due.
8. التأكد من عدم تغيير Technician due.

## Acceptance Gate

لا يوجد Double Treasury posting لأي Expense.

عند النجاح:

```text
PHASE 7 = COMPLETE
```

ثم توقف.

---

# PHASE 8 — Transfers بين الخزائن والبنوك

## الهدف

ضبط التحويل كحركة داخلية وليست مصروفاً أو إيراداً.

## النموذج

```text
Transfer #X

Source Treasury:
OUT amount

Destination Treasury:
IN amount
```

## القاعدة

```text
Total Company Cash Before
=
Total Company Cash After
```

إذا لم توجد رسوم تحويل.

## الربط

يجب أن ترتبط الحركتان بـ:

```text
transfer_id
```

أو Source identity صريحة.

## Tests

1. Cash → Bank.
2. Bank → Cash.
3. Treasury A → Treasury B.
4. Update transfer إن كان مسموحاً.
5. Delete/Reverse.
6. منع duplicate transfer posting.
7. منع transfer إلى نفس الحساب إذا كان غير منطقي.
8. التحقق من أن التقارير لا تعتبره مصروفاً/إيراداً.

## Acceptance Gate

التحويل لا يغير Total Company Cash.

عند النجاح:

```text
PHASE 8 = COMPLETE
```

ثم توقف.

---

# PHASE 9 — إزالة Double Accounting من Frontend

## شرط البدء

PHASES 4–8 يجب أن تكون مستقرة.

## الهدف

جعل Frontend يسجل Business Operation فقط.

## البحث الإلزامي

Global Search عن:

```typescript
.from('treasury_transactions')
```

وابحث خصوصاً عن:

```typescript
.insert(...)
.update(...)
.delete(...)
```

## القاعدة

إذا كانت Database تحتوي Posting mechanism للعملية:

Frontend لا ينشئ Treasury movement يدوياً.

مثال:

```text
Frontend:
INSERT client_payments
```

وليس:

```text
INSERT client_payments
+
INSERT treasury_transactions
```

## افحص على الأقل

```text
Expenses.tsx
ClientPayments.tsx
ProjectPurchases.tsx
SupplierDetail.tsx
TechnicianDetail.tsx
ProjectExpenses.tsx
ClientDetail.tsx
```

بالإضافة إلى Global Search.

## استثناء

قد توجد Treasury-native operations حقيقية مثل Adjustment يدوي.

لا تحذفها إلا بعد إثبات أنها Duplicate.

## Tests

أعد تشغيل العمليات الرئيسية من UI:

- Client Payment.
- Supplier Payment.
- Technician Payment.
- Expense.
- Transfer.

وتحقق أن كل عملية تنتج العدد المتوقع فقط من Treasury entries.

## Acceptance Gate

لا يوجد Frontend Treasury insert مكرر لمسار تتولى DB Posting له.

عند النجاح:

```text
PHASE 9 = COMPLETE
```

ثم توقف.

---

# PHASE 10 — Historical Duplicate Cleanup

## شرط البدء

يجب أن تكون جميع مصادر التكرار الجديدة متوقفة.

## الهدف

تنظيف البيانات القديمة فقط بعد ضمان أن المشكلة لن تعود.

## القاعدة الذهبية

```text
Fix the generator first.
Clean history second.
```

## المطلوب

لكل source record:

```text
Expected treasury postings
vs
Actual treasury postings
```

مثال:

```text
Client Payment #512
Expected = 1
Actual = 3
```

## إثبات Duplicate

اعتمد قدر الإمكان على:

```text
source_type
source_id
foreign keys
metadata
explicit references
```

## ممنوع

اعتبار سجل Duplicate فقط بسبب:

```text
same amount
same date
same description
```

## Dry Run إلزامي

قبل أي Delete/Correction أنشئ تقريراً:

```text
records_to_keep
records_to_remove_or_reverse
reason
source_record
expected_effect
actual_effect
```

## التنفيذ

بعد Dry Run:

- احذف/اعكس فقط السجلات المثبت تكرارها.
- لا تمس العمليات المشروعة المتشابهة.

## المخرج

أنشئ:

```text
docs/financial-historical-cleanup.md
```

## Acceptance Gate

كل cleanup action له سبب ومصدر واضح.

عند النجاح:

```text
PHASE 10 = COMPLETE
```

ثم توقف.

---

# PHASE 11 — Rebuild & Reconcile Balances

## الهدف

إعادة بناء الأرصدة من Sources of Truth الصحيحة.

## Client

```text
Client Balance
=
Contracts / Invoices
-
Client Payments
```

## Supplier

```text
Supplier Balance
=
Purchases
-
Purchase Payments
```

## Technician

```text
Technician Balance
=
Technician Obligations
-
Technician Payments
```

## Treasury

```text
Treasury Balance
=
Opening Balance
+
IN
-
OUT
```

## المطلوب

قارن:

```text
before cleanup
after cleanup
reconstructed
stored/reported
```

## إذا كانت هناك Cached balances

إما:

- إعادة بنائها.
- أو تحويلها إلى Derived.
- أو توثيق آلية مزامنتها بدقة.

## Acceptance Gate

كل Balance قابل لإعادة بنائه من Source of Truth.

عند النجاح:

```text
PHASE 11 = COMPLETE
```

ثم توقف.

---

# PHASE 12 — Project Financial Summary

## الهدف

إصلاح الملخص المالي للمشروع بحيث يعرض مؤشرات مستقلة.

## قسم العميل

```text
Contract value
Collected from client
Remaining on client
```

## قسم الموردين

```text
Total purchases
Paid to suppliers
Remaining to suppliers
```

## قسم الفنيين

```text
Total technician obligations
Paid to technicians
Remaining to technicians
```

## قسم المصروفات

```text
Project expenses
```

## الربحية

```text
Project revenue
Project cost
Gross profit
```

## Cash Flow

```text
Cash collected for project
Cash paid for project
Net project cash flow
```

## قاعدة مهمة

```text
Cash Flow
```

مؤشر إداري فقط.

لا يغيّر:

```text
Client Remaining
Supplier Remaining
Technician Remaining
```

## Acceptance Gate

كل Card/Number في الملخص له Source of Truth موثق.

عند النجاح:

```text
PHASE 12 = COMPLETE
```

ثم توقف.

---

# PHASE 13 — Reports, Statements, Printing, Export

## الهدف

منع بقاء formulas القديمة في التقارير والطباعة بعد إصلاح DB.

## افحص

- Client statements.
- Supplier statements.
- Technician statements.
- Project financial reports.
- Treasury statements.
- Dashboard.
- Print.
- PDF generation.
- Exports.
- Summary cards.

## لكل رقم ظاهر

وثّق:

```text
UI label
Formula
Source table(s)
Source of Truth
```

مثال:

```text
"المتبقي على العميل"
=
contract/invoices - client_payments
```

وليس Treasury.

## Tests

قارن التقارير مع بيانات SQL مباشرة لعدة سيناريوهات.

## Acceptance Gate

لا يوجد Report يعتمد Formula قديمة أو Cross-Settlement.

عند النجاح:

```text
PHASE 13 = COMPLETE
```

ثم توقف.

---

# PHASE 14 — Full End-to-End Financial Test

## الهدف

اختبار النظام ككل بعد الإصلاح.

## Scenario A

### Start

```text
Opening Treasury = 100,000
Contract = 100,000
Client due = 100,000
```

### Client pays 30,000

Expected:

```text
Client paid = 30,000
Client due = 70,000
Treasury +30,000
```

### Purchase 20,000 on credit

Expected:

```text
Supplier due = 20,000
Treasury unchanged
Client due = 70,000
```

### Supplier payment 5,000

Expected:

```text
Supplier due = 15,000
Treasury -5,000
Client due = 70,000
```

### Technician entitlement 10,000

Expected:

```text
Technician due = 10,000
Treasury unchanged
```

### Technician payment 3,000

Expected:

```text
Technician remaining = 7,000
Treasury -3,000
```

### Project expense 2,000

Expected:

```text
Project cost +2,000
Treasury -2,000
```

### Client pays another 20,000

Expected:

```text
Client paid = 50,000
Client due = 50,000
```

ويجب أن يبقى:

```text
Supplier due = 15,000
Technician due = 7,000
```

## Scenario B — Multiple Supplier Payments

```text
Purchase = 5,000
Payment 1 = 2,000
Payment 2 = 1,000
Expected remaining = 2,000
```

Treasury يجب أن يحتفظ بأثر الدفعتين.

## Scenario C — Update

اختبر تعديل:

- Client Payment.
- Supplier Payment.
- Technician Payment.
- Expense.
- Transfer.

## Scenario D — Delete / Reverse

اختبر إلغاء جميع أنواع العمليات.

## Scenario E — Transfer

```text
Cash → Bank = 20,000

Cash -20,000
Bank +20,000
Total company cash unchanged
```

## Scenario F — Cross Settlement Guards

بعد كل Client Payment تحقق صراحة أن:

```text
Supplier due unchanged
Technician due unchanged
```

وبعد كل Supplier/Technician Payment تحقق أن:

```text
Client due unchanged
```

## المخرج

أنشئ:

```text
docs/financial-e2e-test-results.md
```

## Acceptance Gate

جميع السيناريوهات PASS.

عند النجاح:

```text
PHASE 14 = COMPLETE
```

ثم توقف.

---

# PHASE 15 — Automated Accounting Invariants

## الهدف

تحويل القواعد المحاسبية إلى اختبارات آلية تمنع رجوع الأخطاء.

## Invariant 1

```text
Client Balance
=
Client Obligations
-
Client Payments
```

## Invariant 2

```text
Supplier Balance
=
Purchases
-
Purchase Payments
```

## Invariant 3

```text
Technician Balance
=
Technician Obligations
-
Technician Payments
```

## Invariant 4

```text
Treasury Balance
=
Opening
+
IN
-
OUT
```

## Invariant 5

Client Payment ممنوع أن يعدل:

```text
purchase_payments
technician_payments
supplier settlement
technician settlement
```

## Invariant 6

Supplier Payment ممنوع أن يعدل:

```text
client_payments
client due
```

## Invariant 7

Technician Payment ممنوع أن يعدل:

```text
client_payments
client due
supplier balance
```

## Invariant 8

Transfer:

```text
source OUT == destination IN
```

وTotal company cash لا يتغير.

## المطلوب

استخدم ما يناسب المشروع:

- SQL tests.
- Integration tests.
- Automated assertions.
- CI tests.

## Acceptance Gate

الاختبارات الآلية تفشل عمداً إذا تمت إعادة Double Posting أو Cross Settlement.

عند النجاح:

```text
PHASE 15 = COMPLETE
```

ثم توقف.

---

# PHASE 16 — Database Hardening

## الهدف

منع الأخطاء المحاسبية على مستوى قاعدة البيانات حتى لو أخطأ Frontend مستقبلاً.

## افحص وأضف عند الحاجة

### Unique Constraints

لمنع duplicate source posting.

### Foreign Keys

لضمان صحة الربط.

### Check Constraints

مثل:

```text
amount > 0
```

حيث يكون مناسباً.

### Source Integrity

منع:

```text
source_type موجود بدون source_id
```

أو العكس إذا كان التصميم يعتمد الاثنين.

### Idempotency

عملية واحدة لا يمكن أن تنشئ أكثر من Posting مسموح.

### Atomicity

العمليات متعددة الخطوات يجب أن تتم داخل Transaction مناسبة.

### Rollback

إذا فشل الجزء المالي يجب ألا يبقى نصف العملية.

### Audit Metadata

حسب الحاجة:

```text
created_at
created_by
updated_at
reversed_at
reversed_by
source_type
source_id
```

## Negative Balance Policy

لا تفترض تلقائياً منع السالب.

تحقق من Business Rule الفعلية.

إذا النظام يمنع السحب فوق الرصيد:

- طبّق الحماية بشكل صريح.

إذا يسمح به لحالات معينة:

- وثّق القاعدة.

## Acceptance Gate

محاولة إدخال Duplicate أو Reference غير صحيح يجب أن تفشل بشكل واضح.

عند النجاح:

```text
PHASE 16 = COMPLETE
```

ثم توقف.

---

# PHASE 17 — Final Independent Audit

## الهدف

مراجعة النظام من جديد كما لو أن الوكيل لم ينفذ الإصلاحات السابقة.

## ممنوع في البداية

الاعتماد على أن المراحل السابقة صحيحة.

قم بإعادة Audit مستقل.

## Global Search

ابحث مجدداً عن:

```text
treasury_transactions INSERT
paid_amount writes
remaining_amount writes
client balance updates
supplier balance updates
technician balance updates
DELETE treasury
UPDATE treasury
```

## Database Audit

راجع مجدداً:

- Triggers.
- Functions.
- Constraints.
- Foreign keys.
- RPC.
- Duplicate write paths.

## Reconciliation

شغّل عينات فعلية:

- Client.
- Supplier.
- Technician.
- Treasury.
- Project.

## Required Final Report

أنشئ:

```text
docs/financial-system-final-audit.md
```

ويجب أن يحتوي في النهاية:

```text
Client accounting: PASS / FAIL
Supplier accounting: PASS / FAIL
Technician accounting: PASS / FAIL
Expenses: PASS / FAIL
Transfers: PASS / FAIL
Treasury: PASS / FAIL
Duplicate triggers: NONE / FOUND
Duplicate treasury posting: NONE / FOUND
Cross settlement: NONE / FOUND
Historical reconciliation: PASS / FAIL
E2E tests: PASS / FAIL
Automated invariants: PASS / FAIL
```

## Acceptance Gate

لا تعلن نجاح المشروع إذا كان أي بند مالي أساسي FAIL.

عند النجاح:

```text
PHASE 17 = COMPLETE
FINANCIAL REBUILD = COMPLETE
```

ثم توقف.

---

# 6) قواعد خاصة بـ Client Payments

هذه القواعد يجب فحصها في كل مرحلة لها علاقة بالزبون:

```text
Client Remaining
=
Client Obligations
-
Client Payments
```

ولا تحتوي المعادلة على:

```text
Supplier Payments
Technician Payments
Purchases paid status
Project Expenses
Treasury balance
```

إذا كان Client Payment مرتبطاً بـ `project_id` فهذا يعني:

> هذا التحصيل منسوب لهذا المشروع لأغراض المحاسبة/التقارير.

ولا يعني:

> هذه الأموال دفعت تلقائياً لمورد أو فني.

---

# 7) قواعد خاصة بالموردين

```text
Supplier Remaining
=
Purchase Obligations
-
Purchase Payments
```

ولا تدخل فيها:

```text
Client Payments
Technician Payments
Treasury balance itself
```

وجود مال في Treasury لا يعني أن المورد مسدد.

---

# 8) قواعد خاصة بالفنيين

```text
Technician Remaining
=
Technician Obligations
-
Technician Payments
```

ولا تدخل فيها تحصيلات العميل.

---

# 9) الفرق بين الربح والتدفق النقدي

ممنوع خلط:

```text
Profit
```

مع:

```text
Cash Flow
```

## Profit

تقريباً:

```text
Project Revenue
-
Project Cost
```

## Cash Flow

```text
Actual Cash In
-
Actual Cash Out
```

يمكن أن يكون المشروع رابحاً لكن الزبون لم يدفع.

ويمكن أن يكون هناك Cash كبير بينما توجد التزامات كبيرة للموردين والفنيين.

---

# 10) Protocol لتعديل البيانات التاريخية

عند التعامل مع بيانات سابقة:

1. لا تحذف مباشرة.
2. اعمل Dry Run.
3. اربط كل Treasury entry بمصدره.
4. حدد Expected count.
5. حدد Actual count.
6. حدد Keep.
7. حدد Remove/Reverse.
8. اكتب السبب.
9. تحقق من الأرصدة بعد التعديل.
10. احتفظ Audit trail مناسب.

---

# 11) قالب نهاية كل جلسة

يجب على الوكيل في نهاية الجلسة كتابة تقرير بهذا الشكل:

```text
SESSION PHASE:
PHASE X — <name>

STATUS:
COMPLETE / BLOCKED

SCOPE COMPLETED:
- ...
- ...

DATABASE CHANGES:
- ...

MIGRATIONS:
- ...

FRONTEND FILES MODIFIED:
- ...

DOCUMENTATION UPDATED:
- ...

TESTS RUN:
1. <test> — PASS/FAIL
2. <test> — PASS/FAIL
3. <test> — PASS/FAIL

EXPECTED VS ACTUAL:
- ...

OUT-OF-SCOPE ISSUES DISCOVERED:
- ...

OPEN ITEMS INSIDE CURRENT PHASE:
NONE
```

إذا COMPLETE يجب أن يكون:

```text
OPEN ITEMS INSIDE CURRENT PHASE:
NONE
```

ثم:

```text
NEXT PHASE:
PHASE X+1 — <name>

DO NOT START NEXT PHASE IN THIS SESSION.
```

---

# 12) Prompt تشغيل الوكيل في كل جلسة

استخدم التعليمات التالية في بداية الجلسة:

```text
اقرأ ملف MASTER FINANCIAL SYSTEM REBUILD PLAYBOOK بالكامل.
ثم اقرأ docs/financial-system-rebuild.md وجميع تقارير المراحل المكتملة ذات العلاقة.

حدد المرحلة التالية غير المكتملة حسب ملف التقدم.

نفذ مرحلة واحدة فقط في هذه الجلسة بصرامة.

ممنوع الانتقال إلى المرحلة التالية.

لا تفترض أي أسماء أو علاقات في قاعدة البيانات؛ افحصها فعلياً باستخدام الأدوات المتاحة.

لا تنفذ Patch سريعاً ولا تخفِ المشاكل.

يجب الحفاظ على القاعدة المحاسبية العليا:
- Client Payment يقلل دين العميل ويزيد Treasury فقط.
- Supplier Payment يقلل مستحق المورد ويخفض Treasury فقط.
- Technician Payment يقلل مستحق الفني ويخفض Treasury فقط.
- لا يوجد Cross-Settlement بين هذه المجالات.

نفذ جميع اختبارات القبول للمرحلة الحالية.
لا تعتبر المرحلة COMPLETE إذا كان أي اختبار Acceptance فاشلاً.
حدّث ملف التقدم والوثائق في نهاية الجلسة.
إذا اكتملت المرحلة، توقف ولا تبدأ التي بعدها.
إذا تعذر إكمالها، ضع BLOCKED مع سبب دقيق وأدلة وخطوات فك الحظر.
```

---

# 13) ترتيب المراحل المختصر

```text
PHASE 0  — Control & Documentation
PHASE 1  — Full Audit
PHASE 2  — Target Financial Architecture
PHASE 3  — Backup + Baseline
PHASE 4  — Client Payments
PHASE 5  — Purchases + Suppliers
PHASE 6  — Technicians
PHASE 7  — Expenses
PHASE 8  — Transfers
PHASE 9  — Frontend Double-Accounting Removal
PHASE 10 — Historical Duplicate Cleanup
PHASE 11 — Balance Rebuild & Reconciliation
PHASE 12 — Project Financial Summary
PHASE 13 — Reports / Printing / Export
PHASE 14 — Full E2E Tests
PHASE 15 — Automated Accounting Invariants
PHASE 16 — Database Hardening
PHASE 17 — Final Independent Audit
```

---

# 14) شرط النجاح النهائي للنظام

لا يعتبر المشروع المالي مصححاً إلا إذا تحققت كلها:

```text
1 Client Payment = one valid client settlement + one Treasury IN
1 Supplier Payment = one valid supplier settlement + one Treasury OUT
1 Technician Payment = one valid technician settlement + one Treasury OUT
1 Paid Expense = one Expense + one Treasury OUT
1 Transfer = one OUT + one IN

No duplicate triggers.
No duplicate treasury posting.
No cross-settlement.
No frontend/database double posting.
All balances reconstruct correctly.
All E2E tests pass.
All accounting invariants pass.
Final independent audit passes.
```

---

# 15) القاعدة النهائية

إذا وجدت أثناء أي مرحلة أن النظام الحالي يخالف القاعدة المحاسبية العليا، لا تحاول المحافظة على السلوك الخاطئ لمجرد أنه موجود حالياً.

لكن:

1. افهم السبب أولاً.
2. وثّق التأثير.
3. أصلحه ضمن المرحلة الصحيحة.
4. اختبر البيانات القديمة.
5. لا تنقل الخطأ إلى Architecture الجديدة.

**الهدف ليس جعل النظام "يعمل فقط". الهدف أن تصبح الحسابات قابلة لإعادة البناء والتدقيق، ولا يمكن لعملية واحدة أن تُحسب مرتين أو أن تسدد التزاماً لا يخصها.**
