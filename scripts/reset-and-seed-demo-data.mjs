import { supabase } from './financial-tests/client.mjs';

// Deterministic UUIDs for Demo Data
export const IDS = {
  // Treasuries
  TREASURY_CONTRACTING_MAIN: 'c504cce9-8bfd-4cda-8296-80febdec2432',
  TREASURY_CONTRACTING_BANK: 'ff7416dd-5295-4e55-bd52-2196eef9ec37',
  TREASURY_FINISHING_MAIN: 'f9637060-3f26-445e-b77c-658b31da2269',

  // Clients
  CLIENT_ASHMILA: '10000000-0000-4000-a000-000000000001',
  CLIENT_QRATEM: '10000000-0000-4000-a000-000000000002',
  CLIENT_TARHOUNI: '10000000-0000-4000-a000-000000000003',
  CLIENT_BEN_OMRAN: '10000000-0000-4000-a000-000000000004',
  CLIENT_ZLITNI: '10000000-0000-4000-a000-000000000005',
  CLIENT_BAKOUSH: '10000000-0000-4000-a000-000000000006',
  CLIENT_FITOURI: '10000000-0000-4000-a000-000000000007',
  CLIENT_MONTASER: '10000000-0000-4000-a000-000000000008',
  CLIENT_JAMAL: '10000000-0000-4000-a000-000000000009',
  CLIENT_ABUGHALIA: '10000000-0000-4000-a000-000000000010',
  CLIENT_OFOK_CORP: '10000000-0000-4000-a000-000000000011',
  CLIENT_SAHEL_CORP: '10000000-0000-4000-a000-000000000012',
  CLIENT_NAMAA_CORP: '10000000-0000-4000-a000-000000000013',
  CLIENT_ZLITEN_SERVICES: '10000000-0000-4000-a000-000000000014',

  // Projects (Contracting)
  PROJ_MOSQUE_RAHMA: '20000000-0000-4000-a000-000000000001',
  PROJ_QRATEM_BUILD: '20000000-0000-4000-a000-000000000002',
  PROJ_ASHMILA_BUILD: '20000000-0000-4000-a000-000000000003',
  PROJ_OFOK_BUILDING: '20000000-0000-4000-a000-000000000004',
  PROJ_OFOK_WAREHOUSE: '20000000-0000-4000-a000-000000000005',
  PROJ_TARHOUNI_VILLA: '20000000-0000-4000-a000-000000000006',
  PROJ_SAHEL_HQ: '20000000-0000-4000-a000-000000000007',
  PROJ_NAMAA_SCHOOL: '20000000-0000-4000-a000-000000000008',
  PROJ_BAKOUSH_RESORT: '20000000-0000-4000-a000-000000000009',

  // Projects (Finishing)
  PROJ_ASHMILA_FINISH: '20000000-0000-4000-a000-000000000010',
  PROJ_QRATEM_VILLA_FINISH: '20000000-0000-4000-a000-000000000011',
  PROJ_SHIFA_CLINIC: '20000000-0000-4000-a000-000000000012',
  PROJ_SAHEL_RESTAURANT: '20000000-0000-4000-a000-000000000013',
  PROJ_OFOK_OFFICE_FINISH: '20000000-0000-4000-a000-000000000014',
  PROJ_MONTASER_HALL: '20000000-0000-4000-a000-000000000015',
  PROJ_ZLITEN_SHOWROOM: '20000000-0000-4000-a000-000000000016',

  // Suppliers
  SUPP_WARED: '30000000-0000-4000-a000-000000000001',
  SUPP_BONYAN: '30000000-0000-4000-a000-000000000002',
  SUPP_SAHEL_CEMENT: '30000000-0000-4000-a000-000000000003',
  SUPP_ZLITEN_MARBLE: '30000000-0000-4000-a000-000000000004',
  SUPP_NOKHBA_ELECTRIC: '30000000-0000-4000-a000-000000000005',
  SUPP_AMAN_PLUMBING: '30000000-0000-4000-a000-000000000006',
  SUPP_EAMAR_ALUMINUM: '30000000-0000-4000-a000-000000000007',
  SUPP_WEFAQ_PAINTS: '30000000-0000-4000-a000-000000000008',
  SUPP_MADAR_EQUIP: '30000000-0000-4000-a000-000000000009',
  SUPP_ROAYA_SERVICES: '30000000-0000-4000-a000-000000000010',
  SUPP_GOLDEN_SAND: '30000000-0000-4000-a000-000000000011',
  SUPP_ZLITEN_BLOCK: '30000000-0000-4000-a000-000000000012',

  // Engineers
  ENG_AHMED_TARHOUNI: '40000000-0000-4000-a000-000000000001',
  ENG_MOHAMED_BEN_OMRAN: '40000000-0000-4000-a000-000000000002',
  ENG_ABDELRAHMAN_ZLITNI: '40000000-0000-4000-a000-000000000003',
  ENG_ALI_BAKOUSH: '40000000-0000-4000-a000-000000000004',

  // Employees
  EMP_SALEM_SHEIBANI: '50000000-0000-4000-a000-000000000001',
  EMP_YOUSSEF_SAGHIR: '50000000-0000-4000-a000-000000000002',
  EMP_FARAJ_MONTASER: '50000000-0000-4000-a000-000000000003',
  EMP_RAMADAN_JAMAL: '50000000-0000-4000-a000-000000000004',
};

async function executePurge() {
  console.log('--- PURGING OLD BUSINESS DATA (DEPENDENCY-ORDERED) ---');

  const purgeTables = [
    'audit_logs',
    'client_payment_allocations',
    'client_credit_ledger',
    'client_payments',
    'purchase_payments',
    'purchases',
    'technician_progress_records',
    'project_item_technicians',
    'project_item_technician_requirements',
    'project_items',
    'contract_clauses',
    'contract_items',
    'contracts',
    'project_phases',
    'equipment_rentals',
    'stock_movements',
    'materials',
    'equipment',
    'transfers',
    'expenses',
    'income',
    'project_custody',
    'project_schedules',
    'project_suppliers',
    'project_technicians',
    'variation_orders',
    'risk_register',
    'checklist_items',
    'inspection_checklists',
    'cash_flow_forecast',
    'treasury_transactions',
    'treasury_debts',
    'projects',
    'suppliers',
    'technicians',
    'clients',
    'engineers',
    'employees',
    'general_item_technician_requirements',
    'general_project_items',
  ];

  for (const table of purgeTables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`  ⚠️ Could not purge ${table}:`, error.message);
    } else {
      console.log(`  ✓ Purged ${table}`);
    }
  }

  // Delete test treasuries (preserving only the 3 legitimate business roots)
  const legitIds = [
    IDS.TREASURY_CONTRACTING_MAIN,
    IDS.TREASURY_CONTRACTING_BANK,
    IDS.TREASURY_FINISHING_MAIN,
  ];

  // First reset any non-legit balances to 0 to bypass trigger
  await supabase.from('treasuries').update({ balance: 0 }).not('id', 'in', `(${legitIds.join(',')})`);
  // Delete child branches first
  await supabase.from('treasuries').delete().not('id', 'in', `(${legitIds.join(',')})`).not('parent_id', 'is', null);
  // Delete non-legit roots
  await supabase.from('treasuries').delete().not('id', 'in', `(${legitIds.join(',')})`);
  console.log('  ✓ Test treasuries cleaned from live database');
}

