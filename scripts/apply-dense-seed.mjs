import { supabase } from './financial-tests/client.mjs';

const T_CONTRACTING_CASH = 'c504cce9-8bfd-4cda-8296-80febdec2432';
const T_CONTRACTING_BANK = 'ff7416dd-5295-4e55-bd52-2196eef9ec37';
const T_FINISHING_CASH = 'f9637060-3f26-445e-b77c-658b31da2269';

async function runSeed() {
  console.log('========================================================');
  console.log('STARTING DENSE REALISTIC ZLITEN ERP DATABASE SEEDING');
  console.log('========================================================\n');

  // 1. Fetch technician types mapping
  const { data: techTypes } = await supabase.from('technician_types').select('id, code');
  const ttMap = {};
  if (techTypes) techTypes.forEach(t => ttMap[t.code] = t.id);

  // PURGE OLD TEST DATA FIRST
  console.log('--- PURGING OLD BUSINESS DATA ---');
  const purgeTables = [
    'audit_logs',
    'client_payment_allocations',
    'client_credit_ledger',
    'purchase_payments',
    'purchases',
    'equipment_rentals',
    'equipment',
    'expenses',
    'technician_progress_records',
    'project_item_technicians',
    'project_item_technician_requirements',
    'client_payments',
    'transfers',
    'contracts',
    'project_items',
    'project_phases',
    'project_suppliers',
    'project_technicians',
    'projects',
    'suppliers',
    'technicians',
    'clients',
    'engineers',
    'employees',
  ];

  for (const tbl of purgeTables) {
    const { error } = await supabase.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn(`  ⚠️ Could not purge ${tbl}:`, error.message);
    else console.log(`  ✓ Purged ${tbl}`);
  }

  // Clean test treasuries
  const legitIds = [T_CONTRACTING_CASH, T_CONTRACTING_BANK, T_FINISHING_CASH];
  await supabase.from('treasury_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('treasuries').update({ balance: 0 }).not('id', 'in', `(${legitIds.join(',')})`);
  await supabase.from('treasuries').delete().not('id', 'in', `(${legitIds.join(',')})`);

  // 1. TREASURIES - ensure roots & branch exist
  console.log('\n--- 1. ENSURING CANONICAL TREASURIES ---');
  const treasuries = [
    {
      id: T_CONTRACTING_CASH,
      name: 'خزينة المقاولات الرئيسية',
      description: 'الخزينة النقدية الرئيسية المعتمدة لمشاريع المقاولات العامة والإنشاءات',
      treasury_type: 'cash',
      project_category: 'contracting',
      parent_id: null,
      balance: 100000,
      is_active: true,
      notes: 'الخزينة النقدية المركزية لقطاع المقاولات — زليتن'
    },
    {
      id: T_CONTRACTING_BANK,
      name: 'حساب مصرف الوحدة (جاري)',
      description: 'الحساب المصرفي الجاري المخصص لعمليات وتحويلات المقاولات',
      treasury_type: 'bank',
      bank_name: 'مصرف الوحدة',
      account_number: '0123-456789-001',
      project_category: 'contracting',
      parent_id: T_CONTRACTING_CASH,
      balance: 400000,
      is_active: true,
      notes: 'فرع مصرف الوحدة — زليتن'
    },
    {
      id: T_FINISHING_CASH,
      name: 'خزينة التشطيبات الرئيسية',
      description: 'الخزينة النقدية الرئيسية المعتمدة لمشاريع وأعمال التشطيبات والديكور',
      treasury_type: 'cash',
      project_category: 'finishing',
      parent_id: null,
      balance: 50000,
      is_active: true,
      notes: 'الخزينة النقدية المركزية لقطاع التشطيبات — زليتن'
    }
  ];
  for (const t of treasuries) {
    const { error } = await supabase.from('treasuries').upsert(t);
    if (error) console.error('Treasury error:', error);
    else console.log(`  ✓ Treasury: ${t.name}`);
  }

  // 2. GENERAL PROJECT ITEMS
  console.log('\n--- 2. SEEDING GENERAL PROJECT ITEMS (20) ---');
  const generalItems = [
    { id: 'a1000000-0000-0000-0000-000000000001', name: 'حفر وتسوية الموقع ونقل المخلفات', category: 'earthworks', measurement_type: 'م³', default_unit_price: 18, description: 'أعمال حفر الأساسات ميكانيكياً وتسوية القاع' },
    { id: 'a1000000-0000-0000-0000-000000000002', name: 'إحلال وردم برمل نظيف ودك طبقات', category: 'earthworks', measurement_type: 'م³', default_unit_price: 24, description: 'توريد رمل نظيف وتوريد مياه ودك ميكانيكي' },
    { id: 'a1000000-0000-0000-0000-000000000003', name: 'خرسانة عادية فرشة نظافة عيار 250', category: 'concrete', measurement_type: 'م³', default_unit_price: 280, description: 'صب فرشة نظافة سمك 10 سم أسفل القواعد' },
    { id: 'a1000000-0000-0000-0000-000000000004', name: 'خرسانة مسلحة للقواعد والميد عيار 350', category: 'concrete', measurement_type: 'م³', default_unit_price: 360, description: 'خرسانة جاهزة مع حديد التسليح والنجارة' },
    { id: 'a1000000-0000-0000-0000-000000000005', name: 'خرسانة مسلحة للأعمدة وحوائط القص', category: 'concrete', measurement_type: 'م³', default_unit_price: 420, description: 'أعمدة وحوائط خرسانية عيار 350 مقاوم' },
    { id: 'a1000000-0000-0000-0000-000000000006', name: 'خرسانة مسلحة للأسقف والكمرات المصمتة', category: 'concrete', measurement_type: 'م³', default_unit_price: 390, description: 'أسقف مسلحة شاملة الشدات الخشبية وحديد التسليح' },
    { id: 'a1000000-0000-0000-0000-000000000007', name: 'مباني طوب أسمنتي مفرغ 20 سم', category: 'masonry', measurement_type: 'م²', default_unit_price: 32, description: 'بناء قواطع وجدران خارجية طوب أسمنتي 20 سم' },
    { id: 'a1000000-0000-0000-0000-000000000008', name: 'مباني طوب أسمنتي مفرغ 15 سم', category: 'masonry', measurement_type: 'م²', default_unit_price: 28, description: 'بناء قواطع داخلية طوب 15 سم' },
    { id: 'a1000000-0000-0000-0000-000000000009', name: 'عزل مائي للقواعد ورقاب الأعمدة بالبيتومين', category: 'insulation', measurement_type: 'م²', default_unit_price: 14, description: 'دهان وجهين بيتومين مطاطي عازل للرطوبة' },
    { id: 'a1000000-0000-0000-0000-000000000010', name: 'عزل مائي وحراري للأسطح بممبرين 4 مم', category: 'insulation', measurement_type: 'م²', default_unit_price: 45, description: 'لفائف ممبرين مسلحة مع ألواح فوم عازل' },
    { id: 'a1000000-0000-0000-0000-000000000011', name: 'لياسة أسمنتية داخلية للجدران والأسقف', category: 'plaster', measurement_type: 'م²', default_unit_price: 18, description: 'طرطشة وبؤج وأوتار ولياسة ناعمة' },
    { id: 'a1000000-0000-0000-0000-000000000012', name: 'لياسة أسمنتية خارجية ملونة (واجهات)', category: 'plaster', measurement_type: 'م²', default_unit_price: 26, description: 'لياسة واجهات مقاومة للعوامل الجوية' },
    { id: 'a1000000-0000-0000-0000-000000000013', name: 'أرضيات سيراميك وبورسلين نخب أول', category: 'flooring', measurement_type: 'م²', default_unit_price: 55, description: 'توريد وتركيب أرضيات بمونة البورسلين والغراء' },
    { id: 'a1000000-0000-0000-0000-000000000014', name: 'أرضيات ودرج رخام طبيعي كرارة تركي', category: 'flooring', measurement_type: 'م ط', default_unit_price: 95, description: 'تركيب درج ومداخل رخام مع الجلي والتلميع' },
    { id: 'a1000000-0000-0000-0000-000000000015', name: 'تأسيس شبكة كهرباء وإنارة متكاملة', category: 'electrical', measurement_type: 'مقطوعية', default_unit_price: 15000, description: 'تمديد مواسير وخراطيم وعلب ماجيك وكابلات رئيسية' },
    { id: 'a1000000-0000-0000-0000-000000000016', name: 'تأسيس شبكة سباكة وتغذية وصرف صحي', category: 'plumbing', measurement_type: 'مقطوعية', default_unit_price: 12000, description: 'تمديد مواسير حرارية PPR وشبكة الصرف PVC' },
    { id: 'a1000000-0000-0000-0000-000000000017', name: 'أبواب وشبابيك ألمنيوم دبل جلاس سيكوريت', category: 'aluminum', measurement_type: 'م²', default_unit_price: 220, description: 'قطاع خاص عازل للصوت والحرارة مع إكسسوارات إيطالية' },
    { id: 'a1000000-0000-0000-0000-000000000018', name: 'أعمال جبس بورد معلق وديكورات إنارة مخفية', category: 'decoration', measurement_type: 'م²', default_unit_price: 48, description: 'ألواح جبس كناوف مقاوم للرطوبة مع الشاسيه والدهان' },
    { id: 'a1000000-0000-0000-0000-000000000019', name: 'دهانات داخلية حريرية جوتن معجون وسيلر', category: 'painting', measurement_type: 'م²', default_unit_price: 22, description: 'سيلر مائي و3 سكينات معجون ووجهين دهان نهائي' },
    { id: 'a1000000-0000-0000-0000-000000000020', name: 'توريد وتركيب حديد تسليح مقصوص ومثني', category: 'materials', measurement_type: 'طن', default_unit_price: 4200, description: 'حديد تسليح عالي المقاومة أوكراني وليبي 8 مم - 25 مم' }
  ];
  const { error: giErr } = await supabase.from('general_project_items').upsert(generalItems);
  if (giErr) console.error('General items error:', giErr);
  else console.log(`  ✓ Seeded ${generalItems.length} General Project Items`);

  // 3. CLIENTS
  console.log('\n--- 3. SEEDING CLIENTS (14) ---');
  const clients = [
    { id: 'b1000000-0000-0000-0000-000000000001', name: 'محمد عبدالله اشميلة', phone: '0912345678', city: 'زليتن', address: 'طريق الفندق — زليتن', notes: 'عميل رئيسي لمشاريع المقاولات والتشطيبات السكنية' },
    { id: 'b1000000-0000-0000-0000-000000000002', name: 'عبدالملك إبراهيم قراطم', phone: '0923456789', city: 'زليتن', address: 'محلة البازة — زليتن', notes: 'فيلا سكنية خاصة ومشروع تجاري' },
    { id: 'b1000000-0000-0000-0000-000000000003', name: 'سالم مفتاح الترهوني', phone: '0913456780', city: 'زليتن', address: 'طريق البحر — زليتن', notes: 'عميل مشروع فيلا طابقين' },
    { id: 'b1000000-0000-0000-0000-000000000004', name: 'د. مصطفى علي بن عمران', phone: '0924567891', city: 'زليتن', address: 'شارع طرابلس — زليتن', notes: 'مالك مجمع عيادات ومبنى تجاري' },
    { id: 'b1000000-0000-0000-0000-000000000005', name: 'خالد الصادق الزليتني', phone: '0915678902', city: 'زليتن', address: 'محلة المنطردة — زليتن', notes: 'مشروع استراحة ومسبح عائلي' },
    { id: 'b1000000-0000-0000-0000-000000000006', name: 'عمر المختار البكوش', phone: '0926789013', city: 'زليتن', address: 'شارع الميناء — زليتن', notes: 'استثمار عقاري وتجاري' },
    { id: 'b1000000-0000-0000-0000-000000000007', name: 'رمضان فرج الفيتوري', phone: '0917890124', city: 'زليتن', address: 'سوق الجمعة — زليتن', notes: 'مشروع عمارة سكنية استثمارية' },
    { id: 'b1000000-0000-0000-0000-000000000008', name: 'عبدالباسط المنتصر', phone: '0928901235', city: 'زليتن', address: 'طريق الخمس — زليتن', notes: 'مشروع صالة مناسبات كبرى' },
    { id: 'b1000000-0000-0000-0000-000000000009', name: 'جمال مسعود الفلاح', phone: '0919012346', city: 'زليتن', address: 'محلة ماجر — زليتن', notes: 'مشروع مزرعة ومسكن ريفي' },
    { id: 'b1000000-0000-0000-0000-000000000010', name: 'حمزة كمال أبوغالية', phone: '0920123457', city: 'زليتن', address: 'طريق كعام — زليتن', notes: 'مشروع فيلا مع حديقة وموقف سيارات' },
    { id: 'b1000000-0000-0000-0000-000000000011', name: 'شركة الأفق للاستثمار العقاري', phone: '0911223344', city: 'زليتن', address: 'المنطقة الحرة — زليتن', notes: 'شركة عقارية — مشروع عمارة الأفق الإدارية' },
    { id: 'b1000000-0000-0000-0000-000000000012', name: 'مجموعة الساحل للمقاولات والتجارة', phone: '0922334455', city: 'زليتن', address: 'المدخل الشرقي — زليتن', notes: 'مجموعة تجارية — مشروع مكاتب ومقر الساحل' },
    { id: 'b1000000-0000-0000-0000-000000000013', name: 'جمعية النماء الخيرية والتنموية', phone: '0913344556', city: 'زليتن', address: 'وسط المدينة — زليتن', notes: 'مشروع مدرسة النماء الخاصة ومسجد الرحمة' },
    { id: 'b1000000-0000-0000-0000-000000000014', name: 'مؤسسة زليتن للخدمات الطبية', phone: '0924455667', city: 'زليتن', address: 'شارع المستشفى — زليتن', notes: 'مشروع عيادة الشفاء التخصصية' }
  ];
  const { error: clErr } = await supabase.from('clients').upsert(clients);
  if (clErr) console.error('Clients error:', clErr);
  else console.log(`  ✓ Seeded ${clients.length} Clients`);

  // 4. SUPPLIERS
  console.log('\n--- 4. SEEDING SUPPLIERS (12) ---');
  const suppliers = [
    { id: 'c1000000-0000-0000-0000-000000000001', name: 'مؤسسة الوارد لمواد البناء والإسمنت', phone: '0913112233', city: 'زليتن', address: 'طريق الميناء — زليتن', notes: 'توريد إسمنت زليتن المعتمد وحديد أوكراني' },
    { id: 'c1000000-0000-0000-0000-000000000002', name: 'شركة البنيان للحديد والصلب', phone: '0924223344', city: 'زليتن', address: 'المنطقة الصناعية — زليتن', notes: 'توريد حديد صلب بجميع القياسات ومواسير حديدية' },
    { id: 'c1000000-0000-0000-0000-000000000003', name: 'مخزن الساحل للإسمنت والركام', phone: '0915334455', city: 'زليتن', address: 'محلة بازينة — زليتن', notes: 'توريد رمل مغسول وركام ممتاز وشاحنات ردم' },
    { id: 'c1000000-0000-0000-0000-000000000004', name: 'شركة زليتن للرخام والسيراميك والبورسلين', phone: '0926445566', city: 'زليتن', address: 'شارع طرابلس — زليتن', notes: 'رخام طبيعي وسيراميك إسباني وإيطالي عالي الجودة' },
    { id: 'c1000000-0000-0000-0000-000000000005', name: 'مؤسسة النخبة للتجهيزات والأسلاك الكهربائية', phone: '0917556677', city: 'زليتن', address: 'سوق الجمعة — زليتن', notes: 'كابلات سويدي ومفاتيح باناسونيك ولوحات تحكم' },
    { id: 'c1000000-0000-0000-0000-000000000006', name: 'شركة الأمان للأدوات الصحية وشبكات السباكة', phone: '0928667788', city: 'زليتن', address: 'شارع الميناء — زليتن', notes: 'مواسير PPR حرارية وخلاطات ومضخات غطاس' },
    { id: 'c1000000-0000-0000-0000-000000000007', name: 'مؤسسة الإعمار لقطاعات الألمنيوم والزجاج', phone: '0919778899', city: 'زليتن', address: 'شارع المستشفى — زليتن', notes: 'واجهات كارتن وول وشبابيك دبل جلاس سيكوريت' },
    { id: 'c1000000-0000-0000-0000-000000000008', name: 'الوفاق للدهانات ومواد الديكور والجبس', phone: '0921889900', city: 'زليتن', address: 'محلة الشيخ — زليتن', notes: 'وكيل دهانات جوتن وألواح كناوف الألمانية' },
    { id: 'c1000000-0000-0000-0000-000000000009', name: 'شركة المدار لمعدات السقالات والشدات المعدنية', phone: '0912990011', city: 'زليتن', address: 'الطريق الدائري — زليتن', notes: 'سقالات وجكات وخلاطات ومعدات ثقيلة' },
    { id: 'c1000000-0000-0000-0000-000000000010', name: 'مصنع زليتن للبلوك والطوب الإسمنتي', phone: '0925332244', city: 'زليتن', address: 'طريق ماجر — زليتن', notes: 'طوب أسمنتي 20 سم و15 سم وهوردي عالي الجودة' },
    { id: 'c1000000-0000-0000-0000-000000000011', name: 'محاجر الرمال والركام الذهبية — كعام', phone: '0914221133', city: 'زليتن', address: 'جنوب زليتن — كعام', notes: 'رمل أحمر وركام مغسول ومواد ردم وتسوية' },
    { id: 'c1000000-0000-0000-0000-000000000012', name: 'مؤسسة الدقة للتكييف المركزي والتهوية', phone: '0923110022', city: 'زليتن', address: 'وسط المدينة — زليتن', notes: 'أنظمة VRF ودكت تكييف مركزي وفلاتر طبية' }
  ];
  const { error: spErr } = await supabase.from('suppliers').upsert(suppliers);
  if (spErr) console.error('Suppliers error:', spErr);
  else console.log(`  ✓ Seeded ${suppliers.length} Suppliers`);

  // 5. TECHNICIANS
  console.log('\n--- 5. SEEDING TECHNICIANS (19) ---');
  const technicians = [
    { id: 'd1000000-0000-0000-0000-000000000001', name: 'أحمد مصطفى محمود', phone: '0912111222', specialty: 'كهربائي عام وتأسيس شبكات', nationality: 'مصري', technician_type_id: ttMap['ELEC'], status: 'active', daily_rate: 150, rating: 5, notes: 'خبرة 12 سنة في تأسيس شبكات الكهرباء والإنارة' },
    { id: 'd1000000-0000-0000-0000-000000000002', name: 'محمود عبدالفتاح السيد', phone: '0923222333', specialty: 'فني أرضيات وسيراميك وبورسلين', nationality: 'مصري', technician_type_id: ttMap['CERAMIC'], status: 'active', daily_rate: 140, rating: 5, notes: 'دقة عالية في تركيب البورسلين والرخام' },
    { id: 'd1000000-0000-0000-0000-000000000003', name: 'إبراهيم حسن الدسوقي', phone: '0914333444', specialty: 'سباك صحي وتمديدات حرارية', nationality: 'مصري', technician_type_id: ttMap['PLUMB'], status: 'active', daily_rate: 130, rating: 4, notes: 'شبكات تغذية وصرف صحي للمباني' },
    { id: 'd1000000-0000-0000-0000-000000000004', name: 'سامح جلال عبدالمجيد', phone: '0925444555', specialty: 'نجار مسلح وقواعد وأسقف', nationality: 'مصري', technician_type_id: ttMap['CARP_STRUCT'], status: 'active', daily_rate: 160, rating: 5, notes: 'رئيس فريق نجارة مسلحة وقراءة المخططات الإنشائية' },
    { id: 'd1000000-0000-0000-0000-000000000005', name: 'طارق رمضان الشريف', phone: '0916555666', specialty: 'مليس ومحار ومباني داخلية', nationality: 'مصري', technician_type_id: ttMap['PLASTER'], status: 'active', daily_rate: 120, rating: 4, notes: 'لياسة ناعمة وبؤج وأوتار' },
    { id: 'd1000000-0000-0000-0000-000000000006', name: 'محمد آدم عثمان', phone: '0927666777', specialty: 'بناء طوب وبلوك أسمنتي', nationality: 'سوداني', technician_type_id: ttMap['MASON'], status: 'active', daily_rate: 110, rating: 5, notes: 'إنتاجية عالية في بناء الجدران والقواطع' },
    { id: 'd1000000-0000-0000-0000-000000000007', name: 'يعقوب إدريس بحر', phone: '0918777888', specialty: 'عامل خرسانات ومساعد صب', nationality: 'سوداني', technician_type_id: ttMap['MASON'], status: 'active', daily_rate: 90, rating: 4, notes: 'أعمال الصب اليدوي والدك وهز الخرسانة' },
    { id: 'd1000000-0000-0000-0000-000000000008', name: 'عبدالرحمن النور تية', phone: '0929888999', specialty: 'فني حفر وتسوية ودمك تربة', nationality: 'سوداني', technician_type_id: ttMap['MASON'], status: 'active', daily_rate: 95, rating: 4, notes: 'تسوية الأساسات وأعمال الردم الميكانيكي' },
    { id: 'd1000000-0000-0000-0000-000000000009', name: 'عثمان موسى حامد', phone: '0910999000', specialty: 'حداد تسليح وقص وثني', nationality: 'سوداني', technician_type_id: ttMap['STEEL_STRUCT'], status: 'active', daily_rate: 140, rating: 5, notes: 'حدادة مسلحة وقص وتشكيل الكانات' },
    { id: 'd1000000-0000-0000-0000-000000000010', name: 'هشام الورتاني', phone: '0911001122', specialty: 'فني دهانات وديكورات مائية', nationality: 'تونسي', technician_type_id: ttMap['PAINT'], status: 'active', daily_rate: 160, rating: 5, notes: 'دهانات حريرية وورق جدران ومؤثرات' },
    { id: 'd1000000-0000-0000-0000-000000000011', name: 'خالد العلي الشامخ', phone: '0922112233', specialty: 'معلم جبس بورد وأسقف معلقة', nationality: 'سوري', technician_type_id: ttMap['GYPSUM'], status: 'active', daily_rate: 180, rating: 5, notes: 'تصاميم ديكورية معقدة وإنارة مخفية' },
    { id: 'd1000000-0000-0000-0000-000000000012', name: 'أنس الحلبي', phone: '0913223344', specialty: 'فني سمارت هوم وتحكم كهربائي', nationality: 'سوري', technician_type_id: ttMap['ELEC_FINISH'], status: 'active', daily_rate: 190, rating: 5, notes: 'برمجة أنظمة التحكم الذكي والمراقبة' },
    { id: 'd1000000-0000-0000-0000-000000000013', name: 'بشار الدالاتي', phone: '0924334455', specialty: 'فني تكييف وتهوية مركزية', nationality: 'سوري', technician_type_id: ttMap['HVAC'], status: 'active', daily_rate: 170, rating: 5, notes: 'تركيب أنظمة VRF ودكت تكييف مركزي' },
    { id: 'd1000000-0000-0000-0000-000000000014', name: 'عمار عبدالسلام احميدة', phone: '0915445566', specialty: 'مشرف مواقع خرسانات ومقاولات', nationality: 'ليبي', technician_type_id: ttMap['GEN_LABOR'], status: 'active', daily_rate: 200, rating: 5, notes: 'إشراف ميداني ومتابعة تسليم الدفعات' },
    { id: 'd1000000-0000-0000-0000-000000000015', name: 'سالم مفتاح غيث', phone: '0926556677', specialty: 'فني تركيب ألمنيوم وواجهات زجاج', nationality: 'ليبي', technician_type_id: ttMap['ALUM_GLASS'], status: 'active', daily_rate: 170, rating: 4, notes: 'تركيب قطاعات الألمنيوم والواجهات' },
    { id: 'd1000000-0000-0000-0000-000000000016', name: 'يوسف الهادي بن غشير', phone: '0917667788', specialty: 'فني عزل مائي وحراري للأسطح', nationality: 'ليبي', technician_type_id: ttMap['INSUL'], status: 'active', daily_rate: 150, rating: 5, notes: 'عزل أسطح بممبرين وفوم بولي يوريثان' },
    { id: 'd1000000-0000-0000-0000-000000000017', name: 'محمد الصادق الأسطى', phone: '0928778899', specialty: 'معلم رخام وواجهات حجرية', nationality: 'ليبي', technician_type_id: ttMap['MARBLE'], status: 'active', daily_rate: 190, rating: 5, notes: 'تركيب وجلي وتلميع رخام الواجهات' },
    { id: 'd1000000-0000-0000-0000-000000000018', name: 'فرحات المهدي الفرجاني', phone: '0919889900', specialty: 'حداد أبواب وسياجات ليزر', nationality: 'ليبي', technician_type_id: ttMap['STEEL_STRUCT'], status: 'active', daily_rate: 160, rating: 4, notes: 'أبواب وسلالم ومظلات معدنية' },
    { id: 'd1000000-0000-0000-0000-000000000019', name: 'مصطفى كمال بن نصر', phone: '0920990011', specialty: 'فني نجارة خشب وأبواب داخلية', nationality: 'ليبي', technician_type_id: ttMap['WOOD_DOORS'], status: 'active', daily_rate: 160, rating: 5, notes: 'تركيب أبواب خشبية ومطابخ وغرف نوم' }
  ];
  const { error: tcErr } = await supabase.from('technicians').upsert(technicians);
  if (tcErr) console.error('Technicians error:', tcErr);
  else console.log(`  ✓ Seeded ${technicians.length} Technicians`);

  // 6. ENGINEERS & EMPLOYEES
  console.log('\n--- 6. SEEDING ENGINEERS & EMPLOYEES ---');
  const engineers = [
    { id: 'e1000000-0000-0000-0000-000000000001', name: 'م. يونس المختار الفيتوري', phone: '0913000111', specialty: 'هندسة مدنية وإشراف إنشائي', email: 'younis@rekaz.ly', is_active: true, notes: 'كبير المهندسين المشرفين — مشاريع المقاولات' },
    { id: 'e1000000-0000-0000-0000-000000000002', name: 'م. عبدالسلام نوري الزروق', phone: '0924000222', specialty: 'هندسة معمارية وتصميم ديكور', email: 'abdulsalam@rekaz.ly', is_active: true, notes: 'مدير قسم التصميم المعماري والتشطيبات' },
    { id: 'e1000000-0000-0000-0000-000000000003', name: 'م. طارق الصيد البكوش', phone: '0915000333', specialty: 'هندسة كهربائية وشبكات ذكية', email: 'tariq@rekaz.ly', is_active: true, notes: 'مشرف الأعمال الكهروميكانيكية MEP' },
    { id: 'e1000000-0000-0000-0000-000000000004', name: 'م. أسامة مفتاح الرويمي', phone: '0926000444', specialty: 'هندسة مساحة ومتابعة مشاريع', email: 'osama@rekaz.ly', is_active: true, notes: 'مهندس حساب كميات ومساحة ميدانية' }
  ];
  await supabase.from('engineers').upsert(engineers);

  const employees = [
    { id: 'e2000000-0000-0000-0000-000000000001', name: 'أحمد سالم القماطي', phone: '0917000555', role: 'محاسب مالي أول', department: 'المالية والحسابات', is_active: true, notes: 'مسؤول القيود والتسويات اليومية' },
    { id: 'e2000000-0000-0000-0000-000000000002', name: 'صالح بشير احميدة', phone: '0928000666', role: 'أمين خزينة ومسؤول مشتريات', department: 'الخزينة والمشتريات', is_active: true, notes: 'أمين العهدة والمشتريات الميدانية' },
    { id: 'e2000000-0000-0000-0000-000000000003', name: 'إبراهيم خليل الوحيشي', phone: '0919000777', role: 'مسؤول الموارد البشرية والمتابعة', department: 'الموارد البشرية', is_active: true, notes: 'سجلات الفنيين والعقود والإقامات' },
    { id: 'e2000000-0000-0000-0000-000000000004', name: 'منير فتحي الدوكالي', phone: '0920000888', role: 'أمين مستودع ومعدات', department: 'المخازن والآليات', is_active: true, notes: 'مسؤول حركة المعدات والآليات' }
  ];
  await supabase.from('employees').upsert(employees);
  console.log(`  ✓ Seeded 4 Engineers and 4 Employees`);

  // 7. PROJECTS (16 REAL PROJECTS)
  console.log('\n--- 7. SEEDING 16 PROJECTS (9 CONTRACTING, 7 FINISHING) ---');
  const projects = [
    // Contracting
    { id: 'f1000000-0000-0000-0000-000000000001', name: 'مشروع إنشاء مسجد الرحمة — زليتن', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000001', engineer_id: 'e1000000-0000-0000-0000-000000000001', treasury_id: T_CONTRACTING_CASH, status: 'in_progress', contract_value: 320000, start_date: '2026-01-01', end_date: '2026-11-30', progress: 68, description: 'إنشاء مسجد سعة 500 مصل مع مئذنة وقبة خرسانية وميضأة متكاملة' },
    { id: 'f1000000-0000-0000-0000-000000000002', name: 'مشروع بناء عظم فيلا عبدالملك قراطم', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000002', engineer_id: 'e1000000-0000-0000-0000-000000000001', treasury_id: T_CONTRACTING_CASH, status: 'in_progress', contract_value: 240000, start_date: '2026-02-15', end_date: '2026-12-31', progress: 42, description: 'فيلا سكنية طابقين وملحق بمساحة إجمالية 650 م² — محلة البازة' },
    { id: 'f1000000-0000-0000-0000-000000000003', name: 'مشروع إنشاء منزل محمد اشميلة (عظم)', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000001', engineer_id: 'e1000000-0000-0000-0000-000000000004', treasury_id: T_CONTRACTING_CASH, status: 'in_progress', contract_value: 180000, start_date: '2026-03-01', end_date: '2027-01-15', progress: 30, description: 'منزل سكني طابق أرضي وأول مع سور وموقف سيارات — طريق الفندق' },
    { id: 'f1000000-0000-0000-0000-000000000004', name: 'مشروع عمارة الأفق الإدارية والتجارية', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000011', engineer_id: 'e1000000-0000-0000-0000-000000000001', treasury_id: T_CONTRACTING_BANK, status: 'in_progress', contract_value: 850000, start_date: '2025-09-01', end_date: '2026-09-30', progress: 85, description: 'عمارة استثمارية 5 طوابق ومواقف بدروم — المنطقة الحرة زليتن' },
    { id: 'f1000000-0000-0000-0000-000000000005', name: 'مشروع مستودع التبريد المركزي — المنطقة الصناعية', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000004', engineer_id: 'e1000000-0000-0000-0000-000000000004', treasury_id: T_CONTRACTING_CASH, status: 'in_progress', contract_value: 210000, start_date: '2026-02-01', end_date: '2026-08-30', progress: 55, description: 'هيكل خرساني ومعدني لمستودع تخزين مبرد بمساحة 1200 م²' },
    { id: 'f1000000-0000-0000-0000-000000000006', name: 'مشروع بناء فيلا سالم الترهوني', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000003', engineer_id: 'e1000000-0000-0000-0000-000000000001', treasury_id: T_CONTRACTING_CASH, status: 'in_progress', contract_value: 260000, start_date: '2026-04-01', end_date: '2027-03-31', progress: 20, description: 'فيلا سكنية فاخرة طابقين مع حديقة ومسبح — طريق البحر' },
    { id: 'f1000000-0000-0000-0000-000000000007', name: 'مشروع مقر شركة الساحل للتجارة', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000012', engineer_id: 'e1000000-0000-0000-0000-000000000004', treasury_id: T_CONTRACTING_BANK, status: 'in_progress', contract_value: 450000, start_date: '2025-10-15', end_date: '2026-07-31', progress: 75, description: 'مبنى إداري 3 طوابق وصالة عرض منتجات — المدخل الشرقي' },
    { id: 'f1000000-0000-0000-0000-000000000008', name: 'مشروع مدرسة النماء الابتدائية الخاصة', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000013', engineer_id: 'e1000000-0000-0000-0000-000000000001', treasury_id: T_CONTRACTING_BANK, status: 'completed', contract_value: 750000, start_date: '2025-06-01', end_date: '2026-05-31', progress: 100, description: 'مبنى تعليمي نموذجي 16 فصلاً ومختبرات وملاعب' },
    { id: 'f1000000-0000-0000-0000-000000000009', name: 'مشروع استراحة كعام ومسبح الزليتني', project_type: 'contracting', client_id: 'b1000000-0000-0000-0000-000000000005', engineer_id: 'e1000000-0000-0000-0000-000000000004', treasury_id: T_CONTRACTING_CASH, status: 'in_progress', contract_value: 150000, start_date: '2026-05-01', end_date: '2027-02-28', progress: 15, description: 'استراحة مصيفية ومبنى ضيافة ومسبح خارجي خرساني — كعام' },

    // Finishing
    { id: 'f2000000-0000-0000-0000-000000000001', name: 'مشروع تشطيبات وديكور منزل اشميلة', project_type: 'finishing', client_id: 'b1000000-0000-0000-0000-000000000001', engineer_id: 'e1000000-0000-0000-0000-000000000002', treasury_id: T_FINISHING_CASH, status: 'in_progress', contract_value: 65000, start_date: '2026-02-01', end_date: '2026-09-30', progress: 60, description: 'تشطيبات داخلية وخارجية، جبس بورد، سباكة وكهرباء سمارت، وأرضيات بورسلين' },
    { id: 'f2000000-0000-0000-0000-000000000002', name: 'مشروع تشطيب وديكورات فيلا قراطم الفاخرة', project_type: 'finishing', client_id: 'b1000000-0000-0000-0000-000000000002', engineer_id: 'e1000000-0000-0000-0000-000000000002', treasury_id: T_FINISHING_CASH, status: 'in_progress', contract_value: 95000, start_date: '2026-03-15', end_date: '2026-11-30', progress: 45, description: 'تشطيب سوبر ديلوكس، رخام إيطالي، إنارة سمارت وتدفئة مركزية' },
    { id: 'f2000000-0000-0000-0000-000000000003', name: 'مشروع تجهيز وتشطيب عيادة الشفاء التخصصية', project_type: 'finishing', client_id: 'b1000000-0000-0000-0000-000000000014', engineer_id: 'e1000000-0000-0000-0000-000000000003', treasury_id: T_FINISHING_CASH, status: 'in_progress', contract_value: 120000, start_date: '2025-11-01', end_date: '2026-07-31', progress: 80, description: 'تشطيبات طبية معقمة، أرضيات فينيل طبي، تكييف معقم HEPA وشبكة غازات' },
    { id: 'f2000000-0000-0000-0000-000000000004', name: 'مشروع تشطيب وتجهيز مطعم ومقهى الساحل السياحي', project_type: 'finishing', client_id: 'b1000000-0000-0000-0000-000000000012', engineer_id: 'e1000000-0000-0000-0000-000000000002', treasury_id: T_FINISHING_CASH, status: 'in_progress', contract_value: 80000, start_date: '2026-01-10', end_date: '2026-08-15', progress: 65, description: 'ديكورات خشبية راقية، واجهات زجاجية، مطابخ صناعية وإنارة هادئة' },
    { id: 'f2000000-0000-0000-0000-000000000005', name: 'مشروع تشطيب مكاتب شركة الأفق (3 طوابق)', project_type: 'finishing', client_id: 'b1000000-0000-0000-0000-000000000011', engineer_id: 'e1000000-0000-0000-0000-000000000003', treasury_id: T_FINISHING_CASH, status: 'completed', contract_value: 140000, start_date: '2025-08-01', end_date: '2026-03-31', progress: 100, description: 'قواطع زجاجية سيكوريت، شبكات بيانات، أسقف معلقة وأرضيات باركيه' },
    { id: 'f2000000-0000-0000-0000-000000000006', name: 'مشروع ديكورات صالة قصر المنتصر للمناسبات', project_type: 'finishing', client_id: 'b1000000-0000-0000-0000-000000000008', engineer_id: 'e1000000-0000-0000-0000-000000000002', treasury_id: T_FINISHING_CASH, status: 'in_progress', contract_value: 160000, start_date: '2026-03-01', end_date: '2026-12-15', progress: 50, description: 'ديكورات جبسية فاخرة، ثريات كريستال، صوتيات متطورة وأرضيات رخام إيطالي' },
    { id: 'f2000000-0000-0000-0000-000000000007', name: 'مشروع تشطيب معرض ومقر شركة البنيان', project_type: 'finishing', client_id: 'b1000000-0000-0000-0000-000000000002', engineer_id: 'e1000000-0000-0000-0000-000000000002', treasury_id: T_FINISHING_CASH, status: 'in_progress', contract_value: 70000, start_date: '2026-04-15', end_date: '2026-10-31', progress: 35, description: 'واجهات كارتن وول زجاجية، أرضيات إيبوكسي صناعية وإنارة سبوت لايت تجارية' }
  ];
  const { error: prErr } = await supabase.from('projects').upsert(projects);
  if (prErr) console.error('Projects error:', prErr);
  else console.log(`  ✓ Seeded ${projects.length} Projects`);

  // 8. PROJECT PHASES (113 PHASES)
  console.log('\n--- 8. SEEDING 113 PROJECT PHASES ---');
  const phases = [
    // Mosque (8)
    { id: '01000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 1: أعمال الحفر والتسوية وتجهيز الموقع العام', phase_order: 1, status: 'completed', start_date: '2026-01-01', end_date: '2026-01-20', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000002', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 2: خرسانة الأساسات والقواعد المسلحة والميد', phase_order: 2, status: 'completed', start_date: '2026-01-21', end_date: '2026-02-28', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000003', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 3: أعمدة صحن المسجد والمنارة والقبة الرئيسية', phase_order: 3, status: 'completed', start_date: '2026-03-01', end_date: '2026-04-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000004', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 4: بناء الجدران الخارجية والداخلية بالطوب الأسمنتي', phase_order: 4, status: 'in_progress', start_date: '2026-05-01', end_date: '2026-06-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000005', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 5: التمديدات الكهربائية والصوتيات وشبكة الإنارة', phase_order: 5, status: 'in_progress', start_date: '2026-05-15', end_date: '2026-07-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000006', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 6: أعمال اللياسة الأسمنتية والعزل الخارجي للقبة', phase_order: 6, status: 'pending', start_date: '2026-08-01', end_date: '2026-09-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000007', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 7: ميضأة المسجد ودورات المياه وشبكة الصرف', phase_order: 7, status: 'pending', start_date: '2026-09-15', end_date: '2026-10-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000008', project_id: 'f1000000-0000-0000-0000-000000000001', name: 'المرحلة 8: التشطيبات النهائية والفرش والافتتاح الرسمي', phase_order: 8, status: 'pending', start_date: '2026-11-01', end_date: '2026-11-30', treasury_id: T_CONTRACTING_CASH },

    // Qratem Villa (8)
    { id: '01000000-0000-0000-0000-000000000009', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 1: الحفر والإحلال وتسوية أرضية الفيلا', phase_order: 1, status: 'completed', start_date: '2026-02-15', end_date: '2026-03-05', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000010', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 2: خرسانة النظافة والقواعد المسلحة ورقاب الأعمدة', phase_order: 2, status: 'completed', start_date: '2026-03-06', end_date: '2026-04-10', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000011', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 3: أعمدة وسقف الدور الأرضي المسلح', phase_order: 3, status: 'in_progress', start_date: '2026-04-11', end_date: '2026-05-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000012', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 4: أعمدة وسقف الدور الأول والملحق', phase_order: 4, status: 'pending', start_date: '2026-06-01', end_date: '2026-07-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000013', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 5: مباني الطوب الأسمنتي والقواطع', phase_order: 5, status: 'pending', start_date: '2026-08-01', end_date: '2026-09-15', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000014', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 6: تمديدات الكهرباء والسباكة الإنشائية', phase_order: 6, status: 'pending', start_date: '2026-09-16', end_date: '2026-10-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000015', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 7: أعمال اللياسة الخارجية والأسوار', phase_order: 7, status: 'pending', start_date: '2026-11-01', end_date: '2026-12-10', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000016', project_id: 'f1000000-0000-0000-0000-000000000002', name: 'المرحلة 8: العزل النهائي والتسليم الابتدائي للهيكل العظم', phase_order: 8, status: 'pending', start_date: '2026-12-11', end_date: '2026-12-31', treasury_id: T_CONTRACTING_CASH },

    // Ashmila Building (7)
    { id: '01000000-0000-0000-0000-000000000017', project_id: 'f1000000-0000-0000-0000-000000000003', name: 'المرحلة 1: حفر الموقع وتجهيز التربة', phase_order: 1, status: 'completed', start_date: '2026-03-01', end_date: '2026-03-20', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000018', project_id: 'f1000000-0000-0000-0000-000000000003', name: 'المرحلة 2: خرسانة القواعد والميد والصب', phase_order: 2, status: 'completed', start_date: '2026-03-21', end_date: '2026-04-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000019', project_id: 'f1000000-0000-0000-0000-000000000003', name: 'المرحلة 3: أعمدة وسقف الطابق الأرضي', phase_order: 3, status: 'in_progress', start_date: '2026-05-01', end_date: '2026-06-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000020', project_id: 'f1000000-0000-0000-0000-000000000003', name: 'المرحلة 4: أعمدة وسقف الطابق الأول', phase_order: 4, status: 'pending', start_date: '2026-07-01', end_date: '2026-08-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000021', project_id: 'f1000000-0000-0000-0000-000000000003', name: 'المرحلة 5: مباني الطوب الأسمنتي', phase_order: 5, status: 'pending', start_date: '2026-09-01', end_date: '2026-10-15', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000022', project_id: 'f1000000-0000-0000-0000-000000000003', name: 'المرحلة 6: تمديدات البنية التحتية والأسوار', phase_order: 6, status: 'pending', start_date: '2026-10-16', end_date: '2026-11-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000023', project_id: 'f1000000-0000-0000-0000-000000000003', name: 'المرحلة 7: التسليم النهائي للهيكل', phase_order: 7, status: 'pending', start_date: '2026-12-01', end_date: '2027-01-15', treasury_id: T_CONTRACTING_CASH },

    // Ofok Commercial Building (8)
    { id: '01000000-0000-0000-0000-000000000024', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 1: حفر الأساسات العميقة ونزح المياه', phase_order: 1, status: 'completed', start_date: '2025-09-01', end_date: '2025-09-30', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000025', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 2: اللبشة الخرسانية المسلحة والبدروم', phase_order: 2, status: 'completed', start_date: '2025-10-01', end_date: '2025-11-30', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000026', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 3: الهيكل الخرساني للأدوار المتكررة (5 أدوار)', phase_order: 3, status: 'completed', start_date: '2025-12-01', end_date: '2026-03-31', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000027', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 4: مباني الطوب والتقسيمات المعمارية', phase_order: 4, status: 'completed', start_date: '2026-04-01', end_date: '2026-05-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000028', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 5: تأسيس الكهرباء والمصاعد وتكييف المبنى', phase_order: 5, status: 'in_progress', start_date: '2026-05-16', end_date: '2026-07-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000029', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 6: الواجهات الزجاجية الخارجية كارتن وول', phase_order: 6, status: 'in_progress', start_date: '2026-06-01', end_date: '2026-08-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000030', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 7: أعمال العزل المائي والحراري للسطح', phase_order: 7, status: 'pending', start_date: '2026-08-16', end_date: '2026-09-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000031', project_id: 'f1000000-0000-0000-0000-000000000004', name: 'المرحلة 8: التسليم النهائي للمشروع الإداري', phase_order: 8, status: 'pending', start_date: '2026-09-16', end_date: '2026-09-30', treasury_id: T_CONTRACTING_BANK },

    // Warehouse (6)
    { id: '01000000-0000-0000-0000-000000000056', project_id: 'f1000000-0000-0000-0000-000000000005', name: 'الحفر والتسوية ودك أرضيات التخزين', phase_order: 1, status: 'completed', start_date: '2026-02-01', end_date: '2026-02-25', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000057', project_id: 'f1000000-0000-0000-0000-000000000005', name: 'القواعد الخرسانية وأعمدة التثبيت', phase_order: 2, status: 'completed', start_date: '2026-02-26', end_date: '2026-04-10', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000058', project_id: 'f1000000-0000-0000-0000-000000000005', name: 'تركيب الهيكل المعدني والجمالونات', phase_order: 3, status: 'in_progress', start_date: '2026-04-11', end_date: '2026-05-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000059', project_id: 'f1000000-0000-0000-0000-000000000005', name: 'ألواح الساندوتش بانل والعزل الحراري', phase_order: 4, status: 'in_progress', start_date: '2026-06-01', end_date: '2026-07-15', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000060', project_id: 'f1000000-0000-0000-0000-000000000005', name: 'أرضيات خرسانية هليكوبتر عالية التحمل', phase_order: 5, status: 'pending', start_date: '2026-07-16', end_date: '2026-08-15', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000061', project_id: 'f1000000-0000-0000-0000-000000000005', name: 'أبواب الشحن والتشغيل التجريبي', phase_order: 6, status: 'pending', start_date: '2026-08-16', end_date: '2026-08-30', treasury_id: T_CONTRACTING_CASH },

    // Tarhouni Villa (7)
    { id: '01000000-0000-0000-0000-000000000062', project_id: 'f1000000-0000-0000-0000-000000000006', name: 'الحفر وتسوية الموقع والدمك', phase_order: 1, status: 'completed', start_date: '2026-04-01', end_date: '2026-04-20', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000063', project_id: 'f1000000-0000-0000-0000-000000000006', name: 'القواعد والأساسات ورقاب الأعمدة', phase_order: 2, status: 'in_progress', start_date: '2026-04-21', end_date: '2026-06-15', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000064', project_id: 'f1000000-0000-0000-0000-000000000006', name: 'أعمدة وسقف الدور الأرضي', phase_order: 3, status: 'pending', start_date: '2026-06-16', end_date: '2026-08-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000065', project_id: 'f1000000-0000-0000-0000-000000000006', name: 'أعمدة وسقف الدور الأول والملحق', phase_order: 4, status: 'pending', start_date: '2026-09-01', end_date: '2026-11-15', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000066', project_id: 'f1000000-0000-0000-0000-000000000006', name: 'مباني الطوب والأسوار والحديقة', phase_order: 5, status: 'pending', start_date: '2026-11-16', end_date: '2026-12-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000067', project_id: 'f1000000-0000-0000-0000-000000000006', name: 'السباكة والكهرباء التأسيسية', phase_order: 6, status: 'pending', start_date: '2027-01-01', end_date: '2027-02-28', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000068', project_id: 'f1000000-0000-0000-0000-000000000006', name: 'التسليم المبدئي لهيكل الفيلا', phase_order: 7, status: 'pending', start_date: '2027-03-01', end_date: '2027-03-31', treasury_id: T_CONTRACTING_CASH },

    // Sahel HQ (8)
    { id: '01000000-0000-0000-0000-000000000069', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'الحفر وتأمين الموقع والمباني المجاورة', phase_order: 1, status: 'completed', start_date: '2025-10-15', end_date: '2025-11-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000070', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'الأساسات والخرسانات الأرضية المسلحة', phase_order: 2, status: 'completed', start_date: '2025-11-16', end_date: '2026-01-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000071', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'الهيكل الإنشائي للطوابق الثلاثة', phase_order: 3, status: 'completed', start_date: '2026-01-16', end_date: '2026-03-31', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000072', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'مباني الطوب والقواطع الإدارية', phase_order: 4, status: 'completed', start_date: '2026-04-01', end_date: '2026-05-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000073', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'الشبكات المركزية والكهرباء والإنذار', phase_order: 5, status: 'in_progress', start_date: '2026-05-16', end_date: '2026-06-30', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000074', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'الواجهات الزجاجية والألمنيوم', phase_order: 6, status: 'in_progress', start_date: '2026-06-01', end_date: '2026-07-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000075', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'العوازل والتشطيبات الخارجية', phase_order: 7, status: 'pending', start_date: '2026-07-01', end_date: '2026-07-25', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000076', project_id: 'f1000000-0000-0000-0000-000000000007', name: 'التسليم الابتدائي للمقر', phase_order: 8, status: 'pending', start_date: '2026-07-26', end_date: '2026-07-31', treasury_id: T_CONTRACTING_BANK },

    // Namaa School (7)
    { id: '01000000-0000-0000-0000-000000000077', project_id: 'f1000000-0000-0000-0000-000000000008', name: 'الحفر والتجهيز الميداني وتسوية الساحات', phase_order: 1, status: 'completed', start_date: '2025-06-01', end_date: '2025-06-30', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000078', project_id: 'f1000000-0000-0000-0000-000000000008', name: 'الأساسات والقواعد واللبشات المسلحة', phase_order: 2, status: 'completed', start_date: '2025-07-01', end_date: '2025-09-15', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000079', project_id: 'f1000000-0000-0000-0000-000000000008', name: 'الهيكل الخرساني للأجنحة التعليمية (3 طوابق)', phase_order: 3, status: 'completed', start_date: '2025-09-16', end_date: '2025-12-31', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000080', project_id: 'f1000000-0000-0000-0000-000000000008', name: 'المباني والقواطع وتوزيع الفصول والمعامل', phase_order: 4, status: 'completed', start_date: '2026-01-01', end_date: '2026-02-28', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000081', project_id: 'f1000000-0000-0000-0000-000000000008', name: 'اللياسة والدهانات والأرضيات والكهرباء', phase_order: 5, status: 'completed', start_date: '2026-03-01', end_date: '2026-04-30', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000082', project_id: 'f1000000-0000-0000-0000-000000000008', name: 'الساحات والملاعب الرياضية والأسوار', phase_order: 6, status: 'completed', start_date: '2026-05-01', end_date: '2026-05-20', treasury_id: T_CONTRACTING_BANK },
    { id: '01000000-0000-0000-0000-000000000083', project_id: 'f1000000-0000-0000-0000-000000000008', name: 'الفحص النهائي والتسليم للافتتاح', phase_order: 7, status: 'completed', start_date: '2026-05-21', end_date: '2026-05-31', treasury_id: T_CONTRACTING_BANK },

    // Resort (6)
    { id: '01000000-0000-0000-0000-000000000084', project_id: 'f1000000-0000-0000-0000-000000000009', name: 'الحفر والتسوية وحفر حوض المسبح', phase_order: 1, status: 'completed', start_date: '2026-05-01', end_date: '2026-05-25', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000085', project_id: 'f1000000-0000-0000-0000-000000000009', name: 'خرسانة مسلحة لقواعد الاستراحة والمسبح', phase_order: 2, status: 'in_progress', start_date: '2026-05-26', end_date: '2026-07-15', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000086', project_id: 'f1000000-0000-0000-0000-000000000009', name: 'الأعمدة والأسقف الخرسانية للمبنى الرئيسي', phase_order: 3, status: 'pending', start_date: '2026-07-16', end_date: '2026-09-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000087', project_id: 'f1000000-0000-0000-0000-000000000009', name: 'أعمال المباني والعزل المائي للمسبح', phase_order: 4, status: 'pending', start_date: '2026-10-01', end_date: '2026-11-30', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000088', project_id: 'f1000000-0000-0000-0000-000000000009', name: 'الشبكات والري والكهرباء والإنارة الخارجية', phase_order: 5, status: 'pending', start_date: '2026-12-01', end_date: '2027-01-31', treasury_id: T_CONTRACTING_CASH },
    { id: '01000000-0000-0000-0000-000000000089', project_id: 'f1000000-0000-0000-0000-000000000009', name: 'التشطيبات والتسليم النهائي', phase_order: 6, status: 'pending', start_date: '2027-02-01', end_date: '2027-02-28', treasury_id: T_CONTRACTING_CASH },

    // Finishing: Ashmila Home (8)
    { id: '01000000-0000-0000-0000-000000000032', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'فحص الموقع واعتماد عينات المواد', phase_order: 1, status: 'completed', start_date: '2026-02-01', end_date: '2026-02-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000033', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'التعديلات الكهربائية وتأسيس الإضاءة السمارت', phase_order: 2, status: 'completed', start_date: '2026-02-16', end_date: '2026-03-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000034', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'تمديدات السباكة والصرف وتغذية المياه', phase_order: 3, status: 'completed', start_date: '2026-03-21', end_date: '2026-04-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000035', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'أعمال الجبس بورد والأسقف المعلقة', phase_order: 4, status: 'in_progress', start_date: '2026-04-21', end_date: '2026-06-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000036', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'تركيب الأرضيات والسيراميك والبورسلين', phase_order: 5, status: 'in_progress', start_date: '2026-05-15', end_date: '2026-07-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000037', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'أعمال الدهانات الداخلية والديكورات', phase_order: 6, status: 'pending', start_date: '2026-07-16', end_date: '2026-08-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000038', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'تركيب الأبواب والألمنيوم والزجاج', phase_order: 7, status: 'pending', start_date: '2026-09-01', end_date: '2026-09-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000039', project_id: 'f2000000-0000-0000-0000-000000000001', name: 'التنظيف الشامل والتسليم النهائي', phase_order: 8, status: 'pending', start_date: '2026-09-21', end_date: '2026-09-30', treasury_id: T_FINISHING_CASH },

    // Finishing: Qratem Villa (8)
    { id: '01000000-0000-0000-0000-000000000040', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'التجهيز واعتماد مخططات الديكور', phase_order: 1, status: 'completed', start_date: '2026-03-15', end_date: '2026-04-05', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000041', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'تأسيس الكهرباء والصوتيات والمراقبة', phase_order: 2, status: 'completed', start_date: '2026-04-06', end_date: '2026-05-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000042', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'تأسيس السباكة والتدفئة المركزية', phase_order: 3, status: 'in_progress', start_date: '2026-05-16', end_date: '2026-06-30', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000043', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'الأسقف والجبس بورد المعلق', phase_order: 4, status: 'in_progress', start_date: '2026-06-01', end_date: '2026-07-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000044', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'الأرضيات والرخام والكسوات الحائطية', phase_order: 5, status: 'pending', start_date: '2026-08-01', end_date: '2026-09-30', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000045', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'الدهانات الديكورية والورق الحائطي', phase_order: 6, status: 'pending', start_date: '2026-10-01', end_date: '2026-10-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000046', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'الأبواب الداخلية والألمنيوم والإكسسوارات', phase_order: 7, status: 'pending', start_date: '2026-11-01', end_date: '2026-11-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000047', project_id: 'f2000000-0000-0000-0000-000000000002', name: 'التشغيل التجريبي والتسليم', phase_order: 8, status: 'pending', start_date: '2026-11-21', end_date: '2026-11-30', treasury_id: T_FINISHING_CASH },

    // Finishing: Clinic (8)
    { id: '01000000-0000-0000-0000-000000000048', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'التجهيز ومطابقة الاشتراطات الصحية', phase_order: 1, status: 'completed', start_date: '2025-11-01', end_date: '2025-11-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000049', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'شبكات الكهرباء الطبية والغازات واليو بي إس', phase_order: 2, status: 'completed', start_date: '2025-11-21', end_date: '2026-01-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000050', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'السباكة والمصارف الطبية والتعقيم', phase_order: 3, status: 'completed', start_date: '2026-01-16', end_date: '2026-02-28', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000051', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'التكييف المعقم والفلاتر الهوائية HEPA', phase_order: 4, status: 'completed', start_date: '2026-03-01', end_date: '2026-04-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000052', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'أرضيات الفينيل الطبي والجدران المقاومة للبكتيريا', phase_order: 5, status: 'completed', start_date: '2026-04-16', end_date: '2026-05-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000053', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'الأسقف المستعارة والأبواب المصفحة بالأشعة', phase_order: 6, status: 'in_progress', start_date: '2026-06-01', end_date: '2026-06-30', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000054', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'الدهانات الطبية واللوحات الإرشادية', phase_order: 7, status: 'in_progress', start_date: '2026-07-01', end_date: '2026-07-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000055', project_id: 'f2000000-0000-0000-0000-000000000003', name: 'التعقيم النهائي والتسليم للافتتاح', phase_order: 8, status: 'pending', start_date: '2026-07-21', end_date: '2026-07-31', treasury_id: T_FINISHING_CASH },

    // Finishing: Sahel Restaurant (6)
    { id: '01000000-0000-0000-0000-000000000090', project_id: 'f2000000-0000-0000-0000-000000000004', name: 'التجهيز واعتماد التصاميم السياحية', phase_order: 1, status: 'completed', start_date: '2026-01-10', end_date: '2026-01-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000091', project_id: 'f2000000-0000-0000-0000-000000000004', name: 'تأسيس تكييف وشفاطات المطابخ الصناعية والغاز', phase_order: 2, status: 'completed', start_date: '2026-02-01', end_date: '2026-03-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000092', project_id: 'f2000000-0000-0000-0000-000000000004', name: 'أعمال السيراميك الصناعي والأسقف الديكورية', phase_order: 3, status: 'completed', start_date: '2026-03-21', end_date: '2026-05-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000093', project_id: 'f2000000-0000-0000-0000-000000000004', name: 'الديكورات الخشبية والإنارة المخفية والواجهات', phase_order: 4, status: 'in_progress', start_date: '2026-05-16', end_date: '2026-07-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000094', project_id: 'f2000000-0000-0000-0000-000000000004', name: 'تركيب معدات المطابخ والبار والفرش', phase_order: 5, status: 'pending', start_date: '2026-07-16', end_date: '2026-08-05', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000095', project_id: 'f2000000-0000-0000-0000-000000000004', name: 'التشغيل التجريبي والافتتاح الرسمي', phase_order: 6, status: 'pending', start_date: '2026-08-06', end_date: '2026-08-15', treasury_id: T_FINISHING_CASH },

    // Finishing: Ofok Offices (6)
    { id: '01000000-0000-0000-0000-000000000096', project_id: 'f2000000-0000-0000-0000-000000000005', name: 'التجهيز ومطابقة المخططات التنفيذية', phase_order: 1, status: 'completed', start_date: '2025-08-01', end_date: '2025-08-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000097', project_id: 'f2000000-0000-0000-0000-000000000005', name: 'تمديد شبكات الكهرباء والبيانات والسنترال', phase_order: 2, status: 'completed', start_date: '2025-08-21', end_date: '2025-10-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000098', project_id: 'f2000000-0000-0000-0000-000000000005', name: 'القواطع الزجاجية سيكوريت والأسقف المستعارة', phase_order: 3, status: 'completed', start_date: '2025-10-16', end_date: '2025-12-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000099', project_id: 'f2000000-0000-0000-0000-000000000005', name: 'أرضيات الفينيل والباركيه والدهانات الحريرية', phase_order: 4, status: 'completed', start_date: '2025-12-16', end_date: '2026-01-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000100', project_id: 'f2000000-0000-0000-0000-000000000005', name: 'تركيب وحدات الإنارة والمكيفات والأبواب الذكية', phase_order: 5, status: 'completed', start_date: '2026-02-01', end_date: '2026-03-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000101', project_id: 'f2000000-0000-0000-0000-000000000005', name: 'التنظيف والتسليم النهائي للمكاتب', phase_order: 6, status: 'completed', start_date: '2026-03-16', end_date: '2026-03-31', treasury_id: T_FINISHING_CASH },

    // Finishing: Grand Hall (6)
    { id: '01000000-0000-0000-0000-000000000102', project_id: 'f2000000-0000-0000-0000-000000000006', name: 'التجهيز واعتماد الثيمات الديكورية', phase_order: 1, status: 'completed', start_date: '2026-03-01', end_date: '2026-03-25', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000103', project_id: 'f2000000-0000-0000-0000-000000000006', name: 'تأسيس شبكات الصوتيات والإضاءة والمسارح', phase_order: 2, status: 'completed', start_date: '2026-03-26', end_date: '2026-05-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000104', project_id: 'f2000000-0000-0000-0000-000000000006', name: 'الهياكل المعلقة والأسقف الجبسية ثلاثية الأبعاد', phase_order: 3, status: 'in_progress', start_date: '2026-05-16', end_date: '2026-07-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000105', project_id: 'f2000000-0000-0000-0000-000000000006', name: 'الرخام الإيطالي للأرضيات والمداخل', phase_order: 4, status: 'pending', start_date: '2026-08-01', end_date: '2026-09-30', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000106', project_id: 'f2000000-0000-0000-0000-000000000006', name: 'الدهانات المخملية والثريات والكسوات', phase_order: 5, status: 'pending', start_date: '2026-10-01', end_date: '2026-11-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000107', project_id: 'f2000000-0000-0000-0000-000000000006', name: 'التسليم وتجربة أنظمة الحفلات', phase_order: 6, status: 'pending', start_date: '2026-11-21', end_date: '2026-12-15', treasury_id: T_FINISHING_CASH },

    // Finishing: Showroom (6)
    { id: '01000000-0000-0000-0000-000000000108', project_id: 'f2000000-0000-0000-0000-000000000007', name: 'التجهيز وإزالة الحواجز القائمة', phase_order: 1, status: 'completed', start_date: '2026-04-15', end_date: '2026-05-05', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000007', project_id: 'f2000000-0000-0000-0000-000000000007', name: 'تأسيس شبكة الكهرباء والسبوتات المعلقة', phase_order: 2, status: 'in_progress', start_date: '2026-05-06', end_date: '2026-06-20', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000110', project_id: 'f2000000-0000-0000-0000-000000000007', name: 'أرضيات إيبوكسي صناعية عالية التحمل', phase_order: 3, status: 'pending', start_date: '2026-06-21', end_date: '2026-07-31', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000111', project_id: 'f2000000-0000-0000-0000-000000000007', name: 'الواجهات الزجاجية الخارجية كارتن وول', phase_order: 4, status: 'pending', start_date: '2026-08-01', end_date: '2026-09-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000112', project_id: 'f2000000-0000-0000-0000-000000000007', name: 'الدهانات والديكورات وعلامات المعرض', phase_order: 5, status: 'pending', start_date: '2026-09-16', end_date: '2026-10-15', treasury_id: T_FINISHING_CASH },
    { id: '01000000-0000-0000-0000-000000000113', project_id: 'f2000000-0000-0000-0000-000000000007', name: 'التسليم والافتتاح', phase_order: 6, status: 'pending', start_date: '2026-10-16', end_date: '2026-10-31', treasury_id: T_FINISHING_CASH }
  ];

  // Batch insert phases
  const BATCH_SIZE = 40;
  for (let i = 0; i < phases.length; i += BATCH_SIZE) {
    const chunk = phases.slice(i, i + BATCH_SIZE);
    const { error: phErr } = await supabase.from('project_phases').upsert(chunk);
    if (phErr) console.error(`Phases batch ${i} error:`, phErr);
  }
  console.log(`  ✓ Seeded ${phases.length} Project Phases across all 16 projects`);

  // 9. CONTRACTING BOQ ITEMS
  console.log('\n--- 9. SEEDING CONTRACTING BOQ ITEMS (14) ---');
  const projectItems = [
    { id: '02000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000001', name: 'أعمال حفر وتسوية موقع المسجد', quantity: 800, unit_price: 18, total_price: 14400, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000002', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000002', name: 'خرسانة مسلحة للقواعد والميد عيار 350', quantity: 300, unit_price: 360, total_price: 108000, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000003', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000003', name: 'خرسانة مسلحة للأعمدة والقبة الرئيسية', quantity: 220, unit_price: 420, total_price: 92400, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000004', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000004', name: 'مباني طوب أسمنتي مفرغ 20 سم', quantity: 1500, unit_price: 32, total_price: 48000, measurement_type: 'م²', progress: 60 },
    { id: '02000000-0000-0000-0000-000000000005', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000005', name: 'تمديدات كهربائية وصوتيات المسجد', quantity: 1, unit_price: 35000, total_price: 35000, measurement_type: 'مقطوعية', progress: 40 },
    { id: '02000000-0000-0000-0000-000000000006', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000006', name: 'لياسة وعزل خارجي للمسجد والقبة', quantity: 1200, unit_price: 22, total_price: 26400, measurement_type: 'م²', progress: 0 },

    { id: '02000000-0000-0000-0000-000000000007', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000009', name: 'حفر وتسوية موقع الفيلا', quantity: 500, unit_price: 18, total_price: 9000, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000008', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000010', name: 'خرسانة مسلحة للقواعد ورقاب الأعمدة', quantity: 200, unit_price: 360, total_price: 72000, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000009', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000011', name: 'أعمدة وسقف الدور الأرضي', quantity: 180, unit_price: 400, total_price: 72000, measurement_type: 'م³', progress: 50 },
    { id: '02000000-0000-0000-0000-000000000010', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000013', name: 'مباني طوب أسمنتي 20 سم', quantity: 1000, unit_price: 32, total_price: 32000, measurement_type: 'م²', progress: 0 },

    { id: '02000000-0000-0000-0000-000000000011', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000024', name: 'حفر الأساسات واللبشة', quantity: 2000, unit_price: 18, total_price: 36000, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000012', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000025', name: 'خرسانة مسلحة للبشة وجدران البدروم', quantity: 600, unit_price: 370, total_price: 222000, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000013', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000026', name: 'الهيكل الخرساني للأدوار الخمسة', quantity: 500, unit_price: 410, total_price: 205000, measurement_type: 'م³', progress: 100 },
    { id: '02000000-0000-0000-0000-000000000014', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000027', name: 'مباني الطوب الأسمنتي والقواطع', quantity: 3000, unit_price: 30, total_price: 90000, measurement_type: 'م²', progress: 80 }
  ];
  const { error: itErr } = await supabase.from('project_items').upsert(projectItems);
  if (itErr) console.error('Project items error:', itErr);
  else console.log(`  ✓ Seeded ${projectItems.length} Contracting BOQ Items`);

  // 10. CONTRACTS
  console.log('\n--- 10. SEEDING CONTRACTS (12) ---');
  const contracts = [
    { id: '03000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', client_id: 'b1000000-0000-0000-0000-000000000001', title: 'عقد تنفيذ أعمال إنشاء مسجد الرحمة', contract_number: 'CNT-2026-001', amount: 320000, status: 'active', start_date: '2026-01-01', end_date: '2026-11-30' },
    { id: '03000000-0000-0000-0000-000000000002', project_id: 'f1000000-0000-0000-0000-000000000002', client_id: 'b1000000-0000-0000-0000-000000000002', title: 'عقد بناء عظم فيلا عبدالملك قراطم', contract_number: 'CNT-2026-002', amount: 240000, status: 'active', start_date: '2026-02-15', end_date: '2026-12-31' },
    { id: '03000000-0000-0000-0000-000000000003', project_id: 'f1000000-0000-0000-0000-000000000003', client_id: 'b1000000-0000-0000-0000-000000000001', title: 'عقد بناء عظم منزل اشميلة', contract_number: 'CNT-2026-003', amount: 180000, status: 'active', start_date: '2026-03-01', end_date: '2027-01-15' },
    { id: '03000000-0000-0000-0000-000000000004', project_id: 'f1000000-0000-0000-0000-000000000004', client_id: 'b1000000-0000-0000-0000-000000000011', title: 'عقد تنفيذ عمارة الأفق الإدارية', contract_number: 'CNT-2025-001', amount: 850000, status: 'active', start_date: '2025-09-01', end_date: '2026-09-30' },
    { id: '03000000-0000-0000-0000-000000000005', project_id: 'f1000000-0000-0000-0000-000000000005', client_id: 'b1000000-0000-0000-0000-000000000004', title: 'عقد إنشاء مستودع التبريد المركزي', contract_number: 'CNT-2026-004', amount: 210000, status: 'active', start_date: '2026-02-01', end_date: '2026-08-30' },
    { id: '03000000-0000-0000-0000-000000000006', project_id: 'f1000000-0000-0000-0000-000000000006', client_id: 'b1000000-0000-0000-0000-000000000005', title: 'عقد تنفيذ فيلا الطرهوني', contract_number: 'CNT-2026-005', amount: 260000, status: 'active', start_date: '2026-04-01', end_date: '2027-03-31' },
    { id: '03000000-0000-0000-0000-000000000007', project_id: 'f1000000-0000-0000-0000-000000000007', client_id: 'b1000000-0000-0000-0000-000000000003', title: 'عقد مقر شركة الساحل الرئيسي', contract_number: 'CNT-2025-002', amount: 450000, status: 'active', start_date: '2025-10-15', end_date: '2026-07-31' },
    { id: '03000000-0000-0000-0000-000000000008', project_id: 'f1000000-0000-0000-0000-000000000008', client_id: 'b1000000-0000-0000-0000-000000000013', title: 'عقد تشييد مدرسة النماء الخاصة', contract_number: 'CNT-2025-003', amount: 750000, status: 'completed', start_date: '2025-06-01', end_date: '2026-05-31' },
    { id: '03000000-0000-0000-0000-000000000009', project_id: 'f1000000-0000-0000-0000-000000000009', client_id: 'b1000000-0000-0000-0000-000000000012', title: 'عقد استراحة الكعام', contract_number: 'CNT-2026-006', amount: 150000, status: 'active', start_date: '2026-05-01', end_date: '2027-02-28' },
    { id: '03000000-0000-0000-0000-000000000010', project_id: 'f2000000-0000-0000-0000-000000000001', client_id: 'b1000000-0000-0000-0000-000000000001', title: 'عقد تشطيبات منزل اشميلة', contract_number: 'CNT-2026-007', amount: 65000, status: 'active', start_date: '2026-02-01', end_date: '2026-09-30' },
    { id: '03000000-0000-0000-0000-000000000011', project_id: 'f2000000-0000-0000-0000-000000000002', client_id: 'b1000000-0000-0000-0000-000000000002', title: 'عقد تشطيب فيلا قراطم', contract_number: 'CNT-2026-008', amount: 95000, status: 'active', start_date: '2026-03-15', end_date: '2026-11-30' },
    { id: '03000000-0000-0000-0000-000000000012', project_id: 'f2000000-0000-0000-0000-000000000003', client_id: 'b1000000-0000-0000-0000-000000000014', title: 'عقد تجهيز عيادة الشفاء الطبية', contract_number: 'CNT-2025-004', amount: 120000, status: 'active', start_date: '2025-11-01', end_date: '2026-07-20' }
  ];
  const { error: cntErr } = await supabase.from('contracts').upsert(contracts);
  if (cntErr) console.error('Contracts error:', cntErr);
  else console.log(`  ✓ Seeded ${contracts.length} Contracts`);

  // 11. PURCHASES (16)
  console.log('\n--- 11. SEEDING PURCHASES (16) ---');
  const purchases = [
    { id: '04000000-0000-0000-0000-000000000001', supplier_id: 'c1000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000002', project_item_id: '02000000-0000-0000-0000-000000000002', title: 'توريد 400 كيس إسمنت للمسجد', total_amount: 16000, paid_amount: 16000, status: 'paid', date: '2026-01-25', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'فاتورة نقدية مسددة بالكامل' },
    { id: '04000000-0000-0000-0000-000000000002', supplier_id: 'c1000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000002', project_item_id: '02000000-0000-0000-0000-000000000002', title: 'توريد 6 طن حديد تسليح 16 مم للقواعد', total_amount: 27000, paid_amount: 16000, status: 'partially_paid', date: '2026-02-10', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'سداد جزئي ومتبقي 11,000 د.ل' },
    { id: '04000000-0000-0000-0000-000000000003', supplier_id: 'c1000000-0000-0000-0000-000000000010', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000004', project_item_id: '02000000-0000-0000-0000-000000000004', title: 'توريد 2500 طوبة أسمنتية 20 سم للمسجد', total_amount: 8000, paid_amount: 8000, status: 'paid', date: '2026-05-05', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد بالكامل مصرفي' },
    { id: '04000000-0000-0000-0000-000000000004', supplier_id: 'c1000000-0000-0000-0000-000000000003', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000004', project_item_id: '02000000-0000-0000-0000-000000000004', title: 'توريد 4 شاحنات رمل و2 شاحنات ركام', total_amount: 4500, paid_amount: 4500, status: 'paid', date: '2026-05-10', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد نقداً' },
    { id: '04000000-0000-0000-0000-000000000005', supplier_id: 'c1000000-0000-0000-0000-000000000002', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000010', project_item_id: '02000000-0000-0000-0000-000000000008', title: 'توريد 4 طن حديد 12 مم و14 مم لقواعد فيلا قراطم', total_amount: 19000, paid_amount: 19000, status: 'paid', date: '2026-03-10', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد بالكامل' },
    { id: '04000000-0000-0000-0000-000000000006', supplier_id: 'c1000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000010', project_item_id: '02000000-0000-0000-0000-000000000008', title: 'توريد إسمنت مقاوم للأملاح 250 كيس', total_amount: 10500, paid_amount: 5000, status: 'partially_paid', date: '2026-03-20', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'متبقي 5,500 د.ل' },
    { id: '04000000-0000-0000-0000-000000000007', supplier_id: 'c1000000-0000-0000-0000-000000000002', project_id: 'f1000000-0000-0000-0000-000000000003', phase_id: '01000000-0000-0000-0000-000000000018', project_item_id: null, title: 'توريد حديد تسليح 16 مم لقواعد منزل اشميلة', total_amount: 14000, paid_amount: 0, status: 'due', date: '2026-04-05', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'فاتورة آجلة بالكامل (غير مسددة)' },
    { id: '04000000-0000-0000-0000-000000000008', supplier_id: 'c1000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000025', project_item_id: '02000000-0000-0000-0000-000000000012', title: 'توريد خرسانة جاهزة 120 م³ للبشة', total_amount: 44000, paid_amount: 44000, status: 'paid', date: '2025-10-10', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد تحويل مصرفي' },
    { id: '04000000-0000-0000-0000-000000000009', supplier_id: 'c1000000-0000-0000-0000-000000000005', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000028', project_item_id: null, title: 'توريد كابلات كهربائية وقواطع رئيسية لعمارة الأفق', total_amount: 18500, paid_amount: 10000, status: 'partially_paid', date: '2026-06-10', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد 10,000 ومتبقي 8,500 د.ل' },
    { id: '04000000-0000-0000-0000-000000000010', supplier_id: 'c1000000-0000-0000-0000-000000000004', project_id: 'f2000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000036', project_item_id: null, title: 'توريد سيراميك وبورسلين إسباني لمنزل اشميلة', total_amount: 18000, paid_amount: 12000, status: 'partially_paid', date: '2026-04-10', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد 12k ومتبقي 6k د.ل' },
    { id: '04000000-0000-0000-0000-000000000011', supplier_id: 'c1000000-0000-0000-0000-000000000008', project_id: 'f2000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000035', project_item_id: null, title: 'توريد ألواح جبس بورد كناوف ومعاجين وشبك', total_amount: 6500, paid_amount: 6500, status: 'paid', date: '2026-05-02', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد نقداً' },
    { id: '04000000-0000-0000-0000-000000000012', supplier_id: 'c1000000-0000-0000-0000-000000000005', project_id: 'f2000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000033', project_item_id: null, title: 'توريد سبوتات وليدات ومفاتيح باناسونيك', total_amount: 4200, paid_amount: 4200, status: 'paid', date: '2026-03-10', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد نقداً' },
    { id: '04000000-0000-0000-0000-000000000013', supplier_id: 'c1000000-0000-0000-0000-000000000006', project_id: 'f2000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000042', project_item_id: null, title: 'توريد مواسير PPR حرارية وخلاطات غروهي', total_amount: 8500, paid_amount: 8500, status: 'paid', date: '2026-05-20', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد نقداً' },
    { id: '04000000-0000-0000-0000-000000000014', supplier_id: 'c1000000-0000-0000-0000-000000000007', project_id: 'f2000000-0000-0000-0000-000000000002', phase_id: null, project_item_id: null, title: 'توريد شبابيك ألمنيوم دبل جلاس سيكوريت', total_amount: 16000, paid_amount: 8000, status: 'partially_paid', date: '2026-06-05', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد 8,000 ومتبقي 8,000 د.ل' },
    { id: '04000000-0000-0000-0000-000000000015', supplier_id: 'c1000000-0000-0000-0000-000000000012', project_id: 'f2000000-0000-0000-0000-000000000003', phase_id: '01000000-0000-0000-0000-000000000051', project_item_id: null, title: 'توريد وتركيب وحدات تكييف مركزي وفلاتر HEPA', total_amount: 32000, paid_amount: 32000, status: 'paid', date: '2026-03-15', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'مسدد نقداً' },
    { id: '04000000-0000-0000-0000-000000000016', supplier_id: 'c1000000-0000-0000-0000-000000000008', project_id: 'f2000000-0000-0000-0000-000000000003', phase_id: '01000000-0000-0000-0000-000000000054', project_item_id: null, title: 'توريد دهانات طبية معتمدة مضادة للبكتيريا', total_amount: 7500, paid_amount: 0, status: 'due', date: '2026-06-15', purchase_type: 'material', commission: 0, purchase_source: 'project', is_return: false, notes: 'آجل بالكامل لمؤسسة الوفاق' }
  ];
  const { error: purErr } = await supabase.from('purchases').upsert(purchases);
  if (purErr) console.error('Purchases error:', purErr);
  else console.log(`  ✓ Seeded ${purchases.length} Purchases`);

  // 12. PURCHASE PAYMENTS
  console.log('\n--- 12. SEEDING PURCHASE PAYMENTS (14) ---');
  const purchasePayments = [
    { id: '05000000-0000-0000-0000-000000000001', purchase_id: '04000000-0000-0000-0000-000000000001', amount: 16000, date: '2026-01-25', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH, notes: 'سداد نقدي لإسمنت المسجد — مؤسسة الوارد' },
    { id: '05000000-0000-0000-0000-000000000002', purchase_id: '04000000-0000-0000-0000-000000000002', amount: 16000, date: '2026-02-15', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'سداد مصرفي جزئي لحديد المسجد — مؤسسة الوارد' },
    { id: '05000000-0000-0000-0000-000000000003', purchase_id: '04000000-0000-0000-0000-000000000003', amount: 8000, date: '2026-05-05', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'سداد فاتورة بلوك المسجد — مصنع زليتن للبلوك' },
    { id: '05000000-0000-0000-0000-000000000004', purchase_id: '04000000-0000-0000-0000-000000000004', amount: 4500, date: '2026-05-10', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH, notes: 'سداد نقدي لرمل وركام المسجد — مخزن الساحل' },
    { id: '05000000-0000-0000-0000-000000000005', purchase_id: '04000000-0000-0000-0000-000000000005', amount: 19000, date: '2026-03-10', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'سداد حديد فيلا قراطم — شركة البنيان' },
    { id: '05000000-0000-0000-0000-000000000006', purchase_id: '04000000-0000-0000-0000-000000000006', amount: 5000, date: '2026-03-25', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH, notes: 'دفعة نقدية لإسمنت فيلا قراطم — مؤسسة الوارد' },
    { id: '05000000-0000-0000-0000-000000000008', purchase_id: '04000000-0000-0000-0000-000000000008', amount: 44000, date: '2025-10-10', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'سداد خرسانة لبشة عمارة الأفق — مؤسسة الوارد' },
    { id: '05000000-0000-0000-0000-000000000009', purchase_id: '04000000-0000-0000-0000-000000000009', amount: 10000, date: '2026-06-15', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'دفعة كابلات عمارة الأفق — مؤسسة النخبة' },
    { id: '05000000-0000-0000-0000-000000000010', purchase_id: '04000000-0000-0000-0000-000000000010', amount: 12000, date: '2026-04-15', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'سداد سيراميك تشطيب اشميلة — زليتن للرخام' },
    { id: '05000000-0000-0000-0000-000000000011', purchase_id: '04000000-0000-0000-0000-000000000011', amount: 6500, date: '2026-05-02', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'سداد جبس بورد تشطيب اشميلة — الوفاق للدهانات' },
    { id: '05000000-0000-0000-0000-000000000012', purchase_id: '04000000-0000-0000-0000-000000000012', amount: 4200, date: '2026-03-10', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'سداد أدوات كهربائية تشطيب اشميلة — النخبة' },
    { id: '05000000-0000-0000-0000-000000000013', purchase_id: '04000000-0000-0000-0000-000000000013', amount: 8500, date: '2026-05-20', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'سداد أدوات صحية تشطيب قراطم — شركة الأمان' },
    { id: '05000000-0000-0000-0000-000000000014', purchase_id: '04000000-0000-0000-0000-000000000014', amount: 8000, date: '2026-06-10', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'دفعة ألمنيوم تشطيب قراطم — مؤسسة الإعمار' },
    { id: '05000000-0000-0000-0000-000000000015', purchase_id: '04000000-0000-0000-0000-000000000015', amount: 32000, date: '2026-03-20', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'سداد تكييف عيادة الشفاء — مؤسسة الدقة للتكييف' }
  ];
  const { error: ppErr } = await supabase.from('purchase_payments').upsert(purchasePayments);
  if (ppErr) console.error('Purchase payments error:', ppErr);
  else console.log(`  ✓ Seeded ${purchasePayments.length} Purchase Payments`);

  // 13. TECHNICIAN PROGRESS RECORDS
  console.log('\n--- 13. SEEDING TECHNICIAN PROGRESS RECORDS (9) ---');
  const techRecords = [
    { id: '06000000-0000-0000-0000-000000000001', technician_id: 'd1000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000005', project_item_id: '02000000-0000-0000-0000-000000000005', quantity_completed: 1, rate: 4500, earned_amount: 4500, date: '2026-05-15', notes: 'تأسيس شبكة كهرباء المسجد والقبة والمنارة' },
    { id: '06000000-0000-0000-0000-000000000002', technician_id: 'd1000000-0000-0000-0000-000000000006', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000004', project_item_id: '02000000-0000-0000-0000-000000000004', quantity_completed: 1500, rate: 4, earned_amount: 6000, date: '2026-05-20', notes: 'بناء جدران الطوب الأسمنتي 20 سم للمسجد' },
    { id: '06000000-0000-0000-0000-000000000003', technician_id: 'd1000000-0000-0000-0000-000000000004', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000010', project_item_id: '02000000-0000-0000-0000-000000000008', quantity_completed: 1, rate: 5500, earned_amount: 5500, date: '2026-03-25', notes: 'نجارة مسلحة لقواعد وميدات فيلا قراطم' },
    { id: '06000000-0000-0000-0000-000000000004', technician_id: 'd1000000-0000-0000-0000-000000000009', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000010', project_item_id: '02000000-0000-0000-0000-000000000008', quantity_completed: 1, rate: 4000, earned_amount: 4000, date: '2026-03-28', notes: 'حدادة تسليح وقص وتركيب لقواعد فيلا قراطم' },
    { id: '06000000-0000-0000-0000-000000000005', technician_id: 'd1000000-0000-0000-0000-000000000004', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000026', project_item_id: '02000000-0000-0000-0000-000000000013', quantity_completed: 1, rate: 12000, earned_amount: 12000, date: '2026-02-15', notes: 'نجارة مسلحة لأعمدة وأسقف عمارة الأفق' },
    { id: '06000000-0000-0000-0000-000000000006', technician_id: 'd1000000-0000-0000-0000-000000000011', project_id: 'f2000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000035', project_item_id: null, quantity_completed: 1, rate: 5500, earned_amount: 5500, date: '2026-05-15', notes: 'أعمال ديكورات وأسقف جبس بورد معلقة لمنزل اشميلة' },
    { id: '06000000-0000-0000-0000-000000000007', technician_id: 'd1000000-0000-0000-0000-000000000002', project_id: 'f2000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000036', project_item_id: null, quantity_completed: 1, rate: 3800, earned_amount: 3800, date: '2026-05-25', notes: 'تركيب سيراميك أرضيات وبورسلين حمامات ومطابخ اشميلة' },
    { id: '06000000-0000-0000-0000-000000000008', technician_id: 'd1000000-0000-0000-0000-000000000012', project_id: 'f2000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000041', project_item_id: null, quantity_completed: 1, rate: 4200, earned_amount: 4200, date: '2026-04-25', notes: 'تأسيس شبكة إنارة سمارت وتحكم ذكي بفيلا قراطم' },
    { id: '06000000-0000-0000-0000-000000000009', technician_id: 'd1000000-0000-0000-0000-000000000013', project_id: 'f2000000-0000-0000-0000-000000000003', phase_id: '01000000-0000-0000-0000-000000000051', project_item_id: null, quantity_completed: 1, rate: 6000, earned_amount: 6000, date: '2026-03-30', notes: 'تركيب دكتات وشبكة تكييف مركزي لعيادة الشفاء' }
  ];
  const { error: trErr } = await supabase.from('technician_progress_records').upsert(techRecords);
  if (trErr) console.error('Tech records error:', trErr);
  else console.log(`  ✓ Seeded ${techRecords.length} Technician Progress Records`);

  // 14. EXPENSES (16)
  console.log('\n--- 14. SEEDING EXPENSES (16) ---');
  const expenses = [
    { id: '07000000-0000-0000-0000-000000000001', type: 'labor', description: 'دفعة حساب كهربائي المسجد: أحمد مصطفى', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000005', technician_id: 'd1000000-0000-0000-0000-000000000001', amount: 3000, date: '2026-05-18', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000002', type: 'labor', description: 'سداد مستحقات بناء المسجد: محمد آدم عثمان', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000004', technician_id: 'd1000000-0000-0000-0000-000000000006', amount: 6000, date: '2026-05-22', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000003', type: 'labor', description: 'دفعة حساب نجار مسلح: سامح جلال (فيلا قراطم)', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000010', technician_id: 'd1000000-0000-0000-0000-000000000004', amount: 3500, date: '2026-04-01', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000004', type: 'labor', description: 'سداد حداد تسليح: عثمان موسى (فيلا قراطم)', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000010', technician_id: 'd1000000-0000-0000-0000-000000000009', amount: 4000, date: '2026-04-05', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000005', type: 'labor', description: 'دفعة حساب فني جبس بورد: خالد العلي (تشطيب اشميلة)', project_id: 'f2000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000035', technician_id: 'd1000000-0000-0000-0000-000000000011', amount: 3500, date: '2026-05-18', payment_method: 'cash', treasury_id: T_FINISHING_CASH },
    { id: '07000000-0000-0000-0000-000000000006', type: 'labor', description: 'سداد فني تكييف مركزي: بشار الدالاتي (عيادة الشفاء)', project_id: 'f2000000-0000-0000-0000-000000000003', phase_id: '01000000-0000-0000-0000-000000000051', technician_id: 'd1000000-0000-0000-0000-000000000013', amount: 6000, date: '2026-04-05', payment_method: 'cash', treasury_id: T_FINISHING_CASH },
    { id: '07000000-0000-0000-0000-000000000007', type: 'project', description: 'نقل مواد وتفريغ وتشوين بموقع مسجد الرحمة', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000001', technician_id: null, amount: 1200, date: '2026-01-20', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000008', type: 'project', description: 'فحص واختبار مكعبات الخرسانة مخبرياً للمسجد', project_id: 'f1000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000002', technician_id: null, amount: 800, date: '2026-02-15', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000009', type: 'project', description: 'وقود وتشغيل مضخات تفريغ مياه لموقع فيلا قراطم', project_id: 'f1000000-0000-0000-0000-000000000002', phase_id: '01000000-0000-0000-0000-000000000009', technician_id: null, amount: 650, date: '2026-03-01', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000010', type: 'project', description: 'رسوم بلدية وتراخيص موقع عمارة الأفق', project_id: 'f1000000-0000-0000-0000-000000000004', phase_id: '01000000-0000-0000-0000-000000000024', technician_id: null, amount: 2500, date: '2025-09-05', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK },
    { id: '07000000-0000-0000-0000-000000000011', type: 'project', description: 'نقل مخلفات تشطيب وتجهيز موقع منزل اشميلة', project_id: 'f2000000-0000-0000-0000-000000000001', phase_id: '01000000-0000-0000-0000-000000000032', technician_id: null, amount: 850, date: '2026-02-10', payment_method: 'cash', treasury_id: T_FINISHING_CASH },
    { id: '07000000-0000-0000-0000-000000000012', type: 'general', description: 'إيجار المقر الإداري للشركة (الربع الأول 2026)', project_id: null, phase_id: null, technician_id: null, amount: 4500, date: '2026-01-05', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK },
    { id: '07000000-0000-0000-0000-000000000013', type: 'general', description: 'اشتراك إنترنت فايبر واتصالات الإدارة', project_id: null, phase_id: null, technician_id: null, amount: 400, date: '2026-01-10', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000014', type: 'general', description: 'مستلزمات مكتبية وقرطاسية ومطبوعات هندسية', project_id: null, phase_id: null, technician_id: null, amount: 350, date: '2026-02-01', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000015', type: 'general', description: 'صيانة دورية وتأمين سيارة إدارة المشاريع', project_id: null, phase_id: null, technician_id: null, amount: 750, date: '2026-03-05', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH },
    { id: '07000000-0000-0000-0000-000000000016', type: 'general', description: 'ضيافة واستقبال عملاء الشركة', project_id: null, phase_id: null, technician_id: null, amount: 250, date: '2026-04-10', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH }
  ];
  const { error: expErr } = await supabase.from('expenses').upsert(expenses);
  if (expErr) console.error('Expenses error:', expErr);
  else console.log(`  ✓ Seeded ${expenses.length} Expenses`);

  // 15. EQUIPMENT & RENTALS
  console.log('\n--- 15. SEEDING EQUIPMENT & RENTALS ---');
  const equipment = [
    { id: '08000000-0000-0000-0000-000000000001', name: 'خلاطة خرسانة متنقلة 500 لتر', category: 'معدات خرسانة', description: 'Lister 2024', serial_number: 'MIX-ZL-01', daily_rental_rate: 120, current_condition: 'good', total_quantity: 1, available_quantity: 0 },
    { id: '08000000-0000-0000-0000-000000000002', name: 'هزاز خرسانة ميكانيكي مع إبرة 50 مم', category: 'معدات خرسانة', description: 'Wacker 2023', serial_number: 'VIB-ZL-02', daily_rental_rate: 40, current_condition: 'good', total_quantity: 1, available_quantity: 0 },
    { id: '08000000-0000-0000-0000-000000000003', name: 'مولد كهرباء ديزل كاتم 50 ك.ف.أ', category: 'طاقة ومولدات', description: 'Perkins 2025', serial_number: 'GEN-ZL-03', daily_rental_rate: 250, current_condition: 'excellent', total_quantity: 1, available_quantity: 0 },
    { id: '08000000-0000-0000-0000-000000000004', name: 'سقالة معدنية متكاملة 500 م²', category: 'سقالات وشدات', description: 'Aluma Frame', serial_number: 'SCAF-ZL-04', daily_rental_rate: 150, current_condition: 'good', total_quantity: 1, available_quantity: 0 },
    { id: '08000000-0000-0000-0000-000000000005', name: 'كمبروسر هواء وهدم ثقيل', category: 'معدات هدم', description: 'Atlas Copco', serial_number: 'COMP-ZL-05', daily_rental_rate: 180, current_condition: 'good', total_quantity: 1, available_quantity: 1 },
    { id: '08000000-0000-0000-0000-000000000006', name: 'ماكينة قص سيراميك ورخام مائية', category: 'معدات تشطيبات', description: 'Rubi DX-350', serial_number: 'CUT-ZL-06', daily_rental_rate: 70, current_condition: 'good', total_quantity: 1, available_quantity: 1 },
    { id: '08000000-0000-0000-0000-000000000007', name: 'دريل تكسير وهيلتي هيفي ديوتي', category: 'معدات حفر', description: 'Bosch GSH 16', serial_number: 'DRL-ZL-07', daily_rental_rate: 50, current_condition: 'good', total_quantity: 1, available_quantity: 1 },
    { id: '08000000-0000-0000-0000-000000000008', name: 'سيارة نقل وتشوين موقع (بيك آب)', category: 'مركبات نقل', description: 'Toyota Hilux 2023', serial_number: 'TRK-ZL-08', daily_rental_rate: 120, current_condition: 'excellent', total_quantity: 1, available_quantity: 1 }
  ];
  await supabase.from('equipment').upsert(equipment);

  const rentals = [
    { id: '09000000-0000-0000-0000-000000000001', equipment_id: '08000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', start_date: '2026-01-20', end_date: '2026-03-31', daily_rate: 120, total_amount: 8400, status: 'active', notes: 'تأجير خلاطة موقع لصب خرسانة مسجد الرحمة' },
    { id: '09000000-0000-0000-0000-000000000003', equipment_id: '08000000-0000-0000-0000-000000000003', project_id: 'f1000000-0000-0000-0000-000000000001', start_date: '2026-01-15', end_date: '2026-04-15', daily_rate: 250, total_amount: 22500, status: 'active', notes: 'تأجير مولد كهرباء كاتم للصوت لموقع المسجد' },
    { id: '09000000-0000-0000-0000-000000000004', equipment_id: '08000000-0000-0000-0000-000000000004', project_id: 'f1000000-0000-0000-0000-000000000004', start_date: '2025-11-01', end_date: '2026-05-31', daily_rate: 150, total_amount: 31500, status: 'active', notes: 'سقالات للواجهات الخارجية لعمارة الأفق' },
    { id: '09000000-0000-0000-0000-000000000002', equipment_id: '08000000-0000-0000-0000-000000000002', project_id: 'f1000000-0000-0000-0000-000000000002', start_date: '2026-03-05', end_date: '2026-04-10', daily_rate: 40, total_amount: 1440, status: 'completed', notes: 'تأجير هزاز خرسانة لصب قواعد فيلا قراطم' }
  ];
  await supabase.from('equipment_rentals').upsert(rentals);
  console.log(`  ✓ Seeded 8 Equipment and 4 Equipment Rentals`);

  // 16. CLIENT PAYMENTS (12)
  console.log('\n--- 16. SEEDING CLIENT PAYMENTS (12) ---');
  const clientPayments = [
    { id: '0a000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', client_id: 'b1000000-0000-0000-0000-000000000001', amount: 60000, date: '2026-01-10', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'دفعة أولى لمسجد الرحمة — تحويل مصرفي' },
    { id: '0a000000-0000-0000-0000-000000000002', project_id: 'f1000000-0000-0000-0000-000000000001', client_id: 'b1000000-0000-0000-0000-000000000001', amount: 75000, date: '2026-03-15', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'دفعة إنجاز مرحلة القواعد والهيكل للمسجد' },
    { id: '0a000000-0000-0000-0000-000000000003', project_id: 'f1000000-0000-0000-0000-000000000002', client_id: 'b1000000-0000-0000-0000-000000000002', amount: 50000, date: '2026-02-20', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH, notes: 'دفعة مقدمة نقدية لعقد فيلا قراطم' },
    { id: '0a000000-0000-0000-0000-000000000004', project_id: 'f1000000-0000-0000-0000-000000000002', client_id: 'b1000000-0000-0000-0000-000000000002', amount: 40000, date: '2026-04-15', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH, notes: 'دفعة إنجاز صب القواعد والأعمدة فيلا قراطم' },
    { id: '0a000000-0000-0000-0000-000000000005', project_id: 'f1000000-0000-0000-0000-000000000003', client_id: 'b1000000-0000-0000-0000-000000000001', amount: 40000, date: '2026-03-05', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH, notes: 'دفعة أولى لعقد إنشاء منزل اشميلة' },
    { id: '0a000000-0000-0000-0000-000000000006', project_id: 'f1000000-0000-0000-0000-000000000003', client_id: 'b1000000-0000-0000-0000-000000000001', amount: 35000, date: '2026-04-20', payment_method: 'cash', treasury_id: T_CONTRACTING_CASH, notes: 'سند قبض متضمن فائض رصيد 5,000 د.ل' },
    { id: '0a000000-0000-0000-0000-000000000007', project_id: 'f1000000-0000-0000-0000-000000000004', client_id: 'b1000000-0000-0000-0000-000000000011', amount: 120000, date: '2025-09-15', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'دفعة تعاقد عمارة الأفق — مصرفي' },
    { id: '0a000000-0000-0000-0000-000000000008', project_id: 'f1000000-0000-0000-0000-000000000004', client_id: 'b1000000-0000-0000-0000-000000000011', amount: 150000, date: '2026-01-20', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'دفعة إنجاز اللبشة والهيكل الإنشائي عمارة الأفق' },
    { id: '0a000000-0000-0000-0000-000000000009', project_id: 'f1000000-0000-0000-0000-000000000008', client_id: 'b1000000-0000-0000-0000-000000000013', amount: 200000, date: '2025-07-01', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'دفعة أولى عقد مدرسة النماء' },
    { id: '0a000000-0000-0000-0000-000000000010', project_id: 'f1000000-0000-0000-0000-000000000008', client_id: 'b1000000-0000-0000-0000-000000000013', amount: 150000, date: '2026-05-30', payment_method: 'bank_transfer', treasury_id: T_CONTRACTING_BANK, notes: 'دفعة التسليم النهائي والإغلاق لمدرسة النماء' },
    { id: '0a000000-0000-0000-0000-000000000011', project_id: 'f2000000-0000-0000-0000-000000000001', client_id: 'b1000000-0000-0000-0000-000000000001', amount: 25000, date: '2026-02-15', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'دفعة مقدمة تشطيبات منزل محمد اشميلة' },
    { id: '0a000000-0000-0000-0000-000000000012', project_id: 'f2000000-0000-0000-0000-000000000002', client_id: 'b1000000-0000-0000-0000-000000000002', amount: 30000, date: '2026-03-20', payment_method: 'cash', treasury_id: T_FINISHING_CASH, notes: 'دفعة عهدة تشطيبات فيلا عبدالملك قراطم' }
  ];
  const { error: cpErr } = await supabase.from('client_payments').upsert(clientPayments);
  if (cpErr) console.error('Client payments error:', cpErr);
  else console.log(`  ✓ Seeded ${clientPayments.length} Client Payments`);

  // 17. CLIENT CREDIT LEDGER
  console.log('\n--- 17. SEEDING CLIENT CREDIT LEDGER ---');
  const creditLedger = [
    { id: '0b000000-0000-0000-0000-000000000001', client_id: 'b1000000-0000-0000-0000-000000000001', entry_type: 'CREDIT_CREATED', amount: 5000, source_payment_id: '0a000000-0000-0000-0000-000000000006', target_project_id: null, notes: 'فائض سداد نقدي من دفعة إنشاء منزل اشميلة متاح كرصيد دائن', created_at: '2026-04-20T10:00:00Z' },
    { id: '0b000000-0000-0000-0000-000000000002', client_id: 'b1000000-0000-0000-0000-000000000001', entry_type: 'CREDIT_APPLIED', amount: 3000, source_payment_id: null, target_project_id: 'f2000000-0000-0000-0000-000000000001', notes: 'استخدام 3,000 د.ل من الرصيد الدائن لتسديد مستحقات تشطيب منزل اشميلة', created_at: '2026-05-01T11:30:00Z' }
  ];
  const { error: cclErr } = await supabase.from('client_credit_ledger').upsert(creditLedger);
  if (cclErr) console.error('Credit ledger error:', cclErr);
  else console.log(`  ✓ Seeded 2 Client Credit Ledger entries`);

  // 18. TRANSFERS
  console.log('\n--- 18. SEEDING TRANSFERS ---');
  const transfers = [
    { id: '0c000000-0000-0000-0000-000000000001', project_id: 'f1000000-0000-0000-0000-000000000001', party_name: 'صالح بشير احميدة (أمين العهدة)', amount: 5000, spent_amount: 3200, remaining_amount: 1800, date: '2026-03-01', type: 'custody', status: 'active', notes: 'عهدة تشغيلية لموقع مسجد الرحمة' }
  ];
  await supabase.from('transfers').upsert(transfers);
  console.log(`  ✓ Seeded 1 Transfer`);

  // 19. TREASURY TRANSACTIONS POSTING
  console.log('\n--- 19. RECONCILING TREASURY TRANSACTIONS & BALANCES ---');
  // 1. Deposits from Client Payments
  const depTx = clientPayments.map(cp => ({
    treasury_id: cp.treasury_id,
    type: 'deposit',
    amount: cp.amount,
    date: cp.date,
    description: cp.notes,
    reference_id: cp.id
  }));

  // 2. Withdrawals from Purchase Payments
  const wdPurTx = purchasePayments.map(pp => ({
    treasury_id: pp.treasury_id,
    type: 'withdrawal',
    amount: pp.amount,
    date: pp.date,
    description: pp.notes,
    reference_id: pp.id
  }));

  // 3. Withdrawals from Expenses
  const wdExpTx = expenses.map(e => ({
    treasury_id: e.treasury_id,
    type: 'withdrawal',
    amount: e.amount,
    date: e.date,
    description: e.description,
    reference_id: e.id
  }));

  // 4. Inter-treasury Transfer
  const transferTx = [
    {
      treasury_id: T_CONTRACTING_CASH,
      type: 'withdrawal',
      amount: 15000,
      date: '2026-04-25',
      description: 'تحويل صادر إلى حساب مصرف الوحدة (جاري)',
      reference_id: '0c000000-0000-0000-0000-000000000001',
      source: 'transfer'
    },
    {
      treasury_id: T_CONTRACTING_BANK,
      type: 'deposit',
      amount: 15000,
      date: '2026-04-25',
      description: 'تحويل وارد من خزينة المقاولات الرئيسية',
      reference_id: '0c000000-0000-0000-0000-000000000001',
      source: 'transfer'
    }
  ];

  const allTx = [...depTx, ...wdPurTx, ...wdExpTx, ...transferTx];
  const { error: txErr } = await supabase.from('treasury_transactions').insert(allTx);
  if (txErr) console.error('Treasury transactions error:', txErr);
  else console.log(`  ✓ Inserted ${allTx.length} Treasury Transactions`);

  // 20. REBALANCE TREASURIES
  for (const tid of legitIds) {
    const { data: txs } = await supabase.from('treasury_transactions').select('type, amount').eq('treasury_id', tid);
    let bal = 0;
    if (txs) {
      for (const row of txs) {
        if (row.type === 'deposit') bal += Number(row.amount);
        else if (row.type === 'withdrawal') bal -= Number(row.amount);
      }
    }
    const finalBal = bal > 0 ? bal : 50000;
    await supabase.from('treasuries').update({ balance: finalBal }).eq('id', tid);
    console.log(`  ✓ Rebalanced Treasury ${tid} -> ${finalBal} LYD`);
  }

  console.log('\n========================================================');
  console.log('DENSE REALISTIC ZLITEN DATABASE SEEDING COMPLETED');
  console.log('========================================================');
}

runSeed().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
