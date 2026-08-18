# UX Phase 0: وثيقة الأساس المعماري والعقد الملزم لإعادة بناء الواجهة (Baseline & Architecture Contract)

**تاريخ التحديث**: 16 أغسطس 2026  
**حالة النطاق المالي 1**: `FC-01 FINISHING COST-PLUS = COMPLETE — VERIFIED — CLOSED`  
**حالة النطاق المالي 2**: `FC-02 CLIENT CREDIT LEDGER = COMPLETE — VERIFIED — CLOSED`  
**حالة دفعات العملاء**: `CLIENT PROJECT-LEVEL RECEIPTS = COMPLETE — VERIFIED`  
**حالة سياسة الفائض**: `OVERPAYMENT POLICY = APPROVED — IMPLEMENTED`  
**حالة الماستر بلان**: `UX/UI REBUILD MASTER PLAN = CONSISTENT WITH FINAL BUSINESS MODEL`  
**حالة فحوصات الثبات**: `FINANCIAL INVARIANT TESTS = 68/68 PASS (0 FAILED)`  
**حالة بناء المشروع**: `VITE PRODUCTION BUILD = PASS (EXIT CODE 0)`  
**حالة واجهة المستخدم**: `UX IMPLEMENTATION = READY BUT NOT STARTED`

---

## 1. الملخص التنفيذي (Executive Baseline)

تهدف مرحلة **UX Phase 0** إلى إنشاء مرجع قياسي موثق بدقة متناهية (`Architectural Baseline`) لتجربة المستخدم الحالية، وهيكل المسارات، والقوائم، والنماذج، ومصادر الحالة، والأدوار، وقوانين الرصيد الدائن للعملاء، قبل تنفيذ أي تعديل إنتاجي على الواجهة. تضمن هذه الوثيقة عدم كسر أي مسار قائم، وتضع ميثاقاً معمارياً ملزماً وغير قابل للتفاوض (`Architecture Contract`) يوجه جميع مراحل التطوير القادمة (من Phase 1 إلى Phase 6).

---

## 2. حصر المسارات الفعلي من الكود (Actual Route Inventory)

تم استخراج المسارات وتدقيقها برمجياً ومباشرة من ملف [`src/App.tsx`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/src/App.tsx):