async function seedTreasuriesAndOpeningBalances() {
  console.log('\n--- SEEDING TREASURIES & OPENING BALANCES ---');

  // Upsert legitimate business treasuries
  const treasuriesData = [
    {
      id: IDS.TREASURY_CONTRACTING_MAIN,
      name: 'خزينة المقاولات الرئيسية',
      description: 'الخزينة النقدية الرئيسية المعتمدة لمشاريع المقاولات العامة والإنشاءات',
      treasury_type: 'cash',
      project_category: 'contracting',
      parent_id: null,
      balance: 50000,
      is_active: true,
      notes: 'الخزينة النقدية المركزية لقطاع المقاولات — زليتن',
    },
    {
      id: IDS.TREASURY_CONTRACTING_BANK,
      name: 'حساب مصرف الوحدة (جاري)',
      description: 'الحساب المصرفي الجاري المخصص لعمليات وتحويلات المقاولات',
      treasury_type: 'bank',
      bank_name: 'مصرف الوحدة',
      account_number: '0123-456789-001',
      project_category: 'contracting',
      parent_id: IDS.TREASURY_CONTRACTING_MAIN,
      balance: 25000,
      is_active: true,
      notes: 'فرع مصرف الوحدة — زليتن',
    },
    {
      id: IDS.TREASURY_FINISHING_MAIN,
      name: 'خزينة التشطيبات الرئيسية',
      description: 'الخزينة النقدية الرئيسية المعتمدة لمشاريع وأعمال التشطيبات والديكور',
      treasury_type: 'cash',
      project_category: 'finishing',
      parent_id: null,
      balance: 30000,
      is_active: true,
      notes: 'الخزينة النقدية المركزية لقطاع التشطيبات — زليتن',
    },
  ];

  for (const t of treasuriesData) {
    const { error } = await supabase.from('treasuries').upsert(t);
    if (error) throw new Error(`Failed to upsert treasury ${t.name}: ${error.message}`);
    console.log(`  ✓ Treasury: ${t.name} -> ${t.balance} LYD`);
  }

  // Create opening transactions for authoritative ledger reconciliation
  const openingTx = [
    {
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      type: 'income',
      amount: 50000,
      balance_after: 50000,
      source: 'opening_balance',
      source_details: 'رصيد افتتاحي معتمد لخزينة المقاولات الرئيسية',
      description: 'إثبات الرصيد الافتتاحي النقدي لقطاع المقاولات',
      date: '2026-01-01',
    },
    {
      treasury_id: IDS.TREASURY_CONTRACTING_BANK,
      type: 'income',
      amount: 25000,
      balance_after: 25000,
      source: 'opening_balance',
      source_details: 'رصيد افتتاحي معتمد لحساب مصرف الوحدة',
      description: 'إثبات الرصيد الافتتاحي المصرفي لقطاع المقاولات',
      date: '2026-01-01',
    },
    {
      treasury_id: IDS.TREASURY_FINISHING_MAIN,
      type: 'income',
      amount: 30000,
      balance_after: 30000,
      source: 'opening_balance',
      source_details: 'رصيد افتتاحي معتمد لخزينة التشطيبات الرئيسية',
      description: 'إثبات الرصيد الافتتاحي النقدي لقطاع التشطيبات',
      date: '2026-01-01',
    },
  ];

  const { error: txErr } = await supabase.from('treasury_transactions').insert(openingTx);
  if (txErr) console.warn('  ⚠️ Could not insert opening tx:', txErr.message);
  else console.log('  ✓ Opening Treasury ledger transactions recorded');
}

async function seedMasterData() {
  console.log('\n--- SEEDING MASTER DATA (MEASUREMENT, TECHNICIAN TYPES, GENERAL ITEMS) ---');

  // 1. Technician Types
  const { data: techTypes, error: ttErr } = await supabase.from('technician_types').select('id, code');
  const techTypeMap = {};
  if (techTypes) {
    techTypes.forEach((tt) => {
      techTypeMap[tt.code] = tt.id;
    });
  }

  // 2. General Items
  const generalItems = [
    {
      name: 'حفر وتسوية القواعد والأساسات',
      description: 'أعمال حفر الأساسات ميكانيكياً ويدوياً وتسوية القاع ونقل المخلفات',
      measurement_type: 'م³',
      default_unit_price: 45,
      category: 'earthworks',
    },
    {
      name: 'صب خرسانة نظافة (سيمبل)',
      description: 'صب طبقة خرسانة عادية سُمك 10 سم أسفل القواعد مع التسوية والدك',
      measurement_type: 'م²',
      default_unit_price: 35,
      category: 'concrete',
    },
    {
      name: 'صب القواعد الخرسانية المسلحة',
      description: 'نجارة وحدادة وصب خرسانة جاهزة للقواعد والشناجات والرقاب',
      measurement_type: 'م³',
      default_unit_price: 280,
      category: 'concrete',
    },
    {
      name: 'أعمال الأعمدة الخرسانية المسلحة',
      description: 'نجارة وحدادة وصب خرسانة مسلحة للأعمدة مع المعالجة بالمياه',
      measurement_type: 'م³',
      default_unit_price: 340,
      category: 'concrete',
    },
    {
      name: 'أعمال الأسقف والكمرات الخرسانية المسلحة',
      description: 'شدة خشبية وتسليح حديد وصب خرسانة مسلحة للأسقف مع الكمرات الساقطة والمدفونة',
      measurement_type: 'م³',
      default_unit_price: 320,
      category: 'concrete',
    },
    {
      name: 'مباني قواطع بلوك إسمنتي 20 سم',
      description: 'بناء جدران خارجية وداخلية ببلوك إسمنتي 20 سم مع الربط والمونة الإسمنتية',
      measurement_type: 'م²',
      default_unit_price: 28,
      category: 'masonry',
    },
    {
      name: 'لياسة إسمنتية داخلية (بياض حوائط وأسقف)',
      description: 'طرطشة مسمرة وبؤج وأوتار ولياسة داخلية ناعمة',
      measurement_type: 'م²',
      default_unit_price: 18,
      category: 'plaster',
    },
    {
      name: 'تركيب سيراميك أرضيات وجدران',
      description: 'توريد وتركيب بلاط سيراميك نخب أول بمونة إسمنتية مع الفواصل والترويبة',
      measurement_type: 'م²',
      default_unit_price: 25,
      category: 'flooring',
    },
    {
      name: 'توريد وتركيب أسقف جبس بورد ديكورية',
      description: 'هيكل حديدي مجلفن وألواح جبس بورد مقاومة للرطوبة مع بيت نور ومعجون وفواصل',
      measurement_type: 'م²',
      default_unit_price: 55,
      category: 'gypsum',
    },
    {
      name: 'تأسيس تمديدات كهربائية وإنارة',
      description: 'تمديد مواسير وأسلاك نحاسية سويدي وعلب ماجيك وقواطع رئيسية',
      measurement_type: 'مقطوعية',
      default_unit_price: 3500,
      category: 'electrical',
    },
    {
      name: 'تأسيس شبكة تغذية وصرف صحي',
      description: 'أنابيب حرارية PPR وتصريف PVC وعوازل مع الاختبار بالضغط',
      measurement_type: 'مقطوعية',
      default_unit_price: 4200,
      category: 'plumbing',
    },
  ];

  const { data: createdGIs, error: giErr } = await supabase
    .from('general_project_items')
    .insert(generalItems)
    .select('id, name, category');

  if (giErr) console.warn('  ⚠️ Could not insert general items:', giErr.message);
  else console.log(`  ✓ Seeded ${createdGIs.length} General Items catalog`);

  // Attach staffing requirements if technician types exist
  if (createdGIs && techTypeMap['mason'] && techTypeMap['carpenter']) {
    const reqs = [];
    const concreteGI = createdGIs.find((g) => g.name.includes('القواعد الخرسانية'));
    if (concreteGI) {
      reqs.push(
        { general_item_id: concreteGI.id, technician_type_id: techTypeMap['carpenter'], required_count: 2 },
        { general_item_id: concreteGI.id, technician_type_id: techTypeMap['blacksmith'], required_count: 2 },
        { general_item_id: concreteGI.id, technician_type_id: techTypeMap['worker'], required_count: 3 }
      );
    }
    const masonryGI = createdGIs.find((g) => g.name.includes('مباني'));
    if (masonryGI) {
      reqs.push(
        { general_item_id: masonryGI.id, technician_type_id: techTypeMap['mason'], required_count: 2 },
        { general_item_id: masonryGI.id, technician_type_id: techTypeMap['worker'], required_count: 1 }
      );
    }
    const gypsumGI = createdGIs.find((g) => g.name.includes('جبس بورد'));
    if (gypsumGI) {
      reqs.push(
        { general_item_id: gypsumGI.id, technician_type_id: techTypeMap['gypsum_tech'], required_count: 2 },
        { general_item_id: gypsumGI.id, technician_type_id: techTypeMap['worker'], required_count: 1 }
      );
    }
    if (reqs.length > 0) {
      await supabase.from('general_item_technician_requirements').insert(reqs);
      console.log(`  ✓ Attached ${reqs.length} Staffing Requirements to General Items`);
    }
  }
}

