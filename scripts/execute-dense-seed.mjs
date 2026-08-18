import { supabase } from './financial-tests/client.mjs';
import { ID_MAP } from './seed-ids.mjs';

async function main() {
  console.log('========================================================');
  console.log('STARTING COMPLETE DENSE ZLITEN DEMO SEED EXECUTION');
  console.log('========================================================\n');

  // 1. General Project Items (20 items)
  console.log('--- 1. SEEDING GENERAL PROJECT ITEMS (20 ITEMS) ---');
  const generalItems = [
    { id: 'a1000000-0000-0000-0000-000000000001', name: 'أعمال حفر وتسوية الموقع العام', default_unit_price: 18, measurement_type: 'م³', description: 'حفر وتسوية بالأليات وتطهير قاع الحفر ونقل المخلفات خارج الموقع', category: 'أعمال ترابية' },
    { id: 'a1000000-0000-0000-0000-000000000002', name: 'خرسانة عادية نظافة أسفل القواعد', default_unit_price: 160, measurement_type: 'م³', description: 'صب خرسانة عادية سماكة 10 سم مقاومة للأملاح أسفل القواعد والسملات', category: 'خرسانات' },
    { id: 'a1000000-0000-0000-0000-000000000003', name: 'خرسانة مسلحة للقواعد والميد', default_unit_price: 360, measurement_type: 'م³', description: 'توريد وصب خرسانة مسلحة عيار 350 كجم/م³ مع أعمال النجارة والحدادة', category: 'خرسانات' },
    { id: 'a1000000-0000-0000-0000-000000000004', name: 'خرسانة مسلحة للأعمدة ورقاب الأعمدة', default_unit_price: 420, measurement_type: 'م³', description: 'خرسانة مسلحة عيار 350 كجم/م³ للأعمدة مع المعالجة المائية الشاملة', category: 'خرسانات' },
    { id: 'a1000000-0000-0000-0000-000000000005', name: 'خرسانة مسلحة للأسقف والكمرات', default_unit_price: 390, measurement_type: 'م³', description: 'خرسانة مسلحة للأسقف والكمرات عيار 350 كجم/م³ شاملة الفرم والحديد', category: 'خرسانات' },
    { id: 'a1000000-0000-0000-0000-000000000006', name: 'مباني طوب أسمنتي مفرغ 20 سم', default_unit_price: 32, measurement_type: 'م²', description: 'بناء جدران خارجية بطوب أسمنتي عالي المقاومة بمونة 300 كجم/م³', category: 'مباني' },
    { id: 'a1000000-0000-0000-0000-000000000007', name: 'مباني قواطع طوب أسمنتي 15 سم', default_unit_price: 28, measurement_type: 'م²', description: 'بناء قواطع داخلية بطوب أسمنتي مفرغ مع تشبيك الزوايا بالأعمدة', category: 'مباني' },
    { id: 'a1000000-0000-0000-0000-000000000008', name: 'لياسة أسمنتية داخلية ناعمة', default_unit_price: 16, measurement_type: 'م²', description: 'طرطشة وبؤج وأوتار ولياسة ناعمة للجدران والأسقف الداخلية', category: 'لياسة' },
    { id: 'a1000000-0000-0000-0000-000000000009', name: 'لياسة أسمنتية خارجية طرطشة وممسوسة', default_unit_price: 22, measurement_type: 'م²', description: 'لياسة واجهات خارجية مقاومة للرطوبة مع بؤج وأوتار', category: 'لياسة' },
    { id: 'a1000000-0000-0000-0000-000000000010', name: 'عزل مائي وحراري للأسقف ودورات المياه', default_unit_price: 35, measurement_type: 'م²', description: 'عزل بيتوميني وممبرين 4 مم للأسقف والحمامات مع اختبار الغمر', category: 'عوازل' },
    { id: 'a1000000-0000-0000-0000-000000000011', name: 'تركيب بلاط وسيراميك أرضيات', default_unit_price: 25, measurement_type: 'م²', description: 'توريد وتركيب سيراميك أرضيات نخب أول بمونة أسمنتية وروبة متخصصة', category: 'أرضيات' },
    { id: 'a1000000-0000-0000-0000-000000000012', name: 'تركيب رخام درج ومداخل', default_unit_price: 65, measurement_type: 'م ط', description: 'توريد وتركيب رخام تريستا / كرارة نخب أول للدرج والمداخل', category: 'رخام' },
    { id: 'a1000000-0000-0000-0000-000000000013', name: 'أعمال جبس بورد ديكوري للأسقف', default_unit_price: 45, measurement_type: 'م²', description: 'تركيب أسقف معلقة وألواح جبس بورد كناوف مقاوم للرطوبة مع الإضاءة المخفية', category: 'ديكورات' },
    { id: 'a1000000-0000-0000-0000-000000000014', name: 'دهانات داخلية مائية مع معجون وتأسيس', default_unit_price: 14, measurement_type: 'م²', description: 'صنفرة ومعجون أساس وجهين ودهان وجهين جوتن فينيل حريري', category: 'دهانات' },
    { id: 'a1000000-0000-0000-0000-000000000015', name: 'دهانات واجهات خارجية مقاومة للعوامل الجوية', default_unit_price: 20, measurement_type: 'م²', description: 'دهان جوتاشيلد خارجي مقاوم لأشعة الشمس والرطوبة البحرية', category: 'دهانات' },
    { id: 'a1000000-0000-0000-0000-000000000016', name: 'تمديدات شبكة كهرباء داخلية وإنارة', default_unit_price: 40, measurement_type: 'نقطة', description: 'تأسيس مواسير وكابلات سويدي وسحب الأسلاك ومفاتيح باناسونيك', category: 'كهرباء' },
    { id: 'a1000000-0000-0000-0000-000000000017', name: 'تأسيس شبكة مياه وصرف صحي', default_unit_price: 3500, measurement_type: 'مقطوعية', description: 'تمديد مواسير PPR حرارية وشبكة صرف صحي مع غرف التفتيش', category: 'صحي' },
    { id: 'a1000000-0000-0000-0000-000000000018', name: 'تركيب أبواب خشبية سويدي وقشرة', default_unit_price: 450, measurement_type: 'عدد', description: 'توريد وتركيب أبواب خشب سويدي مع الكيلون والإكسسوارات النحاسية', category: 'نجارة' },
    { id: 'a1000000-0000-0000-0000-000000000019', name: 'تركيب شبابيك وواجهات ألمنيوم دبل جلاس', default_unit_price: 280, measurement_type: 'م²', description: 'توريد وتركيب ألمنيوم قطاع خاص وزجاج مزدوج عازل للصوت والحرارة', category: 'ألمنيوم' },
    { id: 'a1000000-0000-0000-0000-000000000020', name: 'تنظيف الموقع وإزالة المخلفات والتسليم', default_unit_price: 1500, measurement_type: 'مقطوعية', description: 'تنظيف وتلميع الموقع وإزالة السقالات وتسليم المفتاح للمالك', category: 'تسليم' }
  ];
  await supabase.from('general_project_items').insert(generalItems);
  console.log(`✓ Inserted ${generalItems.length} general project items`);

  // 2. Clients (14 clients)
  console.log('--- 2. SEEDING CLIENTS (14 CLIENTS) ---');
  const clients = [
    { id: ID_MAP.CLIENT_ASHMILA, name: 'محمد اشميلة', phone: '0912345678', email: 'm.ashmila@zliten.ly', city: 'زليتن', address: 'زليتن — وسط المدينة', notes: 'عميل استراتيجي — مشاريع مقاولات وتشطيبات ومسجد الرحمة' },
    { id: ID_MAP.CLIENT_QRATEM, name: 'عبدالملك قراطم', phone: '0923456789', email: 'a.qratem@gmail.com', city: 'زليتن', address: 'زليتن — طريق الجمعة', notes: 'عميل مميز — فيلا سكنية ومشروع تشطيبات راقية' },
    { id: ID_MAP.CLIENT_TARHUNI, name: 'محمود سالم الترهوني', phone: '0914567890', email: 'm.tarhuni@outlook.com', city: 'زليتن', address: 'زليتن — كعام', notes: 'مالك فيلا واستراحة سكنية' },
    { id: ID_MAP.CLIENT_OMRAN, name: 'علي مفتاح بن عمران', phone: '0925678901', email: 'omran.ali@yahoo.com', city: 'زليتن', address: 'زليتن — المنارة', notes: 'مالك عمارة تجارية وسكنية' },
    { id: ID_MAP.CLIENT_SALAH, name: 'د. صلاح الدين الزليطني', phone: '0916789012', email: 'dr.salah@alshifa.ly', city: 'زليتن', address: 'زليتن — حي الأطباء', notes: 'مالك عيادة الشفاء واستراحة كعام' },
    { id: ID_MAP.CLIENT_BAKKOUSH, name: 'أيمن عبدالله البكوش', phone: '0927890123', email: 'ayman.bakkoush@gmail.com', city: 'زليتن', address: 'زليتن — الطريق الساحلي', notes: 'مالك صالة عرض ومخازن' },
    { id: ID_MAP.CLIENT_FITOURI, name: 'خالد عمر الفيتوري', phone: '0918901234', email: 'khalid.fitouri@gmail.com', city: 'زليتن', address: 'زليتن — زدو', notes: 'مالك مزرعة ومبنى سكني' },
    { id: ID_MAP.CLIENT_MUNTASIR, name: 'مصطفى رمضان المنتصر', phone: '0929012345', email: 'm.muntasir@hotmail.com', city: 'زليتن', address: 'زليتن — سوق الثلاثاء', notes: 'مالك قاعة مناسبات وصالات مناسبات' },
    { id: ID_MAP.CLIENT_JAMAL, name: 'عبدالسلام علي الجمل', phone: '0913334455', email: 'a.eljamal@gmail.com', city: 'زليتن', address: 'زليتن — البازة', notes: 'مالك مجمع سكني ومخزن تجاري' },
    { id: ID_MAP.CLIENT_ABUGHALIA, name: 'سالم مفتاح أبوغالية', phone: '0924445566', email: 'salem.abughalia@yahoo.com', city: 'زليتن', address: 'زليتن — أبو رقية', notes: 'مالك محطة خدمات ومكاتب' },
    { id: ID_MAP.CLIENT_OFOK, name: 'شركة الأفق للاستثمار العقاري', phone: '0915556677', email: 'info@alofok.ly', city: 'زليتن', address: 'زليتن — المجمع التجاري', notes: 'شركة تطوير عقاري — عمارات ومكاتب ومخازن' },
    { id: ID_MAP.CLIENT_SAHEL, name: 'شركة الساحل للمقاولات العامة', phone: '0926667788', email: 'contact@sahel-co.ly', city: 'زليتن', address: 'زليتن — المنطقة الصناعية', notes: 'شركة مقاولات وتجهيز مطاعم ومقرات' },
    { id: ID_MAP.CLIENT_NAMAA, name: 'شركة النماء للتطوير العقاري', phone: '0917778899', email: 'admin@alnamaa.ly', city: 'زليتن', address: 'زليتن — الدائري الثاني', notes: 'تطوير مدارس ومرافق تعليمية خاصة' },
    { id: ID_MAP.CLIENT_ZLITEN, name: 'مؤسسة زليتن للخدمات العامة', phone: '0928889900', email: 'info@zliten-services.org', city: 'زليتن', address: 'زليتن — البلدية القديمة', notes: 'مؤسسة خدمية واجتماعية' }
  ];
  await supabase.from('clients').insert(clients);
  console.log(`✓ Inserted ${clients.length} clients`);

  // 3. Suppliers (12 suppliers)
  console.log('--- 3. SEEDING SUPPLIERS (12 SUPPLIERS) ---');
  const suppliers = [
    { id: ID_MAP.SUP_WARED, name: 'مؤسسة الوارد لمواد البناء والخرسانة', phone: '0911112233', address: 'زليتن — الطريق الدائري', notes: 'إسمنت، حديد تسليح، خرسانة جاهزة، حصى ورمل' },
    { id: ID_MAP.SUP_BONYAN, name: 'شركة البنيان للإسمنت والحديد', phone: '0922223344', address: 'زليتن — طريق الميناء', notes: 'وكيل حديد التسليح والإسمنت المكيس' },
    { id: ID_MAP.SUP_SAHEL, name: 'مخزن الساحل للرمل والركام', phone: '0913334455', address: 'زليتن — كعام', notes: 'رمل سيليكا مغسول وحصى متدرج وركام' },
    { id: ID_MAP.SUP_MARBLE, name: 'شركة زليتن للرخام والسيراميك', phone: '0924445566', address: 'زليتن — وسط المدينة', notes: 'سيراميك إسباني وبورسلين ورخام إيطالي وتريستا' },
    { id: ID_MAP.SUP_ELITE, name: 'مؤسسة النخبة للمواد الكهربائية', phone: '0915556677', address: 'زليتن — شارع المدارس', notes: 'كابلات سويدي، قواطع شنايدر، سبوتات وليدات وإنارة سمارت' },
    { id: ID_MAP.SUP_AMAN, name: 'شركة الأمان للأدوات الصحية والسباكة', phone: '0926667788', address: 'زليتن — طريق الجمعة', notes: 'مواسير حرارية PPR، أطقم حمامات، خلاطات غروهي، مضخات' },
    { id: ID_MAP.SUP_EMAN, name: 'مؤسسة الإعمار لقطاعات الألمنيوم والزجاج', phone: '0917778899', address: 'زليتن — المنطقة الصناعية', notes: 'قطاعات ألمنيوم خاصة، زجاج دبل جلاس سيكوريت، إكسسوارات إيطالية' },
    { id: ID_MAP.SUP_WEFAQ, name: 'شركة الوفاق للدهانات ومواد الديكور', phone: '0928889900', address: 'زليتن — شارع التحرير', notes: 'وكيل دهانات جوتن، معاجين، عوازل مائية وجبس بورد كناوف' },
    { id: ID_MAP.SUP_MADAR, name: 'مؤسسة المدار لتأجير المعدات الثقيلة', phone: '0919990011', address: 'زليتن — الطريق الساحلي', notes: 'خلاطات، مضخات خرسانة، روافع، سقالات ومولدات ديزل' },
    { id: ID_MAP.SUP_BLOCK, name: 'مصنع زليتن للبلوك والمنتجات الأسمنتية', phone: '0920001122', address: 'زليتن — زدو', notes: 'طوب أسمنتي مفرغ 20 سم و15 سم وبلدورات وإنترلوك' },
    { id: ID_MAP.SUP_SALAM, name: 'ورشة السلام للأبواب والنجارة', phone: '0911223344', address: 'زليتن — طريق الفندق', notes: 'أبواب خشب سويدي وقشرة طبيعية وديكورات خشبية' },
    { id: ID_MAP.SUP_DEQQA, name: 'مؤسسة الدقة للتكييف والتهوية المركزية', phone: '0922334455', address: 'زليتن — شارع عمر المختار', notes: 'دكتات تكييف مركزي، مكيفات سبليت، فلاتر ومراوح تهوية' }
  ];
  await supabase.from('suppliers').insert(suppliers);
  console.log(`✓ Inserted ${suppliers.length} suppliers`);

  // 4. Technicians (19 technicians)
  console.log('--- 4. SEEDING TECHNICIANS (19 TECHNICIANS) ---');
  const technicians = [
    { id: ID_MAP.TECH_AHMED, name: 'أحمد مصطفى محمود', phone: '0914112233', daily_rate: 120, technician_type_id: '6675d29a-6011-4496-8dca-52f24850af17', notes: 'كهربائي عام وتأسيس شبكات — مصري (خبرة 12 سنة)' },
    { id: ID_MAP.TECH_MAHMOUD, name: 'محمود عبدالفتاح حسن', phone: '0924223344', daily_rate: 110, technician_type_id: '2fb2668b-696c-4863-bfa9-d7413af46940', notes: 'فني تركيب سيراميك ورخام وبورسلين — مصري (خبرة 10 سنوات)' },
    { id: ID_MAP.TECH_IBRAHIM, name: 'إبراهيم السيد علي', phone: '0914334455', daily_rate: 100, technician_type_id: 'b116caf3-e3ed-4119-b0db-2b84c283e80f', notes: 'سباك صحي وتمديدات مياه وصرف — مصري (خبرة 9 سنوات)' },
    { id: ID_MAP.TECH_SAMEH, name: 'سامح جلال عبدالمجيد', phone: '0924445566', daily_rate: 130, technician_type_id: '3936cd2b-4845-4e35-a6c0-494950ccc3e0', notes: 'نجار مسلح وقوالب خرسانية — مصري (خبرة 14 سنة)' },
    { id: ID_MAP.TECH_TAREK, name: 'طارق فتحي الدسوقي', phone: '0914556677', daily_rate: 95, technician_type_id: 'f375c1ca-3807-47ea-94e6-e67c72ce404b', notes: 'معلم دهانات داخلية وخارجية — مصري (خبرة 8 سنوات)' },
    { id: ID_MAP.TECH_ADAM, name: 'محمد آدم عثمان', phone: '0925112233', daily_rate: 80, technician_type_id: '7aa0a18a-993d-419a-a492-3596a854266e', notes: 'بناء بلوك وقواطع ومصنعيات — سوداني (خبرة 7 سنوات)' },
    { id: ID_MAP.TECH_TAYEB, name: 'الطيب الفاضل عبدالكريم', phone: '0915223344', daily_rate: 75, technician_type_id: 'e2383a1d-f673-46bb-a223-cc6f20c66bf2', notes: 'مساعد موقع وتحميل وصب خرسانة — سوداني (خبرة 5 سنوات)' },
    { id: ID_MAP.TECH_HAMED, name: 'عبدالرحمن حامد إدريس', phone: '0925334455', daily_rate: 90, technician_type_id: 'f375c1ca-3807-47ea-94e6-e67c72ce404b', notes: 'دهان واجهات وسقالات — سوداني (خبرة 6 سنوات)' },
    { id: ID_MAP.TECH_OTHMAN, name: 'عثمان موسى زكريا', phone: '0915445566', daily_rate: 105, technician_type_id: '7841a51f-8dc3-4924-8f12-af123abddaec', notes: 'حداد تسليح وقص وثني حديد — سوداني (خبرة 9 سنوات)' },
    { id: ID_MAP.TECH_YOUSSEF, name: 'يوسف جمعة يعقوب', phone: '0925556677', daily_rate: 85, technician_type_id: 'd415717b-8919-4cb5-b461-7589d81d2a10', notes: 'عامل موقع وتشغيل خلاطات — سوداني (خبرة 6 سنوات)' },
    { id: ID_MAP.TECH_KHALED, name: 'خالد محمود العلي', phone: '0916112233', daily_rate: 140, technician_type_id: 'fa0333ae-1b61-431c-830b-612edae663a0', notes: 'فني جبس بورد وديكورات فرنسية معلقة — سوري (خبرة 15 سنة)' },
    { id: ID_MAP.TECH_OMAR, name: 'عمر فاروق الشامي', phone: '0926223344', daily_rate: 150, technician_type_id: '6675d29a-6011-4496-8dca-52f24850af17', notes: 'فني تمديدات كهرباء ذكية وأنظمة سمارت — سوري (خبرة 11 سنة)' },
    { id: ID_MAP.TECH_BASHAR, name: 'بشار نزار الدالاتي', phone: '0916334455', daily_rate: 135, technician_type_id: 'b6508b4d-2e63-49bd-858b-8caecb62cb07', notes: 'فني تكييف مركزي ودكتات وتهوية — سوري (خبرة 13 سنة)' },
    { id: ID_MAP.TECH_MAJD, name: 'مجد مروان حموي', phone: '0926445566', daily_rate: 125, technician_type_id: 'f375c1ca-3807-47ea-94e6-e67c72ce404b', notes: 'فني دهانات ديكورية ومخملية وروشن — سوري (خبرة 10 سنوات)' },
    { id: ID_MAP.TECH_WASIM, name: 'وسيم عدنان الحلبي', phone: '0916556677', daily_rate: 130, technician_type_id: '1ea3bd9e-793d-4171-8bb3-a9081f870b74', notes: 'فني ألمنيوم وزجاج سيكوريت وواجهات — سوري (خبرة 12 سنة)' },
    { id: ID_MAP.TECH_FARJANI, name: 'عبدالرحيم محمد الفرجاني', phone: '0927112233', daily_rate: 115, technician_type_id: '7aa0a18a-993d-419a-a492-3596a854266e', notes: 'معلم بناء ولياسة تقليدية وممسوسة — ليبي (خبرة 14 سنة)' },
    { id: ID_MAP.TECH_KHALIL, name: 'فرج سالم بن خليل', phone: '0917223344', daily_rate: 120, technician_type_id: '7841a51f-8dc3-4924-8f12-af123abddaec', notes: 'حداد معمارية وهياكل ومظلات — ليبي (خبرة 10 سنوات)' },
    { id: ID_MAP.TECH_QADI, name: 'مراد خليفة القاضي', phone: '0927334455', daily_rate: 110, technician_type_id: 'b116caf3-e3ed-4119-b0db-2b84c283e80f', notes: 'فني تمديدات سباكة رئيسية وغرف تفتيش — ليبي (خبرة 8 سنوات)' },
    { id: ID_MAP.TECH_HMIDA, name: 'جمعة عبدالهادي احميدة', phone: '0917445566', daily_rate: 100, technician_type_id: 'b6508b4d-2e63-49bd-858b-8caecb62cb07', notes: 'فني عزل مائي وحراري وممبرين — ليبي (خبرة 9 سنوات)' }
  ];
  await supabase.from('technicians').upsert(technicians);
  console.log(`✓ Inserted ${technicians.length} technicians`);

  // 5. Engineers & Employees
  console.log('--- 5. SEEDING ENGINEERS AND EMPLOYEES ---');
  const engineers = [
    { id: 'e1000000-0000-0000-0000-000000000001', name: 'م. عمر سالم التومي', phone: '0919001122', email: 'o.toumi@goldenknight.ly', specialization: 'مهندس إنشائي ومدني — إشراف عام' },
    { id: 'e1000000-0000-0000-0000-000000000002', name: 'م. سارة كمال بن غشير', phone: '0929002233', email: 's.benghshir@goldenknight.ly', specialization: 'مهندسة معمارية وتصميم ديكور داخلي' },
    { id: 'e1000000-0000-0000-0000-000000000003', name: 'م. هيثم عبدالسلام كشير', phone: '0919003344', email: 'h.kasheer@goldenknight.ly', specialization: 'مهندس كهروميكانيك وأنظمة تكييف' },
    { id: 'e1000000-0000-0000-0000-000000000004', name: 'م. طارق رمضان الزواوي', phone: '0929004455', email: 't.zawawi@goldenknight.ly', specialization: 'مهندس جودة ومكتب فني ومقايسات' }
  ];
  await supabase.from('engineers').insert(engineers);

  const employees = [
    { id: 'e2000000-0000-0000-0000-000000000001', name: 'عادل مفتاح الراجحي', phone: '0918001122', email: 'a.rajhi@goldenknight.ly', position: 'مدير مشاريع وتنفيذ', salary: 3500 },
    { id: 'e2000000-0000-0000-0000-000000000002', name: 'فوزي رمضان الهوش', phone: '0928002233', email: 'f.housh@goldenknight.ly', position: 'محاسب مالي أول', salary: 2800 },
    { id: 'e2000000-0000-0000-0000-000000000003', name: 'صالح بشير احميدة', phone: '0918003344', email: 's.ahmida@goldenknight.ly', position: 'أمين مخازن وتشوين', salary: 2000 },
    { id: 'e2000000-0000-0000-0000-000000000004', name: 'عبدالباسط عمر الورفلي', phone: '0928004455', email: 'a.werfelli@goldenknight.ly', position: 'مسؤول مشتريات وتوريدات', salary: 2200 }
  ];
  await supabase.from('employees').insert(employees);
  console.log(`✓ Inserted ${engineers.length} engineers and ${employees.length} employees`);

  // 6. Projects (16 Projects)
  console.log('--- 6. SEEDING 16 PROJECTS ---');
  const projects = [
    { id: ID_MAP.PROJ_MOSQUE, name: 'إنشاء مسجد الرحمة', client_id: ID_MAP.CLIENT_ASHMILA, project_type: 'contracting', supervision_mode: 'percentage', finishing_percentage: 0, status: 'in_progress', progress: 65, budget: 320000, spent: 185000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2026-01-01', end_date: '2026-11-30', description: 'مشروع إنشاء مسجد متكامل شامل المصلى والقبة والمئذنة والمرافق الصحية والوضوء — زليتن وسط المدينة' },
    { id: ID_MAP.PROJ_QRATEM_VILLA, name: 'إنشاء منزل عبدالملك قراطم', client_id: ID_MAP.CLIENT_QRATEM, project_type: 'contracting', supervision_mode: 'direct', finishing_percentage: 0, status: 'in_progress', progress: 40, budget: 240000, spent: 96000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2026-02-15', end_date: '2026-12-31', description: 'فيلا سكنية دورين وملحق مع السور الخارجي وخزان مياه أرضي — زليتن طريق الجمعة' },
    { id: ID_MAP.PROJ_ASHMILA_VILLA, name: 'إنشاء منزل محمد اشميلة', client_id: ID_MAP.CLIENT_ASHMILA, project_type: 'contracting', supervision_mode: 'direct', finishing_percentage: 0, status: 'in_progress', progress: 25, budget: 210000, spent: 52000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2026-03-01', end_date: '2027-01-15', description: 'إنشاء عظم هيكل خرساني ومباني لفيلا سكنية خاصة — زليتن حي السلام' },
    { id: ID_MAP.PROJ_OFOK_BLDG, name: 'إنشاء عمارة الأفق السكنية', client_id: ID_MAP.CLIENT_OFOK, project_type: 'contracting', supervision_mode: 'percentage', finishing_percentage: 0, status: 'in_progress', progress: 80, budget: 580000, spent: 460000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2025-09-01', end_date: '2026-09-30', description: 'عمارة سكنية وتجارية 5 طوابق مع محلات تجارية بالطابق الأرضي — زليتن الطريق الساحلي' },
    { id: ID_MAP.PROJ_WAREHOUSE, name: 'إنشاء مخزن تجاري متكامل', client_id: ID_MAP.CLIENT_OFOK, project_type: 'contracting', supervision_mode: 'direct', finishing_percentage: 0, status: 'in_progress', progress: 50, budget: 180000, spent: 88000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2026-02-01', end_date: '2026-08-30', description: 'مخزن جملة بهيكل معدني وقواعد خرسانية وأرضيات هليكوبتر — المنطقة الصناعية زليتن' },
    { id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'إنشاء فيلا سالم الترهوني', client_id: ID_MAP.CLIENT_TARHUNI, project_type: 'contracting', supervision_mode: 'direct', finishing_percentage: 0, status: 'in_progress', progress: 15, budget: 260000, spent: 38000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2026-04-01', end_date: '2027-03-31', description: 'فيلا طابقين وسور خارجي وحوض سباحة — كعام زليتن' },
    { id: ID_MAP.PROJ_SAHEL_HQ, name: 'إنشاء مقر شركة الساحل', client_id: ID_MAP.CLIENT_SAHEL, project_type: 'contracting', supervision_mode: 'percentage', finishing_percentage: 0, status: 'in_progress', progress: 90, budget: 420000, spent: 375000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2025-10-15', end_date: '2026-07-31', description: 'مبنى إداري لشركة الساحل 3 طوابق مع واجهات زجاجية ومواقف سيارات — زليتن' },
    { id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'إنشاء مدرسة النماء الخاصة', client_id: ID_MAP.CLIENT_NAMAA, project_type: 'contracting', supervision_mode: 'direct', finishing_percentage: 0, status: 'completed', progress: 100, budget: 350000, spent: 345000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2025-06-01', end_date: '2026-05-31', description: 'مبنى تعليمي من 12 فصلاً دراسياً مع المكاتب الإدارية والساحة — زليتن الدائري الثاني' },
    { id: ID_MAP.PROJ_KAAM_REST, name: 'إنشاء استراحة كعام العائلية', client_id: ID_MAP.CLIENT_SALAH, project_type: 'contracting', supervision_mode: 'direct', finishing_percentage: 0, status: 'in_progress', progress: 10, budget: 150000, spent: 16000, default_treasury_id: ID_MAP.TREASURY_CONTRACTING, start_date: '2026-05-01', end_date: '2027-02-28', description: 'استراحة عائلية متكاملة مع المسطحات الخضراء والخدمات — منطقة كعام' },

    // Finishing
    { id: ID_MAP.PROJ_ASHMILA_FIN, name: 'تشطيب منزل محمد اشميلة', client_id: ID_MAP.CLIENT_ASHMILA, project_type: 'finishing', supervision_mode: 'percentage', finishing_percentage: 12, status: 'in_progress', progress: 60, budget: 85000, spent: 51000, default_treasury_id: ID_MAP.TREASURY_FINISHING, start_date: '2026-02-01', end_date: '2026-09-30', description: 'تشطيب داخلي وخارجي ديكوري فاخر بنظام التكلفة + 12% إشراف — زليتن' },
    { id: ID_MAP.PROJ_QRATEM_FIN, name: 'تشطيب فيلا عبدالملك قراطم', client_id: ID_MAP.CLIENT_QRATEM, project_type: 'finishing', supervision_mode: 'percentage', finishing_percentage: 15, status: 'in_progress', progress: 45, budget: 95000, spent: 42000, default_treasury_id: ID_MAP.TREASURY_FINISHING, start_date: '2026-03-15', end_date: '2026-11-30', description: 'تشطيبات راقية وأسقف جبسية وبورسلين إسباني بنظام Cost-Plus 15% — زليتن' },
    { id: ID_MAP.PROJ_SHIFA_CLINIC, name: 'تجهيز وتشطيب عيادة الشفاء التخصصية', client_id: ID_MAP.CLIENT_SALAH, project_type: 'finishing', supervision_mode: 'percentage', finishing_percentage: 10, status: 'in_progress', progress: 85, budget: 120000, spent: 102000, default_treasury_id: ID_MAP.TREASURY_FINISHING, start_date: '2025-11-01', end_date: '2026-07-31', description: 'تشطيب عيادات طبية متخصصة ومختبرات مع أرضيات فينيل مضاد للبكتيريا بنظام 10% إشراف' },
    { id: ID_MAP.PROJ_SAHEL_RESTO, name: 'تشطيب مطعم واستراحة الساحل', client_id: ID_MAP.CLIENT_SAHEL, project_type: 'finishing', supervision_mode: 'percentage', finishing_percentage: 12, status: 'in_progress', progress: 70, budget: 110000, spent: 77000, default_treasury_id: ID_MAP.TREASURY_FINISHING, start_date: '2026-01-10', end_date: '2026-08-15', description: 'تشطيبات سياحية وديكورات خشبية ومطابخ صناعية بموجب عقد Cost-Plus 12%' },
    { id: ID_MAP.PROJ_OFOK_OFFICE, name: 'تشطيب وتجهيز مكاتب الأفق الإدارية', client_id: ID_MAP.CLIENT_OFOK, project_type: 'finishing', supervision_mode: 'percentage', finishing_percentage: 10, status: 'completed', progress: 100, budget: 65000, spent: 64000, default_treasury_id: ID_MAP.TREASURY_FINISHING, start_date: '2025-08-01', end_date: '2026-03-31', description: 'تشطيب مكاتب إدارية وقواطع زجاجية وأسقف مستعارة بنسبة 10% — مكتمل ومسلم' },
    { id: ID_MAP.PROJ_HALL_FIN, name: 'تشطيب قاعة المناسبات الكبرى', client_id: ID_MAP.CLIENT_MUNTASIR, project_type: 'finishing', supervision_mode: 'percentage', finishing_percentage: 15, status: 'in_progress', progress: 30, budget: 140000, spent: 42000, default_treasury_id: ID_MAP.TREASURY_FINISHING, start_date: '2026-03-01', end_date: '2026-12-15', description: 'تشطيب صالات أفراح وثريات وأنظمة إضاءة وصوتيات مدمجة بنسبة 15%' },
    { id: ID_MAP.PROJ_SHOWROOM_FIN, name: 'تشطيب صالة عرض سيارات ومعدات', client_id: ID_MAP.CLIENT_BAKKOUSH, project_type: 'finishing', supervision_mode: 'percentage', finishing_percentage: 10, status: 'in_progress', progress: 20, budget: 75000, spent: 15000, default_treasury_id: ID_MAP.TREASURY_FINISHING, start_date: '2026-04-15', end_date: '2026-10-31', description: 'تشطيب واجهات كارتن وول وأرضيات إيبوكسي عالية المقاومة بنسبة 10%' }
  ];
  await supabase.from('projects').insert(projects);
  console.log(`✓ Inserted ${projects.length} projects`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