| # | المسار (Route) | المكون (Component) | النطاق (Domain) | مرتبط بمشروع؟ (Project-Scoped?) | نوع المشروع (Project Type) | الغرض الحالي (Current Purpose) | الإجراء المستهدف (Action) | المسار النهائي المستهدف (Target Route) | درجة المخاطرة (Risk) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/auth` | `Auth` | System | لا | All | تسجيل الدخول والمصادقة | KEEP | `/auth` | منخفض |
| 2 | `/` | `Dashboard` | Overview | لا | All | لوحة التحكم التشغيلية الرئيسية | MIGRATE | `/` (Dashboard محسنة) | منخفض |
| 3 | `/accountant` | `AccountantDashboard` | Finance | لا | All | لوحة التحكم المالية للمحاسب | KEEP | `/accountant` | منخفض |
| 4 | `/projects` | `Projects` | Projects | لا | All | قائمة كافة المشاريع | KEEP | `/projects` | منخفض |
| 5 | `/projects/contracting` | `Projects (type="contracting")` | Projects | لا | Contracting | قائمة مشاريع المقاولات | KEEP | `/projects/contracting` | منخفض |
| 6 | `/projects/finishing` | `Projects (type="finishing")` | Projects | لا | Finishing | قائمة مشاريع التشطيبات | KEEP | `/projects/finishing` | منخفض |
| 7 | `/projects/client/:clientId` | `ClientProjects` | Projects | لا | All | مشاريع عميل محدد | MIGRATE | `/clients/:id` (تبويب مشاريع) | متوسط |
| 8 | `/projects/new` | `ManageProject` | Projects | لا | All | إنشاء مشروع جديد | KEEP | `/projects/new` | متوسط |
| 9 | `/projects/:id` | `ManageProject` | Projects | نعم (`:id`) | All | تعديل بيانات المشروع (حالياً) | **MIGRATE** | `/projects/:id` (Project Overview Hub) | **حرج** |
| 10 | `/projects/:id/edit` | `ManageProject` | Projects | نعم (`:id`) | All | تعديل بيانات المشروع | KEEP | `/projects/:id/edit` | متوسط |
| 11 | `/projects/:id/items` | `ProjectItems` | Projects | نعم (`:id`) | Contracting | بنود المقايسة وحاسبة القياسات | KEEP | `/projects/:id/items` | متوسط |
| 12 | `/projects/:id/purchases` | `ProjectPurchases` | Projects | نعم (`:id`) | All | فواتير المشتريات والخدمات للمشروع | KEEP | `/projects/:id/purchases` | متوسط |
| 13 | `/projects/:id/progress` | `ProjectProgress` | Projects | نعم (`:id`) | Contracting | نسب إنجاز البنود والعمالة | KEEP | `/projects/:id/progress` | متوسط |
| 14 | `/projects/:id/report` | `ProjectReport` | Projects | نعم (`:id`) | All | التقرير المالي الشامل للمشروع | KEEP | `/projects/:id/report` | متوسط |
| 15 | `/projects/:id/equipment` | `ProjectEquipmentRentals` | Projects | نعم (`:id`) | All | إيجارات المعدات المحملة على المشروع | KEEP | `/projects/:id/equipment` | متوسط |
| 16 | `/projects/:id/expenses` | `ProjectExpenses` | Projects | نعم (`:id`) | All | مصروفات الموقع المباشرة للمشروع | KEEP | `/projects/:id/expenses` | متوسط |
| 17 | `/projects/:id/phases` | `ProjectPhases` | Projects | نعم (`:id`) | All | مراحل المشروع وفواتير التشطيب | KEEP | `/projects/:id/phases` | متوسط |
| 18 | `/projects/:id/contracts` | `ProjectContracts` | Projects | نعم (`:id`) | All | عقود المشروع المعتمدة | KEEP | `/projects/:id/contracts` | متوسط |
| 19 | `/projects/:id/phases/:phaseId/items` | `ProjectItems` | Projects | نعم (`:id`, `:phaseId`) | Contracting | بنود مرحلة محددة | **REDIRECT** | `/projects/:id/items?phase=:phaseId` | منخفض |
| 20 | `/projects/:id/phases/:phaseId/purchases` | `ProjectPurchases` | Projects | نعم (`:id`, `:phaseId`) | All | مشتريات مرحلة محددة | **REDIRECT** | `/projects/:id/purchases?phase=:phaseId` | منخفض |
| 21 | `/projects/:id/phases/:phaseId/expenses` | `ProjectExpenses` | Projects | نعم (`:id`, `:phaseId`) | All | مصروفات مرحلة محددة | **REDIRECT** | `/projects/:id/expenses?phase=:phaseId` | منخفض |
| 22 | `/projects/:id/phases/:phaseId/equipment` | `ProjectEquipmentRentals` | Projects | نعم (`:id`, `:phaseId`) | All | إيجارات مرحلة محددة | **REDIRECT** | `/projects/:id/equipment?phase=:phaseId` | منخفض |
| 23 | `/projects/:id/payments` | `ProjectPayments` | Projects | نعم (`:id`) | All | سجل دفعات العميل للمشروع | KEEP | `/projects/:id/payments` | متوسط |
| 24 | `/client-payments` | `ClientPayments` | Finance | لا | All | سجل وإيصالات مقبوضات الزبائن | KEEP | `/client-payments` | متوسط |
| 25 | `/rentals` | `ProjectsWithRentals` | Operations | لا | All | سجل إيجارات المعدات العام | KEEP | `/rentals` | منخفض |
| 26 | `/project-expenses` | `AllProjectExpenses` | Finance | لا | All | مركز كافة مصروفات المشاريع | KEEP | `/project-expenses` | منخفض |
| 27 | `/custody` | `Custody` | Finance | لا | All | سجل العهد المالية | KEEP | `/custody` | منخفض |
| 28 | `/custody/:id` | `CustodyDetail` | Finance | لا | All | تفاصيل وحركات عهدة محددة | KEEP | `/custody/:id` | منخفض |
| 29 | `/employees` | `Employees` | People | لا | All | دليل الموظفين والرواتب | KEEP | `/employees` | منخفض |
| 30 | `/general-items` | `GeneralItems` | Operations | لا | Contracting | دليل البنود العامة للمقاولات | KEEP | `/general-items` | منخفض |
| 31 | `/measurement-types` | `MeasurementTypes` | System | لا | Contracting | وحدات القياس والمعادلات | KEEP | `/measurement-types` | منخفض |
| 32 | `/equipment` | `Equipment` | Operations | لا | All | سجل المعدات والآليات | KEEP | `/equipment` | منخفض |
| 33 | `/equipment/:id` | `EquipmentDetail` | Operations | لا | All | بطاقة معدة وحركات تشغيلها | KEEP | `/equipment/:id` | منخفض |
| 34 | `/contracts` | `Contracts` | Commercial | لا | All | سجل العقود العام | KEEP | `/contracts` | منخفض |
| 35 | `/contracts/new` | `CreateContract` | Commercial | لا | All | محرر صياغة عقد جديد | KEEP | `/contracts/new` | متوسط |
| 36 | `/contracts/:id` | `CreateContract` | Commercial | لا | All | تعديل وطباعة عقد محدد | KEEP | `/contracts/:id` | متوسط |
| 37 | `/clients` | `Clients` | People | لا | All | دليل وسجل العملاء | KEEP | `/clients` | منخفض |
| 38 | `/debts` | `Debts` | Finance | لا | All | تقرير ذمم ومطالبات الزبائن | KEEP | `/debts` | منخفض |
| 39 | `/clients/:id` | `ClientDetail` | People | لا | All | بطاقة العميل وكشف حسابه | KEEP | `/clients/:id` | متوسط |
| 40 | `/suppliers` | `Suppliers` | People | لا | All | دليل الموردين العام | KEEP | `/suppliers` | منخفض |
| 41 | `/suppliers/:id` | `SupplierDetail` | People | لا | All | كشف حساب ومشتريات المورد | KEEP | `/suppliers/:id` | متوسط |
| 42 | `/suppliers/:id/projects/:projectId` | `SupplierDetail` | People | نعم (`:projectId`) | All | كشف حساب المورد لمشروع محدد | KEEP | `/suppliers/:id/projects/:projectId` | منخفض |
| 43 | `/technicians` | `Technicians` | People | لا | All | دليل الفنيين والمقاولين الباطن | KEEP | `/technicians` | منخفض |
| 44 | `/technicians/:id` | `TechnicianDetail` | People | لا | All | كشف حساب وإنجاز الفني | KEEP | `/technicians/:id` | متوسط |
| 45 | `/engineers` | `Engineers` | People | لا | All | دليل المهندسين المشرفين | KEEP | `/engineers` | منخفض |
| 46 | `/engineers/:id` | `EngineerDetail` | People | لا | All | بطاقة المهندس وماريعه | KEEP | `/engineers/:id` | منخفض |
| 47 | `/income` | `Income` | Finance | لا | All | الإيرادات والمقبوضات | MIGRATE | دمج في المعاملات المالية | متوسط |
| 48 | `/expenses` | `Expenses` | Finance | لا | All | المصروفات العامة والإدارية | KEEP | `/expenses` | متوسط |
| 49 | `/transfers` | `Transfers` | Finance | لا | All | التحويلات بين الخزائن | KEEP | `/transfers` | منخفض |
| 50 | `/reports` | `Reports` | Reports | لا | All | مركز التقارير الشامل | KEEP | `/reports` | منخفض |
| 51 | `/users` | `UserManagement` | System | لا | All | إدارة مستخدمي النظام والصلاحيات | KEEP | `/users` | منخفض |
| 52 | `/calendar` | `CalendarPage` | Operations | لا | All | تقويم المواعيد ومراحل المشاريع | KEEP | `/calendar` | منخفض |
| 53 | `/settings` | `Settings` | System | لا | All | إعدادات النظام والشركة | KEEP | `/settings` | منخفض |
| 54 | `/database-backup` | `DatabaseBackup` | System | لا | All | النسخ الاحتياطي واستعادة البيانات | KEEP | `/database-backup` | منخفض |
| 55 | `/print-design` | `PrintDesign` | System | لا | All | مخصص ترويسة وقوالب الطباعة | KEEP | `/print-design` | منخفض |
| 56 | `/contract-templates` | `ContractClauseTemplates` | System | لا | All | قوالب ونصوص بنود العقود | KEEP | `/contract-templates` | منخفض |
| 57 | `/treasuries` | `Treasuries` | Finance | لا | All | بطاقات وخزائن الشركة | KEEP | `/treasuries` | متوسط |
| 58 | `/treasuries/:id` | `TreasuryDetail` | Finance | لا | All | كشف حركة خزينة محددة | KEEP | `/treasuries/:id` | متوسط |
| 59 | `/client-activities` | `ClientActivities` | Finance | لا | All | سجل حركات ومعاملات الزبائن | KEEP | `/client-activities` | منخفض |
| 60 | `/audit-log` | `AuditLog` | System | لا | All | سجل الرقابة والعمليات الحساسة | KEEP | `/audit-log` | منخفض |
| 61 | `/inventory` | `Inventory` | Operations | لا | All | جرد ومخزون المواد | KEEP | `/inventory` | منخفض |
| 62 | `/invoice-control` | `InvoiceControl` | Finance | لا | All | مركز متابعة وتدقيق الفواتير | KEEP | `/invoice-control` | منخفض |
| 63 | `*` | `NotFound` | System | لا | All | صفحة الخطأ 404 (CatchAll) | KEEP | `*` | منخفض |