async function seedClientsAndSuppliers() {
  console.log('\n--- SEEDING REALISTIC ZLITEN CLIENTS & SUPPLIERS ---');

  const clientsData = [
    {
      id: IDS.CLIENT_ASHMILA,
      name: 'محمد اشميلة',
      phone: '0912233445',
      city: 'زليتن',
      address: 'محلة بازينة — زليتن',
      notes: 'عميل رئيسي — مشاريع إنشائية وتشطيبات خاصة',
    },
    {
      id: IDS.CLIENT_QRATEM,
      name: 'عبدالملك قراطم',
      phone: '0923344556',
      city: 'زليتن',
      address: 'محلة الشيخ — زليتن',
      notes: 'عميل مميز — بناء وتشطيب فيلا سكنية فاخرة',
    },
    {
      id: IDS.CLIENT_TARHOUNI,
      name: 'محمود سالم الترهوني',
      phone: '0914455667',
      city: 'زليتن',
      address: 'محلة المنطرد — زليتن',
      notes: 'مشروع بناء فيلا خاصة',
    },
    {
      id: IDS.CLIENT_BEN_OMRAN,
      name: 'علي مفتاح بن عمران',
      phone: '0925566778',
      city: 'زليتن',
      address: 'طريق الساحل — زليتن',
      notes: 'مشروع تشطيب مطعم واستراحة سياحية',
    },
    {
      id: IDS.CLIENT_ZLITNI,
      name: 'صلاح الدين محمد الزليطني',
      phone: '0916677889',
      city: 'زليتن',
      address: 'حي الروضة — زليتن',
      notes: 'مشروع تجهيز عيادة طبية متخصصة',
    },
    {
      id: IDS.CLIENT_BAKOUSH,
      name: 'أيمن عبدالله البكوش',
      phone: '0927788990',
      city: 'زليتن',
      address: 'محلة كعام — زليتن',
      notes: 'مشروع إنشاء استراحة عائلية',
    },
    {
      id: IDS.CLIENT_FITOURI,
      name: 'خالد عمر الفيتوري',
      phone: '0918899001',
      city: 'زليتن',
      address: 'محلة سوق الثلاثاء — زليتن',
      notes: 'مشروع مجمع محلات تجارية',
    },
    {
      id: IDS.CLIENT_MONTASER,
      name: 'مصطفى رمضان المنتصر',
      phone: '0929900112',
      city: 'زليتن',
      address: 'قصر أحمد قرب زليتن',
      notes: 'مشروع تشطيب قاعة مناسبات كبرى',
    },
    {
      id: IDS.CLIENT_JAMAL,
      name: 'عبدالسلام علي الجمل',
      phone: '0911122334',
      city: 'زليتن',
      address: 'طريق الجمعة — زليتن',
      notes: 'مشروع منزل سكني',
    },
    {
      id: IDS.CLIENT_ABUGHALIA,
      name: 'سالم مفتاح أبوغالية',
      phone: '0922233441',
      city: 'زليتن',
      address: 'محلة النعيمة — زليتن',
      notes: 'مشروع مبنى إداري وتجاري',
    },
    {
      id: IDS.CLIENT_OFOK_CORP,
      name: 'شركة الأفق للاستثمار العقاري',
      phone: '0512621122',
      city: 'زليتن',
      address: 'شارع الفندق — برج الأفق — زليتن',
      notes: 'شركة استثمار عقاري كبرى — مشاريع متعددة',
    },
    {
      id: IDS.CLIENT_SAHEL_CORP,
      name: 'شركة الساحل للمقاولات والاستثمار',
      phone: '0512623344',
      city: 'زليتن',
      address: 'الطريق الساحلي ك 3 — زليتن',
      notes: 'شركة مقاولات شريكة — تنفيذ مقر إداري',
    },
    {
      id: IDS.CLIENT_NAMAA_CORP,
      name: 'شركة النماء للتطوير العقاري',
      phone: '0512625566',
      city: 'زليتن',
      address: 'شارع عمر المختار — زليتن',
      notes: 'أعمال صيانة وتوسعة تعليمية وتجارية',
    },
    {
      id: IDS.CLIENT_ZLITEN_SERVICES,
      name: 'مؤسسة زليتن للخدمات العامة',
      phone: '0512627788',
      city: 'زليتن',
      address: 'المجمع الإداري — زليتن',
      notes: 'مؤسسة خدمات عامة وتجهيزات',
    },
  ];

  const { error: clErr } = await supabase.from('clients').upsert(clientsData);
  if (clErr) throw new Error(`Failed to seed clients: ${clErr.message}`);
  console.log(`  ✓ Seeded ${clientsData.length} Realistic Libyan Clients in Zliten`);

  const suppliersData = [
    {
      id: IDS.SUPP_WARED,
      name: 'مؤسسة الوارد لمواد البناء',
      phone: '0913112233',
      city: 'زليتن',
      address: 'طريق الساحل — زليتن',
      notes: 'مورد رئيسي للإسمنت وحديد التسليح والمواد الأساسية',
    },
    {
      id: IDS.SUPP_BONYAN,
      name: 'شركة البنيان لتجارة الإسمنت والحديد',
      phone: '0924223344',
      city: 'زليتن',
      address: 'المنطقة الصناعية — زليتن',
      notes: 'توريد حديد صلب وإسمنت بورتلاندي معتمد',
    },
    {
      id: IDS.SUPP_SAHEL_CEMENT,
      name: 'مخزن الساحل للإسمنت والمواد الإنشائية',
      phone: '0915334455',
      city: 'زليتن',
      address: 'محلة بازينة — زليتن',
      notes: 'توريد ركام ورمل ومواد خرسانية',
    },
    {
      id: IDS.SUPP_ZLITEN_MARBLE,
      name: 'شركة زليتن للرخام والسيراميك',
      phone: '0926445566',
      city: 'زليتن',
      address: 'شارع طرابلس — زليتن',
      notes: 'رخام طبيعي وسيراميك إسباني وإيطالي',
    },
    {
      id: IDS.SUPP_NOKHBA_ELECTRIC,
      name: 'مؤسسة النخبة للأدوات الكهربائية',
      phone: '0917556677',
      city: 'زليتن',
      address: 'سوق الجمعة — زليتن',
      notes: 'كابلات وأسلاك ومعدات إنارة وقواطع',
    },
    {
      id: IDS.SUPP_AMAN_PLUMBING,
      name: 'شركة الأمان للسباكة ومواد العزل',
      phone: '0928667788',
      city: 'زليتن',
      address: 'شارع الميناء — زليتن',
      notes: 'أنابيب حرارية وعوازل مائية ومضخات',
    },
    {
      id: IDS.SUPP_EAMAR_ALUMINUM,
      name: 'مركز الإعمار للألمنيوم والواجهات',
      phone: '0919778899',
      city: 'زليتن',
      address: 'شارع المستشفى — زليتن',
      notes: 'قطاعات ألمنيوم وزجاج واجهات',
    },
    {
      id: IDS.SUPP_WEFAQ_PAINTS,
      name: 'مؤسسة الوفاق للدهانات والديكور',
      phone: '0921889900',
      city: 'زليتن',
      address: 'محلة الشيخ — زليتن',
      notes: 'دهانات جوتن ومعاجين وديكورات داخلية',
    },
    {
      id: IDS.SUPP_MADAR_EQUIP,
      name: 'شركة المدار لمعدات وآليات البناء',
      phone: '0912990011',
      city: 'زليتن',
      address: 'الطريق الدائري — زليتن',
      notes: 'معدات وسقالات وخلاطات خرسانة',
    },
    {
      id: IDS.SUPP_ROAYA_SERVICES,
      name: 'مؤسسة الرؤية للخدمات والتوريدات',
      phone: '0923110022',
      city: 'زليتن',
      address: 'وسط المدينة — زليتن',
      notes: 'توريدات عامة وخدمات لوجستية',
    },
    {
      id: IDS.SUPP_GOLDEN_SAND,
      name: 'محاجر الرمال والركام الذهبية',
      phone: '0914221133',
      city: 'زليتن',
      address: 'جنوب زليتن',
      notes: 'رمل أحمر وركام مغسول ومواد ردم',
    },
    {
      id: IDS.SUPP_ZLITEN_BLOCK,
      name: 'مصنع زليتن للطوب والبلوك الإسمنتي',
      phone: '0925332244',
      city: 'زليتن',
      address: 'طريق ماجر — زليتن',
      notes: 'طوب وبلوك إسمنتي مفرغ ومصمت بجميع المقاسات',
    },
  ];

  const { error: spErr } = await supabase.from('suppliers').upsert(suppliersData);
  if (spErr) throw new Error(`Failed to seed suppliers: ${spErr.message}`);
  console.log(`  ✓ Seeded ${suppliersData.length} Construction Suppliers in Zliten`);
}

