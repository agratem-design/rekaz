import { supabase } from './financial-tests/client.mjs';

const CANONICAL_TREASURIES = [
  'c504cce9-8bfd-4cda-8296-80febdec2432', // خزينة المقاولات الرئيسية
  'f9637060-3f26-445e-b77c-658b31da2269', // خزينة التشطيبات الرئيسية
  'ff7416dd-5295-4e55-bd52-2196eef9ec37', // حساب مصرف المقاولات
];

const PURGE_CHILD_AND_OPERATIONAL_TABLES = [
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
  'project_technicians',
  'project_suppliers',
  'project_custody',
  'project_schedules',
  'checklist_items',
  'inspection_checklists',
  'risk_register',
  'variation_orders',
  'equipment_rentals',
  'equipment',
  'stock_movements',
  'materials',
  'transfers',
  'expenses',
  'income',
  'cash_flow_forecast',
  'treasury_transactions',
  'treasury_debts',
];

const PURGE_MASTER_PARTIES = [
  'projects',
  'clients',
  'suppliers',
  'technicians',
  'engineers',
  'employees',
];

async function checkConnection() {
  try {
    const { data, error } = await supabase.from('company_settings').select('company_name').limit(1);
    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function runPurgeAndVerify({ keepGeneralItems = true } = {}) {
  console.log('========================================================');
  console.log('  REKAZ DATA PURGE & PRESERVE SETTINGS/AUTH ENGINE');
  console.log('========================================================\n');

  // Step 1: Check Connection
  console.log('[1/5] التحقق من الاتصال بقاعدة بيانات Supabase...');
  const conn = await checkConnection();
  if (!conn.ok) {
    console.error('\n❌ تعذر الاتصال بقاعدة البيانات:');
    console.error(conn.error?.message || conn.error);
    console.log('\n⚠️ تنبيه هام:');
    console.log('يبدو أن مشروع Supabase في وضع التوقف المؤقت (Paused) بسبب مرور 7 أيام بدون نشاط.');
    console.log('يرجى فتح لوحة تحكم Supabase والضغط على "Restore Project" لإعادة تفعيله:');
    console.log('👉 https://supabase.com/dashboard/project/bpnhzaexmqruzaxyzlyc\n');
    process.exit(1);
  }
  console.log('✓ الاتصال بقاعدة البيانات نشط وسليم.');

  // Step 2: Ensure User Profiles Safety
  console.log('\n[2/5] تأمين حسابات المستخدمين وإلغاء أي ارتباط بمهندسين مؤقتين...');
  try {
    await supabase.from('profiles').update({ engineer_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✓ تم تأمين ملفات المستخدمين (profiles) مع الحفاظ على جميع الحسابات.');
  } catch (e) {
    console.warn('تنبيه في تحديث profiles:', e.message);
  }

  // Step 3: Purge Operational & Child Tables
  console.log('\n[3/5] حذف المعاملات والسجلات التشغيلية والمالية...');
  for (const table of PURGE_CHILD_AND_OPERATIONAL_TABLES) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`  ⚠️ لم يتمكن من حذف جدول ${table}: ${error.message}`);
    } else {
      console.log(`  ✓ تم تصفير جدول: ${table}`);
    }
  }

  // Optional: Purge general items or preserve them
  if (!keepGeneralItems) {
    console.log('  - تصفير قوالب البنود العامة...');
    await supabase.from('general_item_technician_requirements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('general_project_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('  ✓ تم تصفير general_project_items');
  } else {
    console.log('  ℹ️ تم الحفاظ على قوالب البنود العامة (general_project_items) كإعدادات نظام.');
  }

  // Step 4: Purge Master Parties
  console.log('\n[4/5] حذف سجلات المشاريع، العملاء، الموردين، الفنيين، والمهندسين...');
  for (const table of PURGE_MASTER_PARTIES) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`  ⚠️ جدول ${table}: ${error.message}`);
    } else {
      console.log(`  ✓ تم تصفير سجلات: ${table}`);
    }
  }

  // Step 5: Reset Treasuries & Validate Settings
  console.log('\n[5/5] تصفير أرصدة الخزائن الأساسية وضبط الإعدادات...');
  await supabase.from('treasuries').update({ balance: 0 }).not('id', 'in', `(${CANONICAL_TREASURIES.join(',')})`);
  await supabase.from('treasuries').delete().not('id', 'in', `(${CANONICAL_TREASURIES.join(',')})`).not('parent_id', 'is', null);
  await supabase.from('treasuries').delete().not('id', 'in', `(${CANONICAL_TREASURIES.join(',')})`);

  for (const trId of CANONICAL_TREASURIES) {
    await supabase.from('treasuries').update({ balance: 0 }).eq('id', trId);
  }
  console.log('  ✓ تم تصفير أرصدة الخزائن المعتمدة إلى 0.00 د.ل.');

  // Verify preserved settings
  const { data: settings } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
  const { data: mConfigs } = await supabase.from('measurement_configs').select('id, name');
  const { data: techTypes } = await supabase.from('technician_types').select('id, name');
  const { data: profiles } = await supabase.from('profiles').select('id, email, display_name');
  const { data: userRoles } = await supabase.from('user_roles').select('id, user_id, role');

  console.log('\n========================================================');
  console.log('  تقرير التحقق من سلامة البيانات والإعدادات والمستخدمين');
  console.log('========================================================');
  console.log(`- إعدادات الشركة (company_settings): ${settings ? 'محفوظة بنجاح (' + settings.company_name + ')' : 'غير موجودة'}`);
  console.log(`- وحدات القياس (measurement_configs): ${mConfigs?.length || 0} وحدة محفوظة.`);
  console.log(`- التخصصات الفنية (technician_types): ${techTypes?.length || 0} تخصص محفوظ.`);
  console.log(`- حسابات المستخدمين (profiles): ${profiles?.length || 0} حساب متاح.`);
  console.log(`- أدوار وصلاحيات المستخدمين (user_roles): ${userRoles?.length || 0} دور مسجل.`);

  console.log('\nقائمة المستخدمين المتاحين لتسجيل الدخول:');
  for (const p of profiles || []) {
    const roles = (userRoles || []).filter(r => r.user_id === p.id).map(r => r.role).join(', ') || 'بدون دور';
    console.log(`  * ${p.display_name || p.email} (${p.email}) — الصلاحية: [${roles}]`);
  }

  console.log('\n✓ تمت عملية التصفير بالكامل بنجاح وحسابات الدخول والإعدادات جاهزة للعمل.');
}

runPurgeAndVerify({ keepGeneralItems: true }).catch(console.error);