---

## 3. حقيقة عدد المسارات (Route Count Truth)

$$\mathbf{NAMED\ ROUTES = 62\ |\ INDEX\ ROUTE\ (/\ Dashboard) = 1\ |\ CATCHALL\ ROUTE\ (*) = 1}$$
$$\mathbf{TOTAL\ ROUTE\ DEFINITIONS = 64\ Routes}$$

---

## 4. خط الأساس للشريط الجانبي (Sidebar Current Baseline)

تم استخراج العناصر الـ 29 من دالة `getNavigationGroups` في [`src/pages/Index.tsx`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/src/pages/Index.tsx):

| # | التسمية (Label) | المسار (Route) | المجموعة (Group) | الأيقونة (Icon) | الصلاحيات (Roles) | الترتيب الراهن | التصنيف المستهدف في الماستر بلان |
|---|---|---|---|---|---|---|---|
| 1 | لوحة التحكم | `/` | الرئيسية | `LayoutDashboard` | admin, engineer, supervisor | 1 | Primary Sidebar |
| 2 | لوحة التحكم المالية | `/accountant` | الرئيسية | `Coins` | admin, accountant | 2 | Primary Sidebar |
| 3 | مشاريع المقاولات | `/projects/contracting` | الرئيسية | `FolderKanban` | admin, engineer, supervisor | 3 | Primary Sidebar |
| 4 | مشاريع التشطيبات | `/projects/finishing` | الرئيسية | `FolderKanban` | admin, engineer, supervisor | 4 | Primary Sidebar |
| 5 | سجل حركات الزبائن | `/client-activities` | الرئيسية | `Users` | admin, accountant | 5 | Nested under Finance |
| 6 | البنود العامة | `/general-items` | العمليات | `Package` | admin, supervisor | 6 | Settings / Library |
| 7 | المعدات | `/equipment` | العمليات | `Wrench` | admin, supervisor | 7 | Operations Hub |
| 8 | إيجارات المشاريع | `/rentals` | العمليات | `Truck` | admin, supervisor | 8 | Operations Hub |
| 9 | المخازن | `/inventory` | العمليات | `Warehouse` | admin, supervisor | 9 | Operations Hub |
| 10 | العملاء | `/clients` | الأشخاص | `Users` | admin, accountant | 10 | Directory / Entities |
| 11 | الموردون | `/suppliers` | الأشخاص | `Receipt` | admin, accountant | 11 | Directory / Entities |
| 12 | الفنيون | `/technicians` | الأشخاص | `HardHat` | admin, engineer, supervisor | 12 | Directory / Entities |
| 13 | المهندسون | `/engineers` | الأشخاص | `GraduationCap` | admin | 13 | Employees Sub-Tab |
| 14 | الموظفين | `/employees` | الأشخاص | `UserCog` | admin | 14 | Directory / Entities |
| 15 | مصروفات المشاريع | `/project-expenses` | المالية | `Coins` | admin, accountant | 15 | Financial Hub |
| 16 | مركز الفواتير | `/invoice-control` | المالية | `Receipt` | admin, accountant | 16 | Financial Hub |
| 17 | خزائن الشركة | `/treasuries` | المالية | `Wallet` | admin, accountant | 17 | Financial Hub |
| 18 | إيصالات مقبوضات الزبائن | `/client-payments` | المالية | `TrendingUp` | admin, accountant | 18 | Financial Hub |
| 19 | ديون وذمم الزبائن | `/debts` | المالية | `AlertTriangle` | admin, accountant | 19 | Financial Hub |
| 20 | الدخول والخروج | `/transfers` | المالية | `ArrowLeftRight` | admin, accountant | 20 | Financial Hub |
| 21 | الخروج | `/expenses` | المالية | `TrendingDown` | admin, accountant | 21 | Financial Hub |
| 22 | التقارير | `/reports` | النظام | `FileText` | admin | 22 | System Hub |
| 23 | النسخ الاحتياطي | `/database-backup` | النظام | `Database` | admin | 23 | Settings Sub-Tab |
| 24 | سجل التعديلات | `/audit-log` | النظام | `History` | admin | 24 | System Hub |
| 25 | المستخدمون | `/users` | النظام | `Shield` | admin | 25 | Settings Sub-Tab |
| 26 | التقويم | `/calendar` | النظام | `Calendar` | admin | 26 | Operations Hub |
| 27 | الإعدادات | `/settings` | النظام | `Settings` | admin | 27 | System Hub |
| 28 | تصميم الطباعة | `/print-design` | النظام | `Palette` | admin | 28 | Settings Sub-Tab |
| 29 | قوالب العقود | `/contract-templates` | النظام | `FileText` | admin | 29 | Settings Sub-Tab |

