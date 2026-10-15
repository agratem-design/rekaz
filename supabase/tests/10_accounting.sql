-- ركاز v2 — اختبارات محاسبية وصلاحيات
-- كل اختبار يفشل فعلاً عند الخطأ (لا نتائج ثابتة). يُشغَّل على قاعدة اختبار فارغة.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- أدوات الاختبار
-- ---------------------------------------------------------------------------
create schema test;
grant usage on schema test to anon, authenticated;
create table test.results (n serial, name text, ok boolean, detail text);
grant insert, select on test.results to anon, authenticated;
grant usage on sequence test.results_n_seq to anon, authenticated;

create function test.eq(p_name text, p_actual numeric, p_expected numeric) returns void language plpgsql as $$
begin
  insert into test.results (name, ok, detail)
  values (p_name, p_actual is not distinct from p_expected, format('actual=%s expected=%s', p_actual, p_expected));
end $$;

create function test.ok(p_name text, p_cond boolean) returns void language plpgsql as $$
begin
  insert into test.results (name, ok, detail) values (p_name, coalesce(p_cond, false), null);
end $$;

-- يتوقع أن تفشل الجملة؛ ينجح الاختبار فقط إذا فشلت برسالة تطابق النمط
create function test.fails(p_name text, p_sql text, p_pattern text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    insert into test.results (name, ok, detail)
    values (p_name, p_pattern is null or sqlerrm ~ p_pattern, sqlerrm);
    return;
  end;
  insert into test.results (name, ok, detail) values (p_name, false, 'لم تفشل الجملة');
end $$;

create function test.bal(p_treasury uuid) returns numeric language sql as $$
  select balance from public.treasury_balances where treasury_id = p_treasury
$$;
grant execute on all functions in schema test to anon, authenticated;

-- ---------------------------------------------------------------------------
-- البيانات الأساسية (كمالك القاعدة)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x.ly', '{"username":"admin","display_name":"المدير"}'),
  ('00000000-0000-0000-0000-00000000000b', 'accountant@x.ly', '{"display_name":"المحاسب"}'),
  ('00000000-0000-0000-0000-00000000000c', 'engineer@x.ly', '{}');
select test.ok('A01 ملف شخصي تلقائي لكل حساب', (select count(*) from public.profiles) = 3);
select test.ok('A02 اسم المستخدم من البريد عند غيابه', exists (select 1 from public.profiles where username = 'accountant'));
insert into public.user_roles values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'accountant'),
  ('00000000-0000-0000-0000-00000000000c', 'engineer');

insert into public.treasuries (id, name, domain, kind) values
  ('10000000-0000-0000-0000-000000000001', 'خزينة المقاولات الرئيسية', 'contracting', 'cash'),
  ('10000000-0000-0000-0000-000000000003', 'خزينة التشطيبات الرئيسية', 'finishing', 'cash'),
  ('10000000-0000-0000-0000-000000000004', 'الخزينة العامة', 'general', 'cash');
insert into public.treasuries (id, name, domain, kind, parent_id, bank_name) values
  ('10000000-0000-0000-0000-000000000002', 'مصرف المقاولات', 'contracting', 'bank', '10000000-0000-0000-0000-000000000001', 'مصرف الوحدة');

insert into public.clients (id, name) values
  ('20000000-0000-0000-0000-000000000001', 'زبون أ'),
  ('20000000-0000-0000-0000-000000000002', 'زبون ب');
insert into public.suppliers (id, name) values ('30000000-0000-0000-0000-000000000001', 'مورد 1');
insert into public.technicians (id, name, technician_type_id)
  select '40000000-0000-0000-0000-000000000001', 'فني 1', id from public.technician_types where code = 'electrician';
insert into public.employees (id, name) values ('50000000-0000-0000-0000-000000000001', 'موظف 1');

