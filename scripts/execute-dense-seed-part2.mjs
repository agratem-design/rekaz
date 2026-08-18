import { supabase } from './financial-tests/client.mjs';
import { ID_MAP } from './seed-ids.mjs';

async function main() {
  console.log('--- SEEDING REMAINING PROJECT PHASES FOR ALL 16 PROJECTS ---');

  const additionalPhases = [
    // Warehouse (5 phases)
    { id: '01000000-0000-0000-0000-000000000056', project_id: ID_MAP.PROJ_WAREHOUSE, name: 'الحفر وتسوية الأرضيات والقواعد', order_index: 1, status: 'completed', start_date: '2026-02-01', end_date: '2026-02-28', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000057', project_id: ID_MAP.PROJ_WAREHOUSE, name: 'القواعد الخرسانية وصب أرضيات الهليكوبتر', order_index: 2, status: 'completed', start_date: '2026-03-01', end_date: '2026-04-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000058', project_id: ID_MAP.PROJ_WAREHOUSE, name: 'توريد وتركيب الهيكل المعدني والجمالونات', order_index: 3, status: 'in_progress', start_date: '2026-04-16', end_date: '2026-06-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000059', project_id: ID_MAP.PROJ_WAREHOUSE, name: 'تغطية الساندوتش بانل وأبواب الرول الهيدروليكية', order_index: 4, status: 'pending', start_date: '2026-06-16', end_date: '2026-07-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000060', project_id: ID_MAP.PROJ_WAREHOUSE, name: 'الإنارة الصناعية وشبكة الإطفاء والتسليم', order_index: 5, status: 'pending', start_date: '2026-08-01', end_date: '2026-08-30', treasury_id: ID_MAP.TREASURY_CONTRACTING },

    // Tarhuni Villa (7 phases)
    { id: '01000000-0000-0000-0000-000000000061', project_id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'تجهيز الموقع والحفر وتسوية المنسوب', order_index: 1, status: 'completed', start_date: '2026-04-01', end_date: '2026-04-20', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000062', project_id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'القواعد الخرسانية المسلحة والميد', order_index: 2, status: 'in_progress', start_date: '2026-04-21', end_date: '2026-06-10', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000063', project_id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'أعمدة وسقف الدور الأرضي', order_index: 3, status: 'pending', start_date: '2026-06-11', end_date: '2026-08-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000064', project_id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'أعمدة وسقف الدور الأول والملحق', order_index: 4, status: 'pending', start_date: '2026-08-16', end_date: '2026-10-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000065', project_id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'أعمال مباني الطوب والتقسيم الداخلي', order_index: 5, status: 'pending', start_date: '2026-11-01', end_date: '2026-12-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000066', project_id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'السور الخارجي وخزان المياه والمسبح', order_index: 6, status: 'pending', start_date: '2027-01-01', end_date: '2027-02-28', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000067', project_id: ID_MAP.PROJ_TARHUNI_VILLA, name: 'التسليم الإنشائي الابتدائي', order_index: 7, status: 'pending', start_date: '2027-03-01', end_date: '2027-03-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },

    // Sahel HQ (8 phases)
    { id: '01000000-0000-0000-0000-000000000068', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'الحفر والأعمال الترابية وسند الجوانب', order_index: 1, status: 'completed', start_date: '2025-10-15', end_date: '2025-11-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000069', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'القواعد والأساسات المسلحة', order_index: 2, status: 'completed', start_date: '2025-11-16', end_date: '2025-12-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000070', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'الهيكل الخرساني للأدوار الثلاثة', order_index: 3, status: 'completed', start_date: '2026-01-01', end_date: '2026-03-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000071', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'أعمال المباني والعوازل والتقسيم الإداري', order_index: 4, status: 'completed', start_date: '2026-04-01', end_date: '2026-05-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000072', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'الشبكات الكهروميكانيكية وشبكات البيانات', order_index: 5, status: 'completed', start_date: '2026-05-16', end_date: '2026-06-30', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000073', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'تركيب الواجهات الزجاجية والكلادينج', order_index: 6, status: 'in_progress', start_date: '2026-06-15', end_date: '2026-07-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000074', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'اللياسة والدهانات والتشطيبات النهائية', order_index: 7, status: 'in_progress', start_date: '2026-07-01', end_date: '2026-07-25', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000075', project_id: ID_MAP.PROJ_SAHEL_HQ, name: 'التسليم النهائي وتدشين المقر', order_index: 8, status: 'pending', start_date: '2026-07-26', end_date: '2026-07-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },

    // Namaa School (8 phases - ALL COMPLETED)
    { id: '01000000-0000-0000-0000-000000000076', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'الحفر والتسوية وتجهيز الموقع', order_index: 1, status: 'completed', start_date: '2025-06-01', end_date: '2025-06-25', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000077', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'القواعد والأساسات الخرسانية المقاومة للأملاح', order_index: 2, status: 'completed', start_date: '2025-06-26', end_date: '2025-08-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000078', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'الهيكل الخرساني للأجنحة التعليمية والإدارة', order_index: 3, status: 'completed', start_date: '2025-08-16', end_date: '2025-11-30', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000079', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'أعمال مباني الفصول الدراسية والمختبرات', order_index: 4, status: 'completed', start_date: '2025-12-01', end_date: '2026-01-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000080', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'التمديدات الكهربائية وشبكات الإنذار والمياه', order_index: 5, status: 'completed', start_date: '2026-02-01', end_date: '2026-03-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000081', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'اللياسة والدهانات والأرضيات والأبواب', order_index: 6, status: 'completed', start_date: '2026-04-01', end_date: '2026-05-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000082', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'تجهيز الساحة المدرسية والملاعب والأسوار', order_index: 7, status: 'completed', start_date: '2026-05-01', end_date: '2026-05-25', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000083', project_id: ID_MAP.PROJ_NAMAA_SCHOOL, name: 'الفحص النهائي والتسليم والاعتماد التعليمي', order_index: 8, status: 'completed', start_date: '2026-05-26', end_date: '2026-05-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },

    // Kaam Rest (6 phases)
    { id: '01000000-0000-0000-0000-000000000084', project_id: ID_MAP.PROJ_KAAM_REST, name: 'تسوية الموقع والأعمال الترابية وتحديد المناسيب', order_index: 1, status: 'completed', start_date: '2026-05-01', end_date: '2026-05-20', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000085', project_id: ID_MAP.PROJ_KAAM_REST, name: 'القواعد والأساسات وسور الاستراحة', order_index: 2, status: 'in_progress', start_date: '2026-05-21', end_date: '2026-07-15', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000086', project_id: ID_MAP.PROJ_KAAM_REST, name: 'هيكل المبنى السكني وصالة الاستقبال', order_index: 3, status: 'pending', start_date: '2026-07-16', end_date: '2026-09-30', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000087', project_id: ID_MAP.PROJ_KAAM_REST, name: 'أعمال المباني والعزل المائي للمسبح', order_index: 4, status: 'pending', start_date: '2026-10-01', end_date: '2026-11-30', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000088', project_id: ID_MAP.PROJ_KAAM_REST, name: 'الشبكات والري والكهرباء والإنارة الخارجية', order_index: 5, status: 'pending', start_date: '2026-12-01', end_date: '2027-01-31', treasury_id: ID_MAP.TREASURY_CONTRACTING },
    { id: '01000000-0000-0000-0000-000000000089', project_id: ID_MAP.PROJ_KAAM_REST, name: 'التشطيبات والتسليم النهائي', order_index: 6, status: 'pending', start_date: '2027-02-01', end_date: '2027-02-28', treasury_id: ID_MAP.TREASURY_CONTRACTING },

    // Finishing: Sahel Restaurant (6 phases)
    { id: '01000000-0000-0000-0000-000000000090', project_id: ID_MAP.PROJ_SAHEL_RESTO, name: 'التجهيز واعتماد التصاميم السياحية', order_index: 1, status: 'completed', start_date: '2026-01-10', end_date: '2026-01-31', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000091', project_id: ID_MAP.PROJ_SAHEL_RESTO, name: 'تأسيس تكييف وشفاطات المطابخ الصناعية والغاز', order_index: 2, status: 'completed', start_date: '2026-02-01', end_date: '2026-03-20', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000092', project_id: ID_MAP.PROJ_SAHEL_RESTO, name: 'أعمال السيراميك الصناعي والأسقف الديكورية', order_index: 3, status: 'completed', start_date: '2026-03-21', end_date: '2026-05-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000093', project_id: ID_MAP.PROJ_SAHEL_RESTO, name: 'الديكورات الخشبية والإنارة المخفية والواجهات', order_index: 4, status: 'in_progress', start_date: '2026-05-16', end_date: '2026-07-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000094', project_id: ID_MAP.PROJ_SAHEL_RESTO, name: 'تركيب معدات المطابخ والبار والفرش', order_index: 5, status: 'pending', start_date: '2026-07-16', end_date: '2026-08-05', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000095', project_id: ID_MAP.PROJ_SAHEL_RESTO, name: 'التشغيل التجريبي والافتتاح الرسمي', order_index: 6, status: 'pending', start_date: '2026-08-06', end_date: '2026-08-15', treasury_id: ID_MAP.TREASURY_FINISHING },

    // Finishing: Ofok Offices (6 phases - ALL COMPLETED)
    { id: '01000000-0000-0000-0000-000000000096', project_id: ID_MAP.PROJ_OFOK_OFFICE, name: 'التجهيز ومطابقة المخططات التنفيذية', order_index: 1, status: 'completed', start_date: '2025-08-01', end_date: '2025-08-20', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000097', project_id: ID_MAP.PROJ_OFOK_OFFICE, name: 'تمديد شبكات الكهرباء والبيانات والسنترال', order_index: 2, status: 'completed', start_date: '2025-08-21', end_date: '2025-10-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000098', project_id: ID_MAP.PROJ_OFOK_OFFICE, name: 'القواطع الزجاجية سيكوريت والأسقف المستعارة', order_index: 3, status: 'completed', start_date: '2025-10-16', end_date: '2025-12-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000099', project_id: ID_MAP.PROJ_OFOK_OFFICE, name: 'أرضيات الفينيل والباركيه والدهانات الحريرية', order_index: 4, status: 'completed', start_date: '2025-12-16', end_date: '2026-01-31', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000100', project_id: ID_MAP.PROJ_OFOK_OFFICE, name: 'تركيب وحدات الإنارة والمكيفات والأبواب الذكية', order_index: 5, status: 'completed', start_date: '2026-02-01', end_date: '2026-03-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000101', project_id: ID_MAP.PROJ_OFOK_OFFICE, name: 'التنظيف والتسليم النهائي للمكاتب', order_index: 6, status: 'completed', start_date: '2026-03-16', end_date: '2026-03-31', treasury_id: ID_MAP.TREASURY_FINISHING },

    // Finishing: Grand Hall (6 phases)
    { id: '01000000-0000-0000-0000-000000000102', project_id: ID_MAP.PROJ_HALL_FIN, name: 'التجهيز واعتماد الثيمات الديكورية', order_index: 1, status: 'completed', start_date: '2026-03-01', end_date: '2026-03-25', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000103', project_id: ID_MAP.PROJ_HALL_FIN, name: 'تأسيس شبكات الصوتيات والإضاءة والمسارح', order_index: 2, status: 'completed', start_date: '2026-03-26', end_date: '2026-05-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000104', project_id: ID_MAP.PROJ_HALL_FIN, name: 'الهياكل المعلقة والأسقف الجبسية ثلاثية الأبعاد', order_index: 3, status: 'in_progress', start_date: '2026-05-16', end_date: '2026-07-31', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000105', project_id: ID_MAP.PROJ_HALL_FIN, name: 'الرخام الإيطالي للأرضيات والمداخل', order_index: 4, status: 'pending', start_date: '2026-08-01', end_date: '2026-09-30', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000106', project_id: ID_MAP.PROJ_HALL_FIN, name: 'الدهانات المخملية والثريات والكسوات', order_index: 5, status: 'pending', start_date: '2026-10-01', end_date: '2026-11-20', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000107', project_id: ID_MAP.PROJ_HALL_FIN, name: 'التسليم وتجربة أنظمة الحفلات', order_index: 6, status: 'pending', start_date: '2026-11-21', end_date: '2026-12-15', treasury_id: ID_MAP.TREASURY_FINISHING },

    // Finishing: Showroom (6 phases)
    { id: '01000000-0000-0000-0000-000000000108', project_id: ID_MAP.PROJ_SHOWROOM_FIN, name: 'التجهيز وإزالة الحواجز القائمة', order_index: 1, status: 'completed', start_date: '2026-04-15', end_date: '2026-05-05', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000109', project_id: ID_MAP.PROJ_SHOWROOM_FIN, name: 'تأسيس شبكة الكهرباء والسبوتات المعلقة', order_index: 2, status: 'in_progress', start_date: '2026-05-06', end_date: '2026-06-20', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000110', project_id: ID_MAP.PROJ_SHOWROOM_FIN, name: 'أرضيات إيبوكسي صناعية عالية التحمل', order_index: 3, status: 'pending', start_date: '2026-06-21', end_date: '2026-07-31', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000111', project_id: ID_MAP.PROJ_SHOWROOM_FIN, name: 'الواجهات الزجاجية الخارجية كارتن وول', order_index: 4, status: 'pending', start_date: '2026-08-01', end_date: '2026-09-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000112', project_id: ID_MAP.PROJ_SHOWROOM_FIN, name: 'الدهانات والديكورات وعلامات المعرض', order_index: 5, status: 'pending', start_date: '2026-09-16', end_date: '2026-10-15', treasury_id: ID_MAP.TREASURY_FINISHING },
    { id: '01000000-0000-0000-0000-000000000113', project_id: ID_MAP.PROJ_SHOWROOM_FIN, name: 'التسليم والافتتاح', order_index: 6, status: 'pending', start_date: '2026-10-16', end_date: '2026-10-31', treasury_id: ID_MAP.TREASURY_FINISHING }
  ];

  const { error } = await supabase.from('project_phases').insert(additionalPhases);
  if (error) throw new Error(`Additional phases failed: ${error.message}`);
  console.log(`✓ Inserted ${additionalPhases.length} additional project phases! Total phases across all 16 projects: ~110`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