async function seedTechniciansEngineersEmployees() {
  console.log('\n--- SEEDING TECHNICIANS (MULTIPLE NATIONALITIES), ENGINEERS & EMPLOYEES ---');

  const { data: techTypes } = await supabase.from('technician_types').select('id, code');
  const techTypeMap = {};
  if (techTypes) techTypes.forEach((tt) => (techTypeMap[tt.code] = tt.id));

  const techniciansData = [
    // Egyptians
    {
      name: 'أحمد مصطفى محمود',
      specialty: 'كهربائي',
      technician_type_id: techTypeMap['electrician'],
      phone: '0911002001',
      daily_rate: 120,
      notes: 'مصري — فني تمديدات كهربائية وشبكات إنارة معتمد',
    },
    {
      name: 'محمود عبدالفتاح حسن',
      specialty: 'مبلط',
      technician_type_id: techTypeMap['tiler'],
      phone: '0911002002',
      meter_rate: 25,
      notes: 'مصري — فني تركيب سيراميك ورخام وبورسلان',
    },
    {
      name: 'محمد السيد إبراهيم',
      specialty: 'سباك',
      technician_type_id: techTypeMap['plumber'],
      phone: '0911002003',
      daily_rate: 130,
      notes: 'مصري — فني تمديدات صحية وشبكات تغذية مياه',
    },
    {
      name: 'مصطفى رمضان أحمد',
      specialty: 'نجار',
      technician_type_id: techTypeMap['carpenter'],
      phone: '0911002004',
      daily_rate: 140,
      notes: 'مصري — نجار نجارة مسلحة وشدات خشبية',
    },
    {
      name: 'تامر إبراهيم فؤاد',
      specialty: 'دهان',
      technician_type_id: techTypeMap['painter'],
      phone: '0911002005',
      meter_rate: 15,
      notes: 'مصري — فني دهانات وديكورات داخلية وخارجية',
    },

    // Sudanese
    {
      name: 'محمد آدم عثمان',
      specialty: 'بناء',
      technician_type_id: techTypeMap['mason'],
      phone: '0922003001',
      daily_rate: 110,
      notes: 'سوداني — مقاول وبناء بلوك وقواطع خرسانية',
    },
    {
      name: 'عبدالرحمن الطيب حسن',
      specialty: 'عامل يومية',
      technician_type_id: techTypeMap['worker'],
      phone: '0922003002',
      daily_rate: 70,
      notes: 'سوداني — أعمال تجهيز وحفر وخلط خرسانة',
    },
    {
      name: 'مصعب أحمد سليمان',
      specialty: 'دهان',
      technician_type_id: techTypeMap['painter'],
      phone: '0922003003',
      meter_rate: 16,
      notes: 'سوداني — دهانات واجهات ورشاشات خارجية',
    },
    {
      name: 'إسماعيل عبدالله محمد',
      specialty: 'حداد',
      technician_type_id: techTypeMap['blacksmith'],
      phone: '0922003004',
      daily_rate: 130,
      notes: 'سوداني — حداد تسليح وقص وثني أسياخ',
    },
    {
      name: 'عثمان صديق يوسف',
      specialty: 'عامل يومية',
      technician_type_id: techTypeMap['worker'],
      phone: '0922003005',
      daily_rate: 70,
      notes: 'سوداني — مناولة مواد وصب خرسانات',
    },

    // Syrians
    {
      name: 'خالد محمود العلي',
      specialty: 'فني جبس بورد',
      technician_type_id: techTypeMap['gypsum_tech'],
      phone: '0913004001',
      meter_rate: 35,
      notes: 'سوري — فني ديكورات وأسقف معلقة وجبس بورد فرنسي',
    },
    {
      name: 'سامر أحمد الحسن',
      specialty: 'كهربائي',
      technician_type_id: techTypeMap['electrician'],
      phone: '0913004002',
      daily_rate: 140,
      notes: 'سوري — لوحات توزيع رئيسية وتأسيس إنارة سمارت',
    },
    {
      name: 'عمر عبدالرحمن حمود',
      specialty: 'فني تكييف',
      technician_type_id: techTypeMap['hvac_tech'],
      phone: '0913004003',
      daily_rate: 150,
      notes: 'سوري — تمديد نحاس وتركيب دكتات تكييف مركزي',
    },
    {
      name: 'ياسر محمد الخطيب',
      specialty: 'دهان',
      technician_type_id: techTypeMap['painter'],
      phone: '0913004004',
      meter_rate: 18,
      notes: 'سوري — دهانات رخامية ومخملية وديكورات حديثة',
    },
    {
      name: 'باسل غسان النجار',
      specialty: 'فني ألمنيوم',
      technician_type_id: techTypeMap['aluminum_tech'],
      phone: '0913004005',
      meter_rate: 40,
      notes: 'سوري — قطاعات ألمنيوم سحب دبل وزجاج سيكوريت',
    },

    // Libyans
    {
      name: 'ناصر سالم الترهوني',
      specialty: 'بناء',
      technician_type_id: techTypeMap['mason'],
      phone: '0914005001',
      daily_rate: 130,
      notes: 'ليبي — بناء قواطع وهياكل معمارية',
    },
    {
      name: 'مفتاح علي الزليطني',
      specialty: 'حداد',
      technician_type_id: techTypeMap['blacksmith'],
      phone: '0924005002',
      daily_rate: 140,
      notes: 'ليبي — حدادة معمارية ومظلات وأبواب خارجية',
    },
    {
      name: 'صلاح فرج بن عمران',
      specialty: 'سباك',
      technician_type_id: techTypeMap['plumber'],
      phone: '0914005003',
      daily_rate: 135,
      notes: 'ليبي — تمديدات مياه رئيسية وخزانات أرضية وعلوية',
    },
    {
      name: 'عمر سالم البكوش',
      specialty: 'عامل عزل',
      technician_type_id: techTypeMap['insulation_worker'],
      phone: '0924005004',
      meter_rate: 22,
      notes: 'ليبي — عزل مائي وحراري للأسطح والقواعد',
    },
  ];

  const { error: techErr } = await supabase.from('technicians').insert(techniciansData);
  if (techErr) console.warn('  ⚠️ Could not insert technicians:', techErr.message);
  else console.log(`  ✓ Seeded ${techniciansData.length} Technicians (Egyptian, Sudanese, Syrian, Libyan)`);

  // Engineers
  const engineersData = [
    {
      id: IDS.ENG_AHMED_TARHOUNI,
      name: 'م. أحمد سالم الترهوني',
      specialty: 'الهندسة المدنية والإنشائية',
      engineer_type: 'civil',
      phone: '0915551101',
      email: 'eng.ahmed@rekaz.ly',
      license_number: 'ENG-LY-10442',
      notes: 'مهندس موقع وإشراف إنشائي معتمد',
    },
    {
      id: IDS.ENG_MOHAMED_BEN_OMRAN,
      name: 'م. محمد مفتاح بن عمران',
      specialty: 'الهندسة المعمارية والديكور',
      engineer_type: 'architectural',
      phone: '0925551102',
      email: 'eng.mohamed@rekaz.ly',
      license_number: 'ENG-LY-10885',
      notes: 'مهندس معماري ومصمم داخلي لمشاريع التشطيبات',
    },
    {
      id: IDS.ENG_ABDELRAHMAN_ZLITNI,
      name: 'م. عبدالرحمن فرج الزليطني',
      specialty: 'الهندسة الكهروميكانيكية',
      engineer_type: 'electrical',
      phone: '0915551103',
      email: 'eng.abdelrahman@rekaz.ly',
      license_number: 'ENG-LY-11204',
      notes: 'مشرف شبكات الكهرباء والتكييف والصحي',
    },
    {
      id: IDS.ENG_ALI_BAKOUSH,
      name: 'م. علي رمضان البكوش',
      specialty: 'حساب كميات وإدارة مشاريع',
      engineer_type: 'management',
      phone: '0925551104',
      email: 'eng.ali@rekaz.ly',
      license_number: 'ENG-LY-11590',
      notes: 'مهندس إدارة العقود وحساب الكميات والمستخلصات',
    },
  ];

  const { error: engErr } = await supabase.from('engineers').upsert(engineersData);
  if (engErr) console.warn('  ⚠️ Could not insert engineers:', engErr.message);
  else console.log(`  ✓ Seeded ${engineersData.length} Engineers in Zliten`);

  // Employees
  const employeesData = [
    {
      id: IDS.EMP_SALEM_SHEIBANI,
      name: 'سالم فرج الشيباني',
      position: 'مدير إدارة المشاريع',
      department: 'الإدارة الفنية',
      phone: '0916662201',
      salary: 3500,
      hire_date: '2025-01-15',
      notes: 'مسؤول التنسيق الميداني وجدولة المشاريع',
    },
    {
      id: IDS.EMP_YOUSSEF_SAGHIR,
      name: 'يوسف محمد الصغير',
      position: 'المحاسب المالي العام',
      department: 'الإدارة المالية',
      phone: '0926662202',
      salary: 2800,
      hire_date: '2025-02-01',
      notes: 'إدارة الخزائن وسداد الموردين ومستحقات الفنيين',
    },
    {
      id: IDS.EMP_FARAJ_MONTASER,
      name: 'فرج عبدالسلام المنتصر',
      position: 'أمين المخازن واللوجستيات',
      department: 'المخازن والتوريد',
      phone: '0916662203',
      salary: 2200,
      hire_date: '2025-03-01',
      notes: 'استلام وحفظ المواد وصرفها للمواقع',
    },
    {
      id: IDS.EMP_RAMADAN_JAMAL,
      name: 'رمضان علي الجمل',
      position: 'مندوب مشتريات ومتابعة',
      department: 'المشتريات',
      phone: '0926662204',
      salary: 2000,
      hire_date: '2025-03-15',
      notes: 'متابعة عروض الأسعار والتوريدات مع الموردين',
    },
  ];

  const { error: empErr } = await supabase.from('employees').upsert(employeesData);
  if (empErr) console.warn('  ⚠️ Could not insert employees:', empErr.message);
  else console.log(`  ✓ Seeded ${employeesData.length} Core Administrative Employees`);
}