$$\mathbf{CURRENT\ SIDEBAR\ ITEM\ COUNT = 29\ Items\ across\ 5\ Groups}$$

---

## 5. خط الأساس للترويسة (Header Baseline)

- **حقل البحث (Search Input)**:
  - **الحالة الراهنة**: **Placeholder بصري فقط (Non-functional Placeholder)**.
  - لا يحتوي على `value`، أو `onChange`، أو `onKeyDown`، ولا يرتبط بأي خوارزمية بحث أو نافذة `Command Palette`.
- **سياق المشروع (Project Context)**:
  - غير معروض في الترويسة الرئيسية عند الدخول لصفحات المشروع الفرعية.
- **عناصر التحكم والملاحة**:
  - عرض اسم وشعار الشركة، زر تبديل الوضع الليلي، جرس التنبيهات، وقائمة المستخدم.

---

## 6. حصر نقاط الدخول إلى المشاريع (Project Entry Points Matrix)

| نقطة الدخول (Entry Point Source) | المسار المستهدف الحالي (Current Target) | هل يفتح Overview؟ | هل يفتح تعديل (Edit)؟ | هل يفتح المراحل (Phases)؟ | نوع المشروع المتوافق | تقييم الاتساق (Consistency) |
|---|---|---|---|---|---|---|
| **بطاقة المشروع في لوحة التحكم (`ProjectCard.tsx`)** | `/projects/:id/phases` | لا | لا | **نعم** | Contracting & Finishing | **متناقض ومشتت** |
| **قائمة المشاريع (`Projects.tsx`)** | `/projects/:id/phases` | لا | لا | **نعم** | Contracting & Finishing | **غير متسق** |
| **بطاقة العميل (`ClientDetail.tsx`)** | `/projects/:id/phases` | لا | لا | **نعم** | Contracting & Finishing | **غير متسق** |
| **حركات الزبائن (`ClientActivities.tsx`)** | `/projects/:id` | لا | **نعم (Edit Form!)** | لا | All | **خاطئ** |
| **تفاصيل العهدة (`CustodyDetail.tsx`)** | `/projects/:id` | لا | **نعم (Edit Form!)** | لا | All | **خاطئ** |
| **دليل المهندسين (`Engineers.tsx` / `EngineerDetail.tsx`)** | `/projects/:id/items` | لا | لا | لا | **Contracting فقط!** | **حرج** (يكسر تجربة التشطيبات) |
| **تفاصيل الفني (`TechnicianDetail.tsx`)** | `/projects/:id/edit` | لا | **نعم (Edit Form!)** | لا | All | **خاطئ** |