insert into public.projects (id, name, project_type, client_id, default_treasury_id) values
  ('60000000-0000-0000-0000-000000000001', 'مقاولات 1', 'contracting', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', 'مقاولات 3', 'contracting', '20000000-0000-0000-0000-000000000001', null);
insert into public.projects (id, name, project_type, client_id, finishing_percentage) values
  ('60000000-0000-0000-0000-000000000002', 'تشطيب 2', 'finishing', '20000000-0000-0000-0000-000000000001', 10);

insert into public.project_items (id, project_id, name, quantity, unit_price, progress) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'خرسانة', 100, 100, 50),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'بند للحذف', 1, 10, 0),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 'سور', 1, 500, 0);
insert into public.project_item_assignments (project_item_id, technician_id) values
  ('70000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- الصلاحيات
-- ---------------------------------------------------------------------------
set role anon;
select test.fails('S01 الزائر لا يقرأ الزبائن', 'select * from public.clients', 'permission denied');
select test.fails('S02 الزائر لا يقرأ حركات الخزينة', 'select * from public.treasury_entries', 'permission denied');
select test.fails('S03 الزائر لا ينفذ دالة قبض',
  $q$select public.record_client_receipt(gen_random_uuid(), '20000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000001', 1, current_date)$q$,
  'permission denied');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select test.fails('S04 المهندس لا يسجل قبضاً',
  $q$select public.record_client_receipt(gen_random_uuid(), '20000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000001', 1, current_date)$q$,
  'غير مصرح');
select test.eq('S05 المهندس لا يرى حركات الخزينة', (select count(*) from public.treasury_entries), 0);
select test.ok('S06 المهندس يرى المشاريع', (select count(*) from public.projects) = 3);
select test.fails('S07 المهندس لا يضيف زبوناً', $q$insert into public.clients (name) values ('x')$q$, 'row-level security');
reset role;

-- ---------------------------------------------------------------------------
-- قبض الزبائن (المحاسب)
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

select public.record_client_receipt('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 3000, '2026-10-01');
select test.eq('R01 القبض يزيد الخزينة', test.bal('10000000-0000-0000-0000-000000000001'), 3000);
select test.eq('R02 التزام المقاولات = مجموع البنود', (select client_obligation from public.project_financials where project_id = '60000000-0000-0000-0000-000000000001'), 10010);
select test.eq('R03 المتبقي على المشروع', (select client_remaining from public.project_financials where project_id = '60000000-0000-0000-0000-000000000001'), 7010);

select public.record_client_receipt('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 3000, '2026-10-01');
select test.eq('R04 نفس المفتاح لا يكرر القبض', test.bal('10000000-0000-0000-0000-000000000001'), 3000);
select test.eq('R05 سند واحد فقط', (select count(*) from public.client_receipts), 1);

select test.fails('R06 خزينة التشطيبات مرفوضة لمشروع مقاولات',
  $q$select public.record_client_receipt(gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 10, current_date)$q$,
  'قطاع');
select test.fails('R07 مشروع زبون آخر مرفوض',
  $q$select public.record_client_receipt(gen_random_uuid(), '20000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 10, current_date)$q$,
  'لا يتبع');

-- دفعتان بنفس المبلغ والتاريخ؛ إلغاء واحدة لا يمس الأخرى (الخطأ 3)
select public.record_client_receipt('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 500, '2026-10-02');
select public.record_client_receipt('a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 500, '2026-10-02');
select public.reverse_client_receipt((select id from public.client_receipts where idempotency_key = 'a0000000-0000-0000-0000-000000000002'), 'إدخال خاطئ');
select test.eq('R08 الإلغاء يعكس دفعة واحدة فقط', test.bal('10000000-0000-0000-0000-000000000001'), 3500);
select test.eq('R09 المحصّل بعد الإلغاء', (select collected from public.project_financials where project_id = '60000000-0000-0000-0000-000000000001'), 3500);
select test.fails('R10 لا يُلغى سند مرتين',
  $q$select public.reverse_client_receipt((select id from public.client_receipts where idempotency_key = 'a0000000-0000-0000-0000-000000000002'), 'مرة ثانية')$q$,
  'ملغى');
select test.fails('R11 لا تعديل مباشر للسندات', $q$update public.client_receipts set amount = 1$q$, 'permission denied');
select test.fails('R12 لا حذف مباشر لحركات الخزينة', $q$delete from public.treasury_entries$q$, 'permission denied');

-- زيادة مشروع لا تخفي دين مشروع آخر (الخطأ 8)
select public.record_client_receipt('a0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 1500, '2026-10-03');
select test.eq('R13 مشروع 3 مسدد بزيادة 1000', (select client_remaining from public.project_financials where project_id = '60000000-0000-0000-0000-000000000003'), -1000);
select test.eq('R14 كشف الزبون: المستحق لا ينقص بزيادة مشروع آخر', (select total_due from public.client_balances where client_id = '20000000-0000-0000-0000-000000000001'), 6510);
select test.eq('R15 كشف الزبون: الزيادة ظاهرة منفصلة', (select total_overpaid_on_projects from public.client_balances where client_id = '20000000-0000-0000-0000-000000000001'), 1000);

-- نقل الزيادة إلى الرصيد ثم تطبيقها صراحة
select public.move_project_overpayment_to_credit('b0000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 1000);
select test.eq('R16 الرصيد الدائن بعد النقل', (select available_credit from public.client_credit_balances where client_id = '20000000-0000-0000-0000-000000000001'), 1000);
select test.eq('R17 مشروع 3 أصبح مسدداً تماماً', (select client_remaining from public.project_financials where project_id = '60000000-0000-0000-0000-000000000003'), 0);
select test.fails('R18 لا يُطبَّق أكثر من الرصيد',
  $q$select public.apply_client_credit(gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1001)$q$,
  'الرصيد الدائن');
select public.apply_client_credit('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1000);
select test.eq('R19 التطبيق يخفض متبقي المشروع الهدف', (select client_remaining from public.project_financials where project_id = '60000000-0000-0000-0000-000000000001'), 5510);
select test.eq('R20 الرصيد صفر بعد التطبيق', (select available_credit from public.client_credit_balances where client_id = '20000000-0000-0000-0000-000000000001'), 0);
select test.eq('R21 التطبيق لا يحرك الخزينة', test.bal('10000000-0000-0000-0000-000000000001'), 5000);
select test.fails('R22 لا يُلغى نقل زيادة طُبّق رصيدها',
  $q$select public.reverse_client_credit_entry((select id from public.client_credit_entries where idempotency_key = 'b0000000-0000-0000-0000-000000000001'), 'خطأ')$q$,
  'طُبّق');
select public.reverse_client_credit_entry((select id from public.client_credit_entries where idempotency_key = 'b0000000-0000-0000-0000-000000000002'), 'تراجع');
select test.eq('R23 إلغاء التطبيق يعيد متبقي المشروع', (select client_remaining from public.project_financials where project_id = '60000000-0000-0000-0000-000000000001'), 6510);
select test.eq('R24 وإلغاؤه يعيد الرصيد', (select available_credit from public.client_credit_balances where client_id = '20000000-0000-0000-0000-000000000001'), 1000);

-- دفعة مقدمة بلا مشروع تذهب للرصيد؛ لا تُلغى بعد تطبيقها
select public.record_client_receipt('a0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
  null, '10000000-0000-0000-0000-000000000004', 800, '2026-10-04');
select test.eq('R25 الدفعة المقدمة رصيد للزبون', (select available_credit from public.client_credit_balances where client_id = '20000000-0000-0000-0000-000000000002'), 800);
select public.reverse_client_receipt((select id from public.client_receipts where idempotency_key = 'a0000000-0000-0000-0000-000000000005'), 'خطأ');
select test.eq('R26 إلغاء المقدمة يزيل الرصيد', (select available_credit from public.client_credit_balances where client_id = '20000000-0000-0000-0000-000000000002'), 0);
select test.eq('R27 وإلغاؤها يعكس الخزينة العامة', test.bal('10000000-0000-0000-0000-000000000004'), 0);

-- ---------------------------------------------------------------------------
-- الموردون
-- ---------------------------------------------------------------------------
select public.record_purchase('c0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'material', 1000, '2026-10-05',
  '60000000-0000-0000-0000-000000000001', null, '70000000-0000-0000-0000-000000000001');
select test.eq('P01 الفاتورة لا تحرك الخزينة', test.bal('10000000-0000-0000-0000-000000000001'), 5000);
select public.pay_supplier('c1000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 700, '2026-10-06',
  jsonb_build_array(jsonb_build_object('purchase_id', (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001'), 'amount', 700)));
select test.eq('P02 المتبقي على الفاتورة بعد التوزيع (الخطأ 6)', (select remaining from public.purchase_balances where purchase_id = (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001')), 300);
select test.eq('P03 الدفعة تخفض الخزينة', test.bal('10000000-0000-0000-0000-000000000001'), 4300);

select public.pay_supplier('c1000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1000, '2026-10-06');
select test.eq('P04 المقدم غير الموزع ظاهر (الخطأ 7)', (select unallocated_advance from public.supplier_balances where supplier_id = '30000000-0000-0000-0000-000000000001'), 1000);
select test.eq('P05 رصيد المورد: مقدم 700', (select balance_due from public.supplier_balances where supplier_id = '30000000-0000-0000-0000-000000000001'), -700);

select test.fails('P06 توزيع يتجاوز المتبقي يُرفض كاملاً',
  $q$select public.pay_supplier('c1000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 500, '2026-10-07',
    jsonb_build_array(jsonb_build_object('purchase_id', (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001'), 'amount', 301)))$q$,
  'يتجاوز');
select test.eq('P07 لا أثر جزئي للدفعة المرفوضة (الخطأ 4)', test.bal('10000000-0000-0000-0000-000000000001'), 3300);
select test.eq('P08 لا سجل للدفعة المرفوضة', (select count(*) from public.supplier_payments where idempotency_key = 'c1000000-0000-0000-0000-000000000003'), 0);

select public.allocate_supplier_advance((select id from public.supplier_payments where idempotency_key = 'c1000000-0000-0000-0000-000000000002'),
  (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001'), 300);
select test.eq('P09 توزيع المقدم يسدد الفاتورة', (select remaining from public.purchase_balances where purchase_id = (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001')), 0);
select test.eq('P10 والمقدم المتبقي 700', (select unallocated_advance from public.supplier_balances where supplier_id = '30000000-0000-0000-0000-000000000001'), 700);
select test.fails('P11 لا تُلغى فاتورة عليها سداد',
  $q$select public.reverse_purchase((select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001'), 'خطأ')$q$, 'سداد');

select public.record_purchase('c0000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'return', 200, '2026-10-08',
  '60000000-0000-0000-0000-000000000001', null, '70000000-0000-0000-0000-000000000001', p_returns_purchase_id => (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001'));
select test.fails('P12 مرتجع يتجاوز الفاتورة مرفوض',
  $q$select public.record_purchase(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'return', 801, current_date, '60000000-0000-0000-0000-000000000001', p_returns_purchase_id => (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001'))$q$,
  'يتجاوز');
select test.eq('P13 تكلفة المشروع = المواد − المرتجع', (select direct_cost from public.project_costs where project_id = '60000000-0000-0000-0000-000000000001'), 800);
select test.eq('P14 تكلفة البند تشمل الفاتورة والمرتجع', (select incurred_cost from public.project_item_profitability where project_item_id = '70000000-0000-0000-0000-000000000001'), 800);
select test.eq('P15 ربح البند حتى تاريخه = المكتسب − التكلفة', (select gross_profit_to_date from public.project_item_profitability where project_item_id = '70000000-0000-0000-0000-000000000001'), 4200);

select public.reverse_supplier_payment((select id from public.supplier_payments where idempotency_key = 'c1000000-0000-0000-0000-000000000001'), 'خطأ');
select test.eq('P16 إلغاء دفعة المورد يعيد الخزينة', test.bal('10000000-0000-0000-0000-000000000001'), 4000);
select test.eq('P17 ويعيد المتبقي على الفاتورة', (select remaining from public.purchase_balances where purchase_id = (select id from public.purchases where idempotency_key = 'c0000000-0000-0000-0000-000000000001')), 700);

-- ---------------------------------------------------------------------------
-- الفنيون والتشطيبات
-- ---------------------------------------------------------------------------
select public.record_technician_work('d0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002', '2026-10-05', 'lump_sum', 1, 1200, p_description => 'أعمال تأسيس');
select test.eq('T01 أعمال التشطيب تصل لحساب الفني (الخطأ 5)', (select earned from public.technician_balances where technician_id = '40000000-0000-0000-0000-000000000001'), 1200);
select test.eq('T02 تكلفة مشروع التشطيب', (select direct_cost from public.project_financials where project_id = '60000000-0000-0000-0000-000000000002'), 1200);
select test.eq('T03 التزام زبون التشطيب = التكلفة + 10%', (select client_obligation from public.project_financials where project_id = '60000000-0000-0000-0000-000000000002'), 1320);
select test.eq('T04 ربح التشطيب = النسبة', (select gross_profit_to_date from public.project_financials where project_id = '60000000-0000-0000-0000-000000000002'), 120);

-- خزينة التشطيبات فارغة: الدفع يُرفض لعدم كفاية الرصيد
select test.fails('T05 لا رصيد سالب',
  $q$select public.pay_technician(gen_random_uuid(), '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 500, current_date)$q$,
  'الرصيد غير كافٍ');
select public.pay_technician('d1000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 500, '2026-10-06');
select test.eq('T06 مستحق الفني بعد الدفع', (select balance_due from public.technician_balances where technician_id = '40000000-0000-0000-0000-000000000001'), 700);
select test.eq('T07 الدفع لا يغير تكلفة المشروع', (select direct_cost from public.project_financials where project_id = '60000000-0000-0000-0000-000000000002'), 1200);
select public.receive_from_technician('d2000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 100, '2026-10-07');
select test.eq('T08 الاستلام من الفني اتجاه معاكس', (select balance_due from public.technician_balances where technician_id = '40000000-0000-0000-0000-000000000001'), 800);
select public.reverse_technician_payment((select id from public.technician_payments where idempotency_key = 'd1000000-0000-0000-0000-000000000001'), 'خطأ');
select test.eq('T09 إلغاء دفعة الفني', (select balance_due from public.technician_balances where technician_id = '40000000-0000-0000-0000-000000000001'), 1300);
select test.eq('T10 والخزينة بعد الإلغاء والاستلام', test.bal('10000000-0000-0000-0000-000000000001'), 4100);

-- ---------------------------------------------------------------------------
-- العهد والمصروفات والتحويلات
-- ---------------------------------------------------------------------------
select public.issue_custody('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1000, '2026-10-08',
  p_employee_id => '50000000-0000-0000-0000-000000000001', p_project_id => '60000000-0000-0000-0000-000000000001');
select public.record_expense('e1000000-0000-0000-0000-000000000001', 'نقل مواد', 300, '2026-10-09',
  p_custody_id => (select id from public.custodies where idempotency_key = 'e0000000-0000-0000-0000-000000000001'),
  p_project_id => '60000000-0000-0000-0000-000000000001');
select test.eq('C01 مصروف العهدة لا يحرك الخزينة مرة ثانية', test.bal('10000000-0000-0000-0000-000000000001'), 3100);
select test.eq('C02 متبقي العهدة', (select remaining from public.custody_balances where custody_id = (select id from public.custodies where idempotency_key = 'e0000000-0000-0000-0000-000000000001')), 700);
select test.eq('C03 المصروف يدخل تكلفة المشروع', (select expenses from public.project_costs where project_id = '60000000-0000-0000-0000-000000000001'), 300);
select test.fails('C04 لا يُصرف من العهدة أكثر من المتبقي',
  $q$select public.record_expense(gen_random_uuid(), 'x', 701, current_date, p_custody_id => (select id from public.custodies where idempotency_key = 'e0000000-0000-0000-0000-000000000001'), p_project_id => '60000000-0000-0000-0000-000000000001')$q$,
  'يتجاوز');
select test.fails('C05 لا تُغلق عهدة فيها متبقٍ',
  $q$select public.close_custody((select id from public.custodies where idempotency_key = 'e0000000-0000-0000-0000-000000000001'))$q$, 'متبقٍ');
select public.return_custody_cash('e2000000-0000-0000-0000-000000000001', (select id from public.custodies where idempotency_key = 'e0000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001', 700, '2026-10-10');
select public.close_custody((select id from public.custodies where idempotency_key = 'e0000000-0000-0000-0000-000000000001'));
select test.ok('C06 العهدة مغلقة', (select is_closed from public.custodies where idempotency_key = 'e0000000-0000-0000-0000-000000000001'));
select test.eq('C07 الخزينة بعد الإرجاع', test.bal('10000000-0000-0000-0000-000000000001'), 3800);

select public.record_expense('e1000000-0000-0000-0000-000000000002', 'قرطاسية', 50, '2026-10-10', p_treasury_id => '10000000-0000-0000-0000-000000000001');
select test.eq('C08 المصروف العام لا يدخل أي مشروع', (select sum(expenses) from public.project_costs), 300);

select public.transfer_between_treasuries('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 750, '2026-10-11');
select test.eq('C09 التحويل: المصدر', test.bal('10000000-0000-0000-0000-000000000001'), 3000);
select test.eq('C10 التحويل: الوجهة', test.bal('10000000-0000-0000-0000-000000000002'), 750);
select public.reverse_transfer((select id from public.transfers where idempotency_key = 'f0000000-0000-0000-0000-000000000001'), 'خطأ');
select test.eq('C11 إلغاء التحويل', test.bal('10000000-0000-0000-0000-000000000002'), 0);

-- ---------------------------------------------------------------------------
-- البنود
-- ---------------------------------------------------------------------------
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.delete_project_item('70000000-0000-0000-0000-000000000002');
select test.eq('I01 حذف البند يحذف تعييناته معه', (select count(*) from public.project_item_assignments where project_item_id = '70000000-0000-0000-0000-000000000002'), 0);
select test.fails('I02 لا يُحذف بند عليه مشتريات', $q$select public.delete_project_item('70000000-0000-0000-0000-000000000001')$q$, 'لا يمكن حذف');
select test.eq('I03 وتعييناته باقية', (select count(*) from public.project_item_assignments where project_item_id = '70000000-0000-0000-0000-000000000001'), 1);
select test.fails('I04 لا يتغير نوع المشروع', $q$update public.projects set project_type = 'finishing', finishing_percentage = 5 where id = '60000000-0000-0000-0000-000000000001'$q$, 'نوع المشروع');
reset role;

-- ---------------------------------------------------------------------------
-- سلامة الدفتر: رصيد كل خزينة = مجموع حركاتها، ولا مصدر بلا حركة
-- ---------------------------------------------------------------------------
select test.fails('L01 حركات الخزينة غير قابلة للتعديل حتى للمالك', $q$update public.treasury_entries set amount = 1$q$, 'غير قابل');
select test.eq('L02 كل سند قبض له حركة إيداع واحدة', (
  select count(*) from public.client_receipts r
  where (select count(*) from public.treasury_entries e where e.source_type = 'client_receipt' and e.source_id = r.id and e.reverses_entry_id is null) <> 1), 0);
select test.eq('L03 كل ملغى له حركة عكسية', (
  select count(*) from public.treasury_entries e
  where e.reverses_entry_id is null and e.source_type <> 'opening_balance'
    and (
      (e.source_type = 'client_receipt' and (select status from public.client_receipts where id = e.source_id) = 'reversed')
      or (e.source_type = 'supplier_payment' and (select status from public.supplier_payments where id = e.source_id) = 'reversed')
      or (e.source_type = 'technician_payment' and (select status from public.technician_payments where id = e.source_id) = 'reversed')
      or (e.source_type = 'transfer' and (select status from public.transfers where id = e.source_id) = 'reversed'))
    and not exists (select 1 from public.treasury_entries x where x.reverses_entry_id = e.id)), 0);

-- ---------------------------------------------------------------------------
-- النتيجة
-- ---------------------------------------------------------------------------
\pset format aligned
select n, case when ok then 'PASS' else 'FAIL' end as result, name, detail from test.results where not ok order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from test.results;
do $$ begin
  if exists (select 1 from test.results where not ok) then raise exception 'بعض الاختبارات فشلت'; end if;
end $$;