async function seedProjectsAndWorkflows() {
  console.log('\n--- SEEDING CONTRACTING & FINISHING PROJECTS + WORKFLOWS ---');

  // 1. Projects Data (9 Contracting + 7 Finishing = 16 projects)
  const projectsData = [
    // Contracting Projects
    {
      id: IDS.PROJ_MOSQUE_RAHMA,
      name: 'إنشاء مسجد الرحمة',
      description: 'مشروع إنشاء وبناء مسجد متكامل مع مئذنة وقبة وملحقات خدمية',
      client_id: IDS.CLIENT_ASHMILA,
      supervising_engineer_id: IDS.ENG_AHMED_TARHOUNI,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 420000,
      spent: 85000,
      progress: 45,
      start_date: '2026-01-10',
      location: 'زليتن — محلة بازينة',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مشروع مسجد الرحمة — تبرع وإشراف الحاج محمد اشميلة',
    },
    {
      id: IDS.PROJ_QRATEM_BUILD,
      name: 'إنشاء منزل عبدالملك قراطم',
      description: 'بناء فيلا سكنية دورين وملحق على مساحة 450 م²',
      client_id: IDS.CLIENT_QRATEM,
      supervising_engineer_id: IDS.ENG_AHMED_TARHOUNI,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 280000,
      spent: 60000,
      progress: 35,
      start_date: '2026-02-01',
      location: 'زليتن — محلة الشيخ',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'بناء الهيكل الخرساني والمباني لفيلا قراطم',
    },
    {
      id: IDS.PROJ_ASHMILA_BUILD,
      name: 'إنشاء منزل محمد اشميلة',
      description: 'مشروع بناء منزل سكني حديث دور أرضي وأول',
      client_id: IDS.CLIENT_ASHMILA,
      supervising_engineer_id: IDS.ENG_AHMED_TARHOUNI,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 220000,
      spent: 50000,
      progress: 50,
      start_date: '2026-01-15',
      location: 'زليتن — محلة بازينة',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'المرحلة الإنشائية لمنزل اشميلة',
    },
    {
      id: IDS.PROJ_OFOK_BUILDING,
      name: 'إنشاء عمارة سكنية وتجارية',
      description: 'إنشاء عمارة 5 طوابق ومحلات تجارية على الشارع العام',
      client_id: IDS.CLIENT_OFOK_CORP,
      supervising_engineer_id: IDS.ENG_AHMED_TARHOUNI,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 650000,
      spent: 120000,
      progress: 30,
      start_date: '2025-11-01',
      location: 'زليتن — شارع الفندق',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مشروع استثماري لشركة الأفق',
    },
    {
      id: IDS.PROJ_OFOK_WAREHOUSE,
      name: 'إنشاء مخزن تجاري ومستودع',
      description: 'بناء هنجر ومستودع تخزين بمساحة 1200 م² مع أرضيات هليكوبتر',
      client_id: IDS.CLIENT_OFOK_CORP,
      supervising_engineer_id: IDS.ENG_ALI_BAKOUSH,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 180000,
      spent: 45000,
      progress: 40,
      start_date: '2026-01-20',
      location: 'زليتن — المنطقة الصناعية',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مخازن لوجستية للشركة',
    },
    {
      id: IDS.PROJ_TARHOUNI_VILLA,
      name: 'إنشاء فيلا محمود الترهوني',
      description: 'بناء عظم لفيلا سكنية بتصميم حديث وحديقة',
      client_id: IDS.CLIENT_TARHOUNI,
      supervising_engineer_id: IDS.ENG_AHMED_TARHOUNI,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 320000,
      spent: 70000,
      progress: 40,
      start_date: '2025-12-10',
      location: 'زليتن — محلة المنطرد',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مشروع عائلة الترهوني',
    },
    {
      id: IDS.PROJ_SAHEL_HQ,
      name: 'تنفيذ مقر شركة الساحل',
      description: 'مشروع بناء مبنى إدارة ومقر رئيسي لشركة الساحل',
      client_id: IDS.CLIENT_SAHEL_CORP,
      supervising_engineer_id: IDS.ENG_ALI_BAKOUSH,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 480000,
      spent: 90000,
      progress: 25,
      start_date: '2026-02-15',
      location: 'زليتن — الطريق الساحلي',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مقر شركة الساحل للمقاولات',
    },
    {
      id: IDS.PROJ_NAMAA_SCHOOL,
      name: 'صيانة وتوسعة مدرسة النماء',
      description: 'بناء فصول إضافية وصيانة المبنى القائم والمرافق',
      client_id: IDS.CLIENT_NAMAA_CORP,
      supervising_engineer_id: IDS.ENG_AHMED_TARHOUNI,
      project_type: 'contracting',
      status: 'completed',
      budget: 95000,
      spent: 88000,
      progress: 100,
      start_date: '2025-08-01',
      end_date: '2025-12-25',
      location: 'زليتن — وسط المدينة',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مشروع منجز ومسلم بالكامل',
    },
    {
      id: IDS.PROJ_BAKOUSH_RESORT,
      name: 'إنشاء استراحة عائلية كعام',
      description: 'بناء استراحة ريفية مع سور خارجي ومسبح ومظلات',
      client_id: IDS.CLIENT_BAKOUSH,
      supervising_engineer_id: IDS.ENG_ALI_BAKOUSH,
      project_type: 'contracting',
      status: 'in_progress',
      budget: 140000,
      spent: 30000,
      progress: 20,
      start_date: '2026-03-01',
      location: 'زليتن — محلة كعام',
      default_treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'استراحة خاصة للحاج أيمن البكوش',
    },

    // Finishing Projects (Cost-Plus %, ZERO BOQ)
    {
      id: IDS.PROJ_ASHMILA_FINISH,
      name: 'تشطيب منزل محمد اشميلة',
      description: 'أعمال تشطيبات داخلية وخارجية متكاملة (جبس، أرضيات، دهانات، صحي، كهرباء)',
      client_id: IDS.CLIENT_ASHMILA,
      supervising_engineer_id: IDS.ENG_MOHAMED_BEN_OMRAN,
      project_type: 'finishing',
      finishing_percentage: 12,
      status: 'in_progress',
      budget: 160000,
      spent: 42000,
      progress: 40,
      start_date: '2026-02-10',
      location: 'زليتن — محلة بازينة',
      default_treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'تشطيب سوبر ديلوكس بنسبة إشراف 12%',
    },
    {
      id: IDS.PROJ_QRATEM_VILLA_FINISH,
      name: 'تشطيب فيلا عبدالملك قراطم',
      description: 'تشطيب فاخر مع ديكورات جبس بورد كلاسيك ورخام مستورد وإضاءة ذكية',
      client_id: IDS.CLIENT_QRATEM,
      supervising_engineer_id: IDS.ENG_MOHAMED_BEN_OMRAN,
      project_type: 'finishing',
      finishing_percentage: 15,
      status: 'in_progress',
      budget: 240000,
      spent: 65000,
      progress: 50,
      start_date: '2026-01-25',
      location: 'زليتن — محلة الشيخ',
      default_treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'تشطيبات VIP بنسبة 15%',
    },
    {
      id: IDS.PROJ_SHIFA_CLINIC,
      name: 'تجهيز وتشطيب عيادة الشفاء',
      description: 'تشطيب مركز طبي وعيادات تخصصية بمعايير ومواصفات صحية معتمدة',
      client_id: IDS.CLIENT_ZLITNI,
      supervising_engineer_id: IDS.ENG_MOHAMED_BEN_OMRAN,
      project_type: 'finishing',
      finishing_percentage: 10,
      status: 'in_progress',
      budget: 130000,
      spent: 35000,
      progress: 35,
      start_date: '2026-02-05',
      location: 'زليتن — حي الروضة',
      default_treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'تشطيب طبي مع قواطع عازلة ونظام تهوية',
    },
    {
      id: IDS.PROJ_SAHEL_RESTAURANT,
      name: 'تشطيب مطعم واستراحة الساحل',
      description: 'ديكورات خشبية وجبسية حديثة وتجهيز مطبخ ومطعم سياحي',
      client_id: IDS.CLIENT_BEN_OMRAN,
      supervising_engineer_id: IDS.ENG_MOHAMED_BEN_OMRAN,
      project_type: 'finishing',
      finishing_percentage: 12,
      status: 'in_progress',
      budget: 110000,
      spent: 28000,
      progress: 30,
      start_date: '2026-02-20',
      location: 'زليتن — طريق الساحل',
      default_treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'تشطيب مطعم سياحي',
    },
    {
      id: IDS.PROJ_OFOK_OFFICE_FINISH,
      name: 'تشطيب المكتب الإداري لشركة الأفق',
      description: 'تشطيب مكاتب إدارية وقاعات اجتماعات بزجاج سيكوريت وأسقف معلقة',
      client_id: IDS.CLIENT_OFOK_CORP,
      supervising_engineer_id: IDS.ENG_MOHAMED_BEN_OMRAN,
      project_type: 'finishing',
      finishing_percentage: 10,
      status: 'completed',
      budget: 75000,
      spent: 72000,
      progress: 100,
      start_date: '2025-09-01',
      end_date: '2025-12-15',
      location: 'زليتن — برج الأفق',
      default_treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'مشروع مكاتب منجز ومسلم لشركة الأفق',
    },
    {
      id: IDS.PROJ_MONTASER_HALL,
      name: 'تشطيب قاعة مناسبات كبرى',
      description: 'ديكورات فخمة وإضاءة ثريات وأسقف جبسية وعوازل صوتية للقاعة',
      client_id: IDS.CLIENT_MONTASER,
      supervising_engineer_id: IDS.ENG_MOHAMED_BEN_OMRAN,
      project_type: 'finishing',
      finishing_percentage: 15,
      status: 'in_progress',
      budget: 310000,
      spent: 80000,
      progress: 40,
      start_date: '2025-12-01',
      location: 'قصر أحمد قرب زليتن',
      default_treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'قاعة مناسبات واحتفالات',
    },
    {
      id: IDS.PROJ_ZLITEN_SHOWROOM,
      name: 'تشطيب صالة عرض مواد بناء',
      description: 'تجهيز صالة عرض واستقبال وستاندات عرض سيراميك وأدوات صحية',
      client_id: IDS.CLIENT_ZLITEN_SERVICES,
      supervising_engineer_id: IDS.ENG_MOHAMED_BEN_OMRAN,
      project_type: 'finishing',
      finishing_percentage: 10,
      status: 'in_progress',
      budget: 85000,
      spent: 20000,
      progress: 25,
      start_date: '2026-03-05',
      location: 'زليتن — المجمع الإداري',
      default_treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'معرض تجاري لمؤسسة زليتن',
    },
  ];

  const { error: prjErr } = await supabase.from('projects').upsert(projectsData);
  if (prjErr) throw new Error(`Failed to seed projects: ${prjErr.message}`);
  console.log(`  ✓ Seeded ${projectsData.length} Realistic Projects (9 Contracting + 7 Finishing)`);

  // 2. Project Phases
  const phasesData = [
    // Mosque Phases
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      name: 'الحفر والأساسات والقواعد',
      order_index: 1,
      status: 'completed',
      start_date: '2026-01-10',
      end_date: '2026-02-15',
    },
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      name: 'الهيكل الخرساني (الأعمدة والأسقف والمئذنة)',
      order_index: 2,
      status: 'in_progress',
      start_date: '2026-02-16',
    },
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      name: 'المباني واللياسة والأعمال الكهروميكانيكية',
      order_index: 3,
      status: 'planned',
    },

    // Qratem Build Phases
    {
      project_id: IDS.PROJ_QRATEM_BUILD,
      name: 'تجهيز الموقع والأساسات',
      order_index: 1,
      status: 'completed',
      start_date: '2026-02-01',
      end_date: '2026-02-28',
    },
    {
      project_id: IDS.PROJ_QRATEM_BUILD,
      name: 'الهيكل الخرساني للدور الأرضي والأول',
      order_index: 2,
      status: 'in_progress',
      start_date: '2026-03-01',
    },

    // Ashmila Finish Phases
    {
      project_id: IDS.PROJ_ASHMILA_FINISH,
      name: 'أعمال تمديدات الكهرباء والسباكة',
      order_index: 1,
      status: 'completed',
      start_date: '2026-02-10',
      end_date: '2026-03-05',
    },
    {
      project_id: IDS.PROJ_ASHMILA_FINISH,
      name: 'أعمال الأسقف الجبسية والأرضيات',
      order_index: 2,
      status: 'in_progress',
      start_date: '2026-03-06',
    },
    {
      project_id: IDS.PROJ_ASHMILA_FINISH,
      name: 'الدهانات النهائية والأبواب والتسليم',
      order_index: 3,
      status: 'planned',
    },
  ];

  const { data: createdPhases, error: phErr } = await supabase
    .from('project_phases')
    .insert(phasesData)
    .select('id, project_id, name');

  if (phErr) console.warn('  ⚠️ Could not insert phases:', phErr.message);
  else console.log(`  ✓ Seeded ${createdPhases.length} Project Phases`);

  // 3. Contracting Contracts (Exercising single and multiple/supplementary contracts)
  const contractsData = [
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      client_id: IDS.CLIENT_ASHMILA,
      title: 'عقد تنفيذ وإنشاء الهيكل العام لمسجد الرحمة',
      contract_number: 'CON-2026-001',
      amount: 350000,
      status: 'active',
      start_date: '2026-01-10',
      payment_terms: 'دفعات حسب المستخلصات ونسب الإنجاز المعتمدة',
      notes: 'العقد الإنشائي الرئيسي لمسجد الرحمة',
    },
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      client_id: IDS.CLIENT_ASHMILA,
      title: 'عقد ملحق لتنفيذ مئذنة وقبة المسجد الخارجية',
      contract_number: 'CON-2026-001-SUPP',
      amount: 70000,
      status: 'active',
      start_date: '2026-02-20',
      payment_terms: 'دفعة مقدمة 40% والباقي عند إتمام الهيكل الخارجي للمئذنة',
      notes: 'عقد ملحق إضافي لأعمال المئذنة والقبة',
    },
    {
      project_id: IDS.PROJ_QRATEM_BUILD,
      client_id: IDS.CLIENT_QRATEM,
      title: 'عقد إنشاء فيلا سكنية دورين — قراطم',
      contract_number: 'CON-2026-002',
      amount: 280000,
      status: 'active',
      start_date: '2026-02-01',
      payment_terms: 'دفعات مرحلية (أساسات، سقف أرضي، سقف أول، مباني)',
      notes: 'عقد مقاولة شامل المواد والمصنعية',
    },
    {
      project_id: IDS.PROJ_OFOK_BUILDING,
      client_id: IDS.CLIENT_OFOK_CORP,
      title: 'عقد تنفيذ عمارة سكنية وتجارية — الأفق',
      contract_number: 'CON-2026-003',
      amount: 650000,
      status: 'active',
      start_date: '2025-11-01',
      payment_terms: 'مستخلصات شهرية معتمدة من المهندس المشرف',
      notes: 'عقد مقاولة لشركة الأفق للاستثمار',
    },
    {
      project_id: IDS.PROJ_NAMAA_SCHOOL,
      client_id: IDS.CLIENT_NAMAA_CORP,
      title: 'عقد صيانة وتوسعة مرافق تعليمية',
      contract_number: 'CON-2026-007',
      amount: 95000,
      status: 'completed',
      start_date: '2025-08-01',
      end_date: '2025-12-25',
      payment_terms: 'مسدد بالكامل بعد الاستلام الابتدائي والنهائي',
      notes: 'عقد منجز ومغلق',
    },
  ];

  const { error: conErr } = await supabase.from('contracts').insert(contractsData);
  if (conErr) console.warn('  ⚠️ Could not insert contracts:', conErr.message);
  else console.log(`  ✓ Seeded ${contractsData.length} Realistic Contracting Contracts`);

  // 4. Contracting BOQ Project Items (Only for Contracting projects)
  const mosquePhase1 = createdPhases?.find((p) => p.project_id === IDS.PROJ_MOSQUE_RAHMA && p.name.includes('الأساسات'));
  const mosquePhase2 = createdPhases?.find((p) => p.project_id === IDS.PROJ_MOSQUE_RAHMA && p.name.includes('الهيكل الخرساني'));

  const boqItems = [
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      phase_id: mosquePhase1?.id || null,
      name: 'حفر وتسوية قواعد المسجد',
      description: 'حفر بعمق 2.2 م لجميع القواعد والشناجات',
      measurement_type: 'م³',
      quantity: 450,
      unit_price: 40,
      total_price: 18000,
      progress: 100,
    },
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      phase_id: mosquePhase1?.id || null,
      name: 'خرسانة نظافة عادية أسفل القواعد',
      description: 'سُمك 10 سم إسمنت مقاوم',
      measurement_type: 'م²',
      quantity: 380,
      unit_price: 32,
      total_price: 12160,
      progress: 100,
    },
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      phase_id: mosquePhase1?.id || null,
      name: 'صب القواعد المسلحة لمصلى الرجال والنساء',
      description: 'خرسانة مسلحة جاهزة c30 وحديد تسليح إيطالي',
      measurement_type: 'م³',
      quantity: 160,
      unit_price: 275,
      total_price: 44000,
      progress: 100,
    },
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      phase_id: mosquePhase2?.id || null,
      name: 'صب أعمدة الدور الأرضي الحاملة للمسجد',
      description: 'أعمدة دائرية ومربعة بارتفاع 5.5 م',
      measurement_type: 'م³',
      quantity: 75,
      unit_price: 330,
      total_price: 24750,
      progress: 80,
    },
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      phase_id: mosquePhase2?.id || null,
      name: 'صب سقف القاعة الرئيسية مع كمرات القبة',
      description: 'سقف هوردي مفرغ مع كمرات خرسانية ساقطة',
      measurement_type: 'م³',
      quantity: 190,
      unit_price: 310,
      total_price: 58900,
      progress: 30,
    },
  ];

  const { data: createdBOQ, error: boqErr } = await supabase.from('project_items').insert(boqItems).select('id, name');
  if (boqErr) console.warn('  ⚠️ Could not insert BOQ items:', boqErr.message);
  else console.log(`  ✓ Seeded ${createdBOQ.length} Negotiated BOQ Items for Contracting Project`);
}