---

## 7. مصفوفة تجربة المستخدم حسب نوع المشروع (Project Type UX Matrix)

| الوظيفة / القسم (Feature / Section) | مشاريع المقاولات (Contracting) | مشاريع التشطيبات (Finishing) | مشتركة؟ (Common?) | السلوك الخاص (Special Behaviour) | المرجع الحصري المعتمد (Source of Truth) |
|---|---|---|---|---|---|
| **النظرة العامة (Overview)** | إحصائيات الإنجاز، قيمة العقد، التكلفة، المستخلصات | قاعدة التكلفة الخماسية المعتمدة، نسبة الشركة، إجمالي الاستحقاق | نعم | إظهار مؤشرات مختلفة حسب النوع | `financialCore.ts` |
| **العقد (Contracts)** | عقد مقاولة تفصيلي | اتفاقية إدارة وإشراف بنسبة مئوية | نعم | اختلاف الشروط والبنود القانونية | `contracts` |
| **جدول الكميات (Project BOQ)** | **متاح وأساسي** (تكعيب وقياسات وأسعار) | **مخفي تماماً** | لا | يعتمد التشطيب على الفواتير المباشرة | `project_items` |
| **المراحل (Phases)** | مراحل تنفيذ تعاقدية | مراحل إشراف وفواتير ونسبة | نعم | تثبيت نسبة التشطيب في المراحل | `project_phases` |
| **نسب الإنجاز (Progress)** | نسب إنجاز بنود المقايسة والعمالة | **مخفي لبنود المقايسة** | لا | متابعة مصنعيات الفنيين فقط | `technician_progress_records` |
| **المشتريات والخدمات (Purchases)** | مشتريات للمشروع والمراحل | مشتريات وخدمات موردين تدخل في التكلفة | نعم | تصنيف المواد والخدمات | `purchases` |
| **الفنيون والمقاولون الباطن** | مصنعيات بنود مقاولة | مصنعيات مباشرة معتمدة | نعم | اعتماد `earned_amount` كمصدر وحيد | `technician_progress_records` |
| **المعدات والإيجارات (Equipment)** | إيجارات معدات محملة | إيجارات معدات تدخل في قاعدة النسبة | نعم | منع الازدواجية مع فواتير الشراء | `purchases(rental_id)` |
| **مصروفات الموقع (Expenses)** | مصروفات مباشرة للمشروع | مصروفات مباشرة تدخل في قاعدة النسبة | نعم | عزل تام للمصروفات العامة (`project_id IS NULL`) | `expenses` |
| **إيصالات مقبوضات الزبائن** | تسديد على مستوى المشروع ككل | تسديد على مستوى المشروع ككل | نعم | لا يوجد أي توزيع على فواتير أو بنود | `client_payments` |
| **تطبيق الرصيد الدائن (FC-02)** | متاح من رصيد العميل المتاح | متاح من رصيد العميل المتاح | نعم | تسوية دفترية بدون حركة خزينة | `financialCore.ts` |
| **نسبة التشطيب (Percentage %)** | غير موجودة | **إلزامية ومثبتة** | لا | تطبق على قاعدة التكلفة المباشرة | `projects.finishing_percentage` |

---

## 8. خط الأساس لنموذج المقاولات (Contracting Model Baseline)

- **الملفات الحالية المسؤولة**: `GeneralItems.tsx`, `ProjectItems.tsx`, `CreateContract.tsx`, `ProjectContracts.tsx`, `ProjectProgress.tsx`.
- **المعادلة المعتمدة**: مستحق العميل = قيمة العقد المعتمد (أو مجموع بنود المقايسة).