async function seedTransactionsAndAccounting() {
  console.log('\n--- SEEDING PURCHASES, PAYMENTS, TECHNICIAN PROGRESS, EXPENSES & RECEIPTS ---');

  // 1. Supplier Purchases & Payments (Authoritative purchase_payments)
  // Multi-invoice scenario: مؤسسة الوارد لمواد البناء on إنشاء مسجد الرحمة
  const p1Id = '70000000-0000-4000-a000-000000000001';
  const p2Id = '70000000-0000-4000-a000-000000000002';
  const p3Id = '70000000-0000-4000-a000-000000000003';

  const purchasesData = [
    {
      id: p1Id,
      supplier_id: IDS.SUPP_WARED,
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      invoice_number: 'INV-2026-001',
      title: 'توريد دفعة أسمنت بورتلاندي مقاوم (500 كيس)',
      total_amount: 15000,
      paid_amount: 10000,
      status: 'partially_paid',
      date: '2026-01-20',
      purchase_type: 'material',
      notes: 'توريد لصب الأساسات',
    },
    {
      id: p2Id,
      supplier_id: IDS.SUPP_WARED,
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      invoice_number: 'INV-2026-002',
      title: 'توريد حديد تسليح 14 مم و 16 مم (20 طن)',
      total_amount: 22000,
      paid_amount: 22000,
      status: 'paid',
      date: '2026-01-28',
      purchase_type: 'material',
      notes: 'حديد تسليح للقواعد والأعمدة',
    },
    {
      id: p3Id,
      supplier_id: IDS.SUPP_WARED,
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      invoice_number: 'INV-2026-003',
      title: 'توريد رمل حرش وركام مغسول (15 شاحنة)',
      total_amount: 6000,
      paid_amount: 0,
      status: 'unpaid',
      date: '2026-02-15',
      purchase_type: 'material',
      notes: 'مواد خرسانة مسلحة',
    },
    // Finishing purchase
    {
      id: '70000000-0000-4000-a000-000000000004',
      supplier_id: IDS.SUPP_ZLITEN_MARBLE,
      project_id: IDS.PROJ_ASHMILA_FINISH,
      invoice_number: 'INV-2026-004',
      title: 'توريد سيراميك وبورسلان للأرضيات والجدران',
      total_amount: 18000,
      paid_amount: 12000,
      status: 'partially_paid',
      date: '2026-02-25',
      purchase_type: 'material',
      notes: 'سيراميك إسباني نخب أول',
    },
  ];

  const { error: purErr } = await supabase.from('purchases').upsert(purchasesData);
  if (purErr) console.warn('  ⚠️ Could not insert purchases:', purErr.message);
  else console.log(`  ✓ Seeded ${purchasesData.length} Supplier Invoices`);

  // Authoritative Purchase Payments with single Treasury OUT each
  const purchasePayments = [
    {
      id: '80000000-0000-4000-a000-000000000001',
      purchase_id: p1Id,
      amount: 10000,
      date: '2026-01-25',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'سداد دفعة أولى من فاتورة الأسمنت INV-2026-001',
    },
    {
      id: '80000000-0000-4000-a000-000000000002',
      purchase_id: p2Id,
      amount: 22000,
      date: '2026-02-05',
      payment_method: 'bank_transfer',
      treasury_id: IDS.TREASURY_CONTRACTING_BANK,
      notes: 'سداد كامل قيمة فاتورة الحديد INV-2026-002 عبر المصرف',
    },
    {
      id: '80000000-0000-4000-a000-000000000003',
      purchase_id: '70000000-0000-4000-a000-000000000004',
      amount: 12000,
      date: '2026-03-01',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'سداد دفعة سيراميك التشطيبات',
    },
  ];

  const { error: ppErr } = await supabase.from('purchase_payments').upsert(purchasePayments);
  if (ppErr) console.warn('  ⚠️ Could not insert purchase payments:', ppErr.message);
  else console.log(`  ✓ Seeded ${purchasePayments.length} Authoritative Purchase Payments`);

  // 2. Technicians Progress Records & Settlement Payments
  const { data: allTechs } = await supabase.from('technicians').select('id, name, specialty');
  const techAhmed = allTechs?.find((t) => t.name.includes('أحمد مصطفى')); // Electrician
  const techAdam = allTechs?.find((t) => t.name.includes('محمد آدم')); // Mason
  const techKhaled = allTechs?.find((t) => t.name.includes('خالد محمود')); // Gypsum
  const techTiler = allTechs?.find((t) => t.name.includes('محمود عبدالفتاح')); // Tiler

  if (techAhmed && techAdam && techKhaled) {
    const progressRecords = [
      // Ahmed on Mosque
      {
        technician_id: techAhmed.id,
        project_id: IDS.PROJ_MOSQUE_RAHMA,
        quantity_completed: 1,
        earned_amount: 4500,
        date: '2026-02-10',
        notes: 'تأسيس شبكة الكهرباء والمواسير الأرضية للقاعة الرئيسية للمسجد',
      },
      // Adam on Qratem Build
      {
        technician_id: techAdam.id,
        project_id: IDS.PROJ_QRATEM_BUILD,
        quantity_completed: 1,
        earned_amount: 6000,
        date: '2026-02-20',
        notes: 'بناء جدران وقواطع الدور الأرضي لفيلا قراطم',
      },
      // Khaled on Ashmila Finish
      {
        technician_id: techKhaled.id,
        project_id: IDS.PROJ_ASHMILA_FINISH,
        quantity_completed: 1,
        earned_amount: 5500,
        date: '2026-03-02',
        notes: 'تركيب هياكل وألواح جبس بورد ديكوري للصالات والغرف',
      },
      // Tiler on Ashmila Finish
      {
        technician_id: techTiler?.id || techAhmed.id,
        project_id: IDS.PROJ_ASHMILA_FINISH,
        quantity_completed: 1,
        earned_amount: 3800,
        date: '2026-03-08',
        notes: 'أعمال تركيب أرضيات الصالون الرئيسي',
      },
    ];

    await supabase.from('technician_progress_records').insert(progressRecords);
    console.log(`  ✓ Seeded ${progressRecords.length} Technician Progress Records (Earned Labor)`);

    // Technician Payments via expenses (type = 'labor')
    const laborPayments = [
      // Partial payment to Ahmed (Earned 4500, Paid 3000, Due 1500)
      {
        type: 'labor',
        project_id: IDS.PROJ_MOSQUE_RAHMA,
        technician_id: techAhmed.id,
        amount: 3000,
        date: '2026-02-15',
        payment_method: 'cash',
        treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
        notes: 'دفعة حساب أعمال كهرباء مسجد الرحمة',
      },
      // Full payment to Adam (Earned 6000, Paid 6000, Due 0)
      {
        type: 'labor',
        project_id: IDS.PROJ_QRATEM_BUILD,
        technician_id: techAdam.id,
        amount: 6000,
        date: '2026-02-25',
        payment_method: 'cash',
        treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
        notes: 'سداد كامل مستحقات مباني فيلا قراطم',
      },
      // Partial payment to Khaled (Earned 5500, Paid 3500, Due 2000)
      {
        type: 'labor',
        project_id: IDS.PROJ_ASHMILA_FINISH,
        technician_id: techKhaled.id,
        amount: 3500,
        date: '2026-03-05',
        payment_method: 'cash',
        treasury_id: IDS.TREASURY_FINISHING_MAIN,
        notes: 'دفعة أعمال الجبس بورد لمنزل اشميلة',
      },
    ];

    await supabase.from('expenses').insert(laborPayments);
    console.log(`  ✓ Seeded ${laborPayments.length} Technician Settlement Payments (Expenses type=labor)`);
  }

  // 3. Direct Project Expenses & General Company Expenses
  const otherExpenses = [
    // Direct Project Expense (Contracting)
    {
      type: 'project',
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      description: 'نقل مواد ورافعات شوكية لتنزيل الحديد بالموقع',
      amount: 800,
      date: '2026-01-22',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مصروف نقل وتنزيل',
    },
    {
      type: 'project',
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      description: 'وقود وزيوت لمولد الكهرباء والمضخات الميدانية',
      amount: 450,
      date: '2026-02-01',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'مصروف تشغيل موقع',
    },
    // Direct Project Expense (Finishing)
    {
      type: 'project',
      project_id: IDS.PROJ_SHIFA_CLINIC,
      description: 'رسوم تصاريح فنية ونظافة عامة لموقع العيادة',
      amount: 650,
      date: '2026-02-18',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_FINISHING_MAIN,
      notes: 'تصاريح ونظافة موقع العيادة',
    },
    // General Company Expenses (No project_id)
    {
      type: 'general',
      project_id: null,
      description: 'إيجار مقر الشركة الرئيسي بزليتن (الربع الأول 2026)',
      amount: 3000,
      date: '2026-01-05',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'إيجار المقر الإداري للشركة',
    },
    {
      type: 'general',
      project_id: null,
      description: 'اشتراك إنترنت فايبر وفاتورة كهرباء المقر',
      amount: 600,
      date: '2026-02-02',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'فواتير مرافق المكتب',
    },
  ];

  await supabase.from('expenses').insert(otherExpenses);
  console.log(`  ✓ Seeded ${otherExpenses.length} Direct Project & General Company Expenses`);

  // 4. Equipment & Rentals
  const equipmentData = [
    {
      name: 'مولد كهرباء كاتم 50 ك.ف.أ',
      description: 'مولد ديزل بيركنز كاتم صوت للمواقع الإنشائية',
      category: 'generators',
      purchase_price: 32000,
      current_condition: 'excellent',
      daily_rental_rate: 150,
      total_quantity: 2,
      available_quantity: 1,
    },
    {
      name: 'طقم سقالات معدنية متكاملة',
      description: 'سقالات أنبوبية مع وصلات وألواح معدنية 500 م²',
      category: 'scaffolding',
      purchase_price: 18000,
      current_condition: 'good',
      daily_rental_rate: 80,
      total_quantity: 4,
      available_quantity: 3,
    },
    {
      name: 'ماكينة قص سيراميك ورخام مائية',
      description: 'ماكينة روبي إسبانية مزودة بنظام تبريد مائي للقص الدقيق',
      category: 'cutters',
      purchase_price: 4500,
      current_condition: 'excellent',
      daily_rental_rate: 50,
      total_quantity: 3,
      available_quantity: 2,
    },
  ];

  const { data: createdEquip, error: eqErr } = await supabase.from('equipment').insert(equipmentData).select('id, name');
  if (eqErr) console.warn('  ⚠️ Could not insert equipment:', eqErr.message);
  else {
    console.log(`  ✓ Seeded ${createdEquip.length} Equipment items`);
    if (createdEquip.length >= 3) {
      const rentals = [
        {
          equipment_id: createdEquip[0].id,
          project_id: IDS.PROJ_MOSQUE_RAHMA,
          start_date: '2026-01-15',
          end_date: '2026-01-25',
          daily_rate: 150,
          total_amount: 1500,
          status: 'completed',
          notes: 'تشغيل إنارة ومعدات صب أساسات المسجد',
        },
        {
          equipment_id: createdEquip[1].id,
          project_id: IDS.PROJ_OFOK_BUILDING,
          start_date: '2026-02-01',
          end_date: '2026-02-20',
          daily_rate: 80,
          total_amount: 1600,
          status: 'active',
          notes: 'سقالات لبناء واجهات العمارة السكنية',
        },
      ];
      await supabase.from('equipment_rentals').insert(rentals);
      console.log(`  ✓ Seeded ${rentals.length} Equipment Rentals on Projects`);
    }
  }

  // 5. Client Payments & Credit Scenario
  const clientPayments = [
    // Mosque collection (80,000 via Bank)
    {
      project_id: IDS.PROJ_MOSQUE_RAHMA,
      client_id: IDS.CLIENT_ASHMILA,
      amount: 80000,
      date: '2026-01-15',
      payment_method: 'bank_transfer',
      treasury_id: IDS.TREASURY_CONTRACTING_BANK,
      notes: 'الدفعة الأولى لمشروع مسجد الرحمة من الحاج محمد اشميلة',
    },
    // Qratem Build collection (60,000 via Cash)
    {
      project_id: IDS.PROJ_QRATEM_BUILD,
      client_id: IDS.CLIENT_QRATEM,
      amount: 60000,
      date: '2026-02-05',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'دفعة تنفيذ الأساسات لفيلا قراطم',
    },
    // Ashmila Build Overpayment Scenario:
    // Client paid 55,000 LYD for Project (creating 5,000 credit)
    {
      id: '90000000-0000-4000-a000-000000000001',
      project_id: IDS.PROJ_ASHMILA_BUILD,
      client_id: IDS.CLIENT_ASHMILA,
      amount: 55000,
      date: '2026-01-20',
      payment_method: 'cash',
      treasury_id: IDS.TREASURY_CONTRACTING_MAIN,
      notes: 'سداد دفعة إجمالية لمنزل اشميلة (تتضمن فائض رصيد للعميل)',
    },
  ];

  const { error: cpErr } = await supabase.from('client_payments').upsert(clientPayments);
  if (cpErr) console.warn('  ⚠️ Could not insert client payments:', cpErr.message);
  else console.log(`  ✓ Seeded ${clientPayments.length} Project Client Receipts`);

  // Record Client Credit in Ledger
  const creditEntries = [
    {
      client_id: IDS.CLIENT_ASHMILA,
      entry_type: 'overpayment',
      amount: 5000,
      source_payment_id: '90000000-0000-4000-a000-000000000001',
      target_project_id: IDS.PROJ_ASHMILA_BUILD,
      notes: 'رصيد دائن ناتج عن فائض سداد لمشروع إنشاء منزل اشميلة',
      created_at: '2026-01-20T12:00:00Z',
    },
    {
      client_id: IDS.CLIENT_ASHMILA,
      entry_type: 'application',
      amount: 3000,
      target_project_id: IDS.PROJ_ASHMILA_FINISH,
      notes: 'ترحيل واستخدام 3,000 د.ل من الرصيد الدائن لصالح مشروع تشطيب منزل اشميلة',
      created_at: '2026-02-15T12:00:00Z',
    },
  ];

  const { error: credErr } = await supabase.from('client_credit_ledger').insert(creditEntries);
  if (credErr) console.warn('  ⚠️ Could not insert credit entries:', credErr.message);
  else console.log(`  ✓ Seeded Client Credit Scenario (5,000 Overpayment -> 3,000 Applied to Finishing, 2,000 Available)`);

  // 6. Treasury Transfer (Contracting Main -> Bank: 15,000 LYD)
  const transfer = {
    amount: 15000,
    date: '2026-02-10',
    type: 'internal_transfer',
    party_name: 'تحويل نقدي بين الخزائن',
    notes: 'إيداع نقدي من خزينة المقاولات الرئيسية إلى حساب مصرف الوحدة',
  };
  await supabase.from('transfers').insert(transfer);
  console.log(`  ✓ Seeded Treasury Transfer (15,000 LYD from Cash to Bank)`);
}

async function reconcileAndFinalizeBalances() {
  console.log('\n--- RECONCILING FINAL TREASURY BALANCES ---');

  // Calculate net balances based on opening balance and transactions
  // 1. Contracting Main:
  // Opening: +50,000
  // Client Receipts: +60,000 (Qratem) + 55,000 (Ashmila) = +115,000
  // Supplier Payments: -10,000 (Wared Cement)
  // Labor Payments: -3,000 (Ahmed) - 6,000 (Adam) = -9,000
  // Direct Expenses: -800 - 450 = -1,250
  // General Expenses: -3,000 - 600 = -3,600
  // Transfer to Bank: -15,000
  // Final Net: 50,000 + 115,000 - 10,000 - 9,000 - 1,250 - 3,600 - 15,000 = 126,150 LYD

  // 2. Contracting Bank:
  // Opening: +25,000
  // Client Receipts: +80,000 (Mosque)
  // Transfer in: +15,000
  // Supplier Payments: -22,000 (Wared Steel)
  // Final Net: 25,000 + 80,000 + 15,000 - 22,000 = 98,000 LYD

  // 3. Finishing Main:
  // Opening: +30,000
  // Supplier Payments: -12,000 (Marble)
  // Labor Payments: -3,500 (Khaled)
  // Direct Expenses: -650
  // Final Net: 30,000 - 12,000 - 3,500 - 650 = 13,850 LYD

  const finalBalances = {
    [IDS.TREASURY_CONTRACTING_MAIN]: 126150,
    [IDS.TREASURY_CONTRACTING_BANK]: 98000,
    [IDS.TREASURY_FINISHING_MAIN]: 13850,
  };

  for (const [id, balance] of Object.entries(finalBalances)) {
    await supabase.from('treasuries').update({ balance }).eq('id', id);
  }

  console.log(`  ✓ Contracting Main Final Balance : ${finalBalances[IDS.TREASURY_CONTRACTING_MAIN]} LYD`);
  console.log(`  ✓ Contracting Bank Final Balance : ${finalBalances[IDS.TREASURY_CONTRACTING_BANK]} LYD`);
  console.log(`  ✓ Finishing Main Final Balance   : ${finalBalances[IDS.TREASURY_FINISHING_MAIN]} LYD`);
  console.log(`  ✓ Total Company Cash Reconciled  : ${Object.values(finalBalances).reduce((a, b) => a + b, 0)} LYD`);
}

async function main() {
  console.log('========================================================');
  console.log('STARTING FULL DEMO DATABASE RESET & RESEED (ZLITEN REALISTIC DATA)');
  console.log('========================================================\n');

  await executePurge();
  await seedTreasuriesAndOpeningBalances();
  await seedMasterData();
  await seedClientsAndSuppliers();
  await seedTechniciansEngineersEmployees();
  await seedProjectsAndWorkflows();
  await seedTransactionsAndAccounting();
  await reconcileAndFinalizeBalances();

  console.log('\n========================================================');
  console.log('DEMO RESET & SEEDING COMPLETED SUCCESSFULLY!');
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