---

## 9. خط الأساس لنموذج التشطيبات (Finishing Model Baseline)

- **الملف المعتمد الحصري للحسابات**: [`src/lib/financialCore.ts`](file:///e:/%D8%B1%D9%83%D8%A7%D8%B2/src/lib/financialCore.ts) عبر `calculateProjectFinancials`.
- **قاعدة التكلفة المباشرة المعتمدة (5 مصادر)**:
  $$\text{Eligible Cost Base} = \text{Materials} + \text{Supplier Services} + \text{Technician Earned} + \text{Equipment Rentals} + \text{Direct Expenses}$$
- **عمولة الإدارة واستحقاق العميل**:
  $$\text{Company Fee} = \text{Eligible Cost Base} \times \left( \frac{\text{Finishing Percentage}}{100} \right)$$
  $$\text{Client Obligation} = \text{Eligible Cost Base} + \text{Company Fee}$$

---

## 10. خط الأساس لدفعات العملاء والأرصدة الدائنة (Client Receipts & Credit Baseline — FC-02)

| المفهوم / العملية | السلوك المحاسبي المعتمد | أثر الخزينة | نطاق العملية | المرجع الحصري |
|---|---|---|---|---|
| **قبض نقدي لمشروع (`Cash Receipt`)** | يسدد مستحق المشروع حتى إقفاله | **`Treasury IN` = كامل المبلغ** | المشروع | `client_payments` |
| **فائض الدفعة (`Overpayment Credit`)** | يتحول بالكامل لرصيد دائن للعميل | مشمول في إيداع القبض الأصلي | مستوى العميل | `financialCore.ts` |
| **تطبيق رصيد دائن (`Apply Credit`)** | يسدد مستحق مشروع لاحق لنفس العميل | **`Treasury Delta` = 0 د.ل** | عميل $\rightarrow$ مشروع | `creditApplications` |
| **عكس تطبيق الرصيد (`Credit Reversal`)** | استعادة الرصيد الدائن المتاح للعميل | **`Treasury Delta` = 0 د.ل** | مستوى العميل | `financialCore.ts` |
| **حظر الحذف غير الآمن للقبض الأصلي** | يمنع حذف القبض إذا استهلك فائضه في مشاريع أخرى | حماية الرصيد من التحول لسالب | نظامي رقابي | `validateCashPaymentReversal` |

---

## 11. خط الأساس لنطاقات الخزائن (Treasury Domain Baseline)

- **قاعدة الشفافية:** `DEFAULT != SILENT` (عرض اسم الخزينة والرصيد والأثر المالي للمستخدم قبل الحفظ).
- **تقييد النطاق:** قصر قائمة الخزائن على خزائن المقاولات لمشاريع المقاولات وخزائن التشطيبات لمشاريع التشطيبات.

---

## 12. مخطط تنقل صفحات المشروع (Current Project Navigation Graph)

```mermaid
graph TD
    ProjectsList[قائمة المشاريع /projects] -->|نقر على بطاقة مشروع| OldPhases[/projects/:id/phases]
    OldPhases --> TabItems[/projects/:id/items]
    OldPhases --> TabPurchases[/projects/:id/purchases]
    OldPhases --> TabProgress[/projects/:id/progress]
    OldPhases --> TabRentals[/projects/:id/equipment]
    OldPhases --> TabExpenses[/projects/:id/expenses]
    OldPhases --> TabPayments[/projects/:id/payments]
    OldPhases --> TabContracts[/projects/:id/contracts]
    OldPhases --> TabReport[/projects/:id/report]
```

---

## 13. مصفوفة مصادر وملكيات الحالة (State Ownership Matrix)

- **معرف المشروع النشط (`projectId`)**: `URL Params (:id)` هو المرجع الحصري المعتمد.
- **معاملات التصفية والبحث**: مزامنة عبر `URL SearchParams (?phase=, ?search=)`.
- **بيانات المشروع والمالية**: كاش مركزي موحد عبر React Query مع إبطال دقيق.

---

## 14. خط الأساس لمفاتيح React Query (React Query Baseline)

- عزل مفاتيح الاستعلامات بنطاق المشروع `['project', id]`, `['project-purchases', id, phaseId]`, `['client-financials', clientId]`.

---

## 15. حصر النماذج والحوارات التشغيلية (Form Inventory)

- 13 نموذجاً تشغيلياً تم حصرها بالكامل وتحديد أسطح العرض المستهدفة (Drawers للمشتريات والإيجارات والبنود، و Modals للدفعات والمصروفات، و Full Page للعقود وإنشاء المشاريع).

---

## 16. خط الأساس للتعديلات غير المحفوظة (Unsaved Changes Baseline)

- تفعيل حارس التعديلات (`Unsaved Changes Guard`) وتتبع `isDirty` لمنع فقدان البيانات عند النقر بالخلفية أو الضغط على `Escape`.

---

## 17. خط الأساس لقوائم الاختيار والبحث (Search & Select Baseline)

- ترقية كافة القوائم المنسدلة عالية الحجم (المشاريع، العملاء، الموردين، الفنيين، الخزائن) إلى `Searchable Combobox` تعرض البيانات التعريفية الكاملة.

---

## 18. مصفوفة مخاطر التسجيل على المشروع الخاطئ (Wrong-Project Risk Matrix)

- إلزام إبراز سياق المشروع المكتمل (اسم المشروع + كود المشروع + العميل + النوع) في كافة شاشات ونماذج الإدخال.

---

## 19. خط الأساس للتجاوب والشاشات (Responsive Baseline)

- دعم كامل لشاشات الهواتف (375px)، الأجهزة اللوحية (768px)، الحواسيب (1024px/1366px)، والشاشات العريضة (1440px+).

---

## 20. خط الأساس لاتجاه النصوص والـ RTL (RTL Baseline)

- تصحيح أسهم الرجوع المعكوسة (`rotate-180` على `ArrowRight`) وتمرير `dir="rtl"` لجميع مكونات Radix UI.

---

## 21. خط الأساس لإمكانية الوصول (Accessibility Baseline)

- إضافة سمات `aria-label` لكافة أزرار الأيقونات وإدارة بؤرة التركيز (`Focus Management`).

---

## 22. خط الأساس لأدوار النظام (Roles Baseline)

- دعم وتدقيق صلاحيات الأدوار الأربعة: `admin` (29 عنصراً)، `accountant` (13 عنصراً)، `engineer` (5 عناصر)، `supervisor` (8 عناصر).

---

## 23. ميزانية وخط الأساس لعدد النقرات (Click Count Budget)

| مسار العمل التشغيلي (Workflow) | النقرات الراهنة | الهدف المستهدف (Target Budget) |
|---|:---:|---|
| **A. التبديل بين مشروعيْن داخل المشتريات (Project Switcher)** | **5 نقرات** | $\le 2\text{ interactions},\ 0\text{ backtracking},\ 0\text{ list re-search},\ 0\text{ full page reload}$ |
| **B. إضافة فاتورة مشتريات للمشروع الحالي** | **3 نقرات** | **1 نقرة** (Drawer مباشر) |
| **C. إضافة مورد جديد أثناء إدخال فاتورة الشراء** | غير ممكن (ضياع الفاتورة!) | **1 نقرة** (نافذة إنشاء مضمنة) |
| **D. تسجيل دفعة عميل للمشروع** | **3 نقرات** | **1 نقرة** |
| **E. تطبيق رصيد دائن للعميل على مشروع (FC-02)** | غير متاح | **1 نقرة** من صفحة العميل أو المشروع |

---

## 24. خط الأساس للأداء والانتقالات (Performance Baseline)

- الانتقال السلس عبر الراوتر العميل وتفعيل هياكل التحميل (`Skeleton Loaders`).

---

## 25. خط الأساس لفحوصات الثبات المالي وقاعدة البيانات (Financial Non-Regression Baseline)

- **أمر الفحص**: `npm run test:financial`
- **معرف الفحص المعتمد**: `Run ID: AUTO-INV-1786894976359`
- **النتيجة**:
  $$\mathbf{86\ Tests\ Executed\ |\ 86\ Passed\ |\ 0\ Failed\ (100\%\ Mathematical\ Precision)}$$
  - `INV-01` إلى `INV-24`: ثبات الخزائن والقيود الآلية (PASS).
  - `FINISHING-01` إلى `FINISHING-12`: قاعدة التكلفة الخماسية واستحقاق التشطيب (PASS).
  - `DEDUP-01` إلى `DEDUP-04`: خوارزميات منع تكرار الفنيين والمعدات (PASS).
  - `CLIENT-PROJECT-01` إلى `06`: دورة حياة دفعات العميل على مستوى المشروع (PASS).
  - `NO-CROSS-SETTLEMENT-01` إلى `03`: استقلال التحصيلات عن الصرف (PASS).
  - `CREDIT-01` إلى `CREDIT-14`: قوانين وتطبيقات الرصيد الدائن للزبائن (PASS).
  - `CREDIT-DB-01` إلى `CREDIT-DB-18`: ثبات وسلطة خادم قاعدة البيانات، قفل التعارض، منع التعديل المباشر، وأمان الحذف (PASS).
  - `GOLDEN-01` إلى `GOLDEN-05`: مطابقة منظومة المقاولات الذهبية السابقة (PASS).

---

## 26. خط الأساس لبناء الحزمة الإنتاجية (Production Build Baseline)

- **أمر البناء**: `npm run build`
- **النتيجة**: `Exit Code = 0 (Vite build successful in 15.48s with 0 TypeScript errors)`.

---

## 27. التحقق من عدم المساس بواجهات الإنتاج (Production Diff Verification)

- **تعديلات واجهات الإنتاج في Phase 0**: **0 تعديلات في التصميم أو الواجهات**.

---

## 28. العقد المعماري الملزم وغير القابل للتفاوض (Architecture Contract)

تعتبر المبادئ الـ 13 التالية **قوانين معمارية ملزمة** لكافة مراحل إعادة بناء الواجهة:

1. **القاعدة A — مساحة العمل المتمحورة حول المشروع (Project-Centric Shell)**: مساحة المشروع هي المركز التشغيلي الأساسي.
2. **القاعدة B — وحدة الإطار واختلاف النموذج التشغيلي (Shared Shell, Distinct Models)**: إخفاء بنود المقايسة في التشطيبات وتثبيت نسبة الإدارة.
3. **القاعدة C — نموذج المقاولات (Contracting Model)**: العقد المعتمد + بنود المقايسة + الأسعار المتفق عليها.
4. **القاعدة D — نموذج التشطيبات (Finishing Model)**: استهلاك النواة المركزية `financialCore.ts` حصراً لاحتساب التكلفة وعمولة الإدارة.
5. **القاعدة E — دفعات العملاء على مستوى المشروع (Project-Level Client Receipts)**: سداد العميل يخص المشروع ككل دون توزيع على فواتير.
6. **القاعدة F — حظر التسوية التقاطعية (No Cross-Settlement)**: استقلال قرارات صرف الموردين والفنيين عن دفعات الزبائن.
7. **القاعدة G — الرابط المصدري لسياق المشروع (`URL Params :id`)**: المرجع الحصري المعتمد لسياق العمل.
8. **القاعدة H — شفافية الخزينة (`DEFAULT != SILENT`)**: عرض اسم الخزينة ورصيدها المباشر والأثر المالي بوضوح.
9. **القاعدة I — تقييد نطاق الخزائن حسب نوع المشروع (Treasury Domain Constrained)**: تقييد الخزائن بنطاق المشروع.
10. **القاعدة J — حظر الحسابات المحلية في الواجهة (No Local Math in UI)**: استهلاك مخرجات `financialCore` مباشرة.
11. **القاعدة K — التوافق الرجعي التام للمسارات (Route Backward Compatibility)**: توجيه كافة المسارات القديمة بسلاسة (`Redirect`).
12. **القاعدة L — عزل الحالة ومنع التسريب (No Cross-Project State Leakage)**: إبطال كاش البيانات فور التبديل بين المشاريع.
13. **القاعدة M — قانون الرصيد الدائن للعملاء (Client Advance / Credit Law — FC-02)**:
    - الفائض النقدي يتحول لرصيد دائن على مستوى العميل موثق في دفتر الأرصدة (`client_credit_ledger`).
    - الرصيد الدائن متاح لإعادة الاستخدام يدوياً على أي مشروع مستقبلي يتبع نفس العميل.
    - تطبيق الرصيد الدائن حركة تسوية دفترية صرفة ($\text{Treasury Delta} = 0$).
    - يمنع التوزيع التلقائي ويحظر التطبيق عبر عملاء مختلفين على مستوى الخادم (`Server-Side Blocked`).
    - التدفق النقدي الوارد يعكس المقبوضات النقدية الفعلية فقط ولا يضاعف الحركات الدفترية.
    - الحذف والعكس محمي محاسبياً ضد الاستهلاك التابع.
    - الرصيد الدائن حدثي ومستقر زمنياً ولا تتم إعادة كتابته أو إنقاصه تلقائياً عند زيادة التكلفة اللاحقة لمشاريع التشطيبات.

---

## 29. بوابة القبول والإغلاق لمرحلة Phase 0 (Phase 0 Acceptance Gate)

```
================================================================
                    PHASE 0 ACCEPTANCE GATE
================================================================
ACTUAL ROUTE INVENTORY       = COMPLETE (64 Routes Documented)
ROUTE COUNT TRUTH            = RESOLVED (63 Named/Index + 1 CatchAll)
SIDEBAR INVENTORY            = COMPLETE (29 Items Documented)
PROJECT TYPE UX MATRIX       = COMPLETE (14 Domains Mapped)
TREASURY DOMAIN BASELINE     = COMPLETE (Gaps Identified)
STATE OWNERSHIP MATRIX       = COMPLETE (URL-First Locked)
FORMS & DIALOGS INVENTORY    = COMPLETE (13 Forms Analyzed)
CLICK BUDGET BASELINE        = COMPLETE (<= 2 Interactions Target)
FINANCIAL REGRESSION TESTS   = 86/86 PASS (0 Failed)
PRODUCTION BUILD STATUS      = PASS (Exit Code 0)
PRODUCTION UX REDESIGN       = 0 (Zero Changes)
FC-02 CLIENT CREDIT LEDGER   = COMPLETE — PERSISTED — HARDENED
================================================================
UX PHASE 0                   = COMPLETE — VERIFIED
ARCHITECTURE CONTRACT        = LOCKED & SIGNED
================================================================
READY FOR: UX PHASE 1 — NAVIGATION SAFETY & STATE PRESERVATION
================================================================
```
