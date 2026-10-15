-- ركاز v2 — نقل بيانات النسخة السابقة (نسخة 15 أكتوبر 2026)
-- المصدر: backups/rekaz-public-data-2026-10-15.json
-- العمليات المالية تمر عبر نفس دوال التطبيق، بصفة المدير، حتى تُطبَّق نفس القواعد.
-- يُنفَّذ مرة واحدة بعد الترحيلات، داخل معاملة واحدة.

begin;

-- المستخدم الوحيد في النسخة السابقة (حساب الدخول نفسه باقٍ في auth.users)
insert into public.profiles (id, username, display_name)
values ('e43ab53b-1658-47de-ab98-84ab0b1bda51', 'admin', 'المدير العام')
on conflict (id) do update set username = excluded.username, display_name = excluded.display_name;
insert into public.user_roles (user_id, role)
values ('e43ab53b-1658-47de-ab98-84ab0b1bda51', 'admin');
select set_config('request.jwt.claim.sub', 'e43ab53b-1658-47de-ab98-84ab0b1bda51', true);

update public.company_settings set
  company_name = 'شركة ركاز العقارية',
  tagline = 'شركة مقاولات وتجهيزات',
  phone = '0914148865',
  address = 'محلة الشيخ بالقرب من المنتزه',
  logo_path = 'https://lh3.googleusercontent.com/d/1vaxorrGjx7M1WgRCgTx5gIXA36g_907p',
  signee_name = 'علي بن عروس شميله',
  signee_title = 'المدير العام',
  storage_provider = 'google_drive'
where id = 1;

-- الخزائن بنفس المعرّفات والهيكل
insert into public.treasuries (id, name, domain, kind, parent_id, bank_name, account_number, notes) values
  ('c504cce9-8bfd-4cda-8296-80febdec2432', 'خزينة المقاولات الرئيسية', 'contracting', 'cash', null, null, null, 'الخزينة النقدية المركزية لقطاع المقاولات — زليتن'),
  ('f9637060-3f26-445e-b77c-658b31da2269', 'خزينة التشطيبات الرئيسية', 'finishing', 'cash', null, null, null, 'الخزينة النقدية المركزية لقطاع التشطيبات — زليتن');
insert into public.treasuries (id, name, domain, kind, parent_id, bank_name, account_number) values
  ('a1faee9c-f081-49a5-990d-f013827f3568', 'خزينة المقاولات المكتب', 'contracting', 'cash', 'c504cce9-8bfd-4cda-8296-80febdec2432', null, null),
  ('df15e8f6-1031-425d-9090-e4450a4c69fa', 'خزينة المقاولات شمال افريقيا', 'contracting', 'bank', 'c504cce9-8bfd-4cda-8296-80febdec2432', 'شمال افريقيا', '0251158746874'),
  ('f0357f4d-d783-4345-ae1e-d9ab802263e9', 'خزينة التشطيب المكتب', 'finishing', 'cash', 'f9637060-3f26-445e-b77c-658b31da2269', null, null),
  ('176f2792-f794-45a2-ba51-8a4ac9a0e93a', 'خزينة التشطيب شمال افريقيا', 'finishing', 'bank', 'f9637060-3f26-445e-b77c-658b31da2269', 'شمال افريقيا', '02145874631');

-- الأطراف
insert into public.clients (id, name, city) values
  ('96b38df5-4443-4b08-b3e7-a5b708cf079b', 'حسن بن خليل', 'زليتن');
insert into public.suppliers (id, name) values
  ('cf89b9d9-bebc-4021-b8ea-17cdfd0d7f55', 'عريبي'),
  ('7d2659b1-3fcf-43e0-b14b-a7e69e66f152', 'الماسة');
insert into public.technicians (id, name, technician_type_id) values
  ('605c6c18-48bc-4174-b006-2857d12c6837', 'عبدالباسط', 'a7832db5-ec5a-498c-a264-2b25acc1d4dc'),
  ('3331e492-f27a-4ec8-82e6-210b4bcc3ab0', 'محمد توغان', '698d75cb-a9a4-4f8c-9388-337aca60bc9f'),
  ('80b6d12a-d009-49e6-83ff-e245abb91c72', 'محمد ثابت', 'c4e02287-9e7a-432d-ba48-e7e65c11a7c7'),
  ('d7f3271c-b9b4-4ab6-92b9-c1a41b9ed0f9', 'أيمن البلاصي', 'a1a2bb10-d47c-436f-bf4e-1d26c1c6c756'),
  ('c1ab10b1-5c5d-4d18-9812-549730e7b8eb', 'أحمد الزيات', '39bbd364-59cf-4287-9fe1-43446dca5147');

-- البند العام
insert into public.catalog_items (id, name, unit_id)
select '82c0fee0-fc8f-4c4c-8660-b55498a80806', 'القواعد', id from public.measurement_units where name = 'متر طولي';

-- المشروع والمرحلة والبنود
insert into public.projects (id, name, project_type, client_id, status, start_date, default_treasury_id) values
  ('8d6f9107-23fa-4d91-9d26-83c95beaa058', 'فيلة سكنية', 'contracting', '96b38df5-4443-4b08-b3e7-a5b708cf079b', 'active', '2026-09-26', 'c504cce9-8bfd-4cda-8296-80febdec2432');

insert into public.phase_reference_counters (year, last_number) values (2026, 48);
insert into public.project_phases (id, project_id, name, order_index, reference_number, status, start_date) values
  ('8150dab0-dce5-4cee-bb71-aebf66398243', '8d6f9107-23fa-4d91-9d26-83c95beaa058', 'أعمال الحفر والتأسيس', 0, '48/26', 'in_progress', '2026-09-26');

insert into public.project_items (id, project_id, phase_id, name, unit_id, dimensions, quantity, unit_price, order_index)
select v.id::uuid, '8d6f9107-23fa-4d91-9d26-83c95beaa058', '8150dab0-dce5-4cee-bb71-aebf66398243', 'القواعد', u.id, v.dims::jsonb, v.qty, v.price, v.ord
from (values
  ('18d97f8c-f594-4186-ae93-4a23fcddd4ad', '{"length":1.2,"width":1,"height":1}', 12::numeric, 110::numeric, 0),
  ('b9a6d4bc-1dbe-4877-bc9e-f57c381323e8', '{"length":1.5,"width":1,"height":1,"factor":1.5}', 11.25, 110, 1),
  ('e2b3cc2a-ed98-4ecd-bd2b-c75d039000b0', '{}', 6, 130, 2)
) v(id, dims, qty, price, ord)
cross join public.measurement_units u where u.name = 'متر مكعب';

insert into public.project_item_assignments (project_item_id, technician_id, rate_unit, agreed_rate, planned_quantity) values
  ('18d97f8c-f594-4186-ae93-4a23fcddd4ad', '605c6c18-48bc-4174-b006-2857d12c6837', 'piece', 40, 12),
  ('18d97f8c-f594-4186-ae93-4a23fcddd4ad', '3331e492-f27a-4ec8-82e6-210b4bcc3ab0', 'meter', 30, 12),
  ('b9a6d4bc-1dbe-4877-bc9e-f57c381323e8', '605c6c18-48bc-4174-b006-2857d12c6837', 'meter', 40, 11.25),
  ('e2b3cc2a-ed98-4ecd-bd2b-c75d039000b0', '605c6c18-48bc-4174-b006-2857d12c6837', 'meter', 40, 6);

-- العمليات المالية عبر دوال التطبيق (مفاتيح الطلب = معرّفات السجلات القديمة)
select public.record_client_receipt('349866b2-60bf-4497-b4a9-f9e8bfa9a203', '96b38df5-4443-4b08-b3e7-a5b708cf079b',
  '8d6f9107-23fa-4d91-9d26-83c95beaa058', 'a1faee9c-f081-49a5-990d-f013827f3568', 30000, '2026-09-26', 'cash',
  null, 'منقول من النسخة السابقة');

select public.record_purchase('37c97a81-6b1a-4d6b-b6fe-c30008dbf21d', '7d2659b1-3fcf-43e0-b14b-a7e69e66f152', 'material', 4560, '2026-09-26',
  '8d6f9107-23fa-4d91-9d26-83c95beaa058', '8150dab0-dce5-4cee-bb71-aebf66398243', null, '1450');
select public.record_purchase('20395e31-481a-4a48-9887-114aae46ea1d', 'cf89b9d9-bebc-4021-b8ea-17cdfd0d7f55', 'material', 500, '2026-09-26',
  '8d6f9107-23fa-4d91-9d26-83c95beaa058', '8150dab0-dce5-4cee-bb71-aebf66398243', null, '1152');

-- كانت محفوظة خطأً كفاتورة مشتريات من نوع "عمالة"؛ هنا إنجاز فني
select public.record_technician_work('1a862cb6-76cc-4a3f-88b1-802133ac1d6f', 'c1ab10b1-5c5d-4d18-9812-549730e7b8eb',
  '8d6f9107-23fa-4d91-9d26-83c95beaa058', '2026-09-26', 'lump_sum', 1, 1200,
  '8150dab0-dce5-4cee-bb71-aebf66398243', null, 'أعمال تأسيس');

-- هذا المصروف صُرف في النسخة السابقة من خزينة رصيدها صفر فأصبح سالباً (−150).
-- نسمح بالسالب لهذه الحركة فقط حتى يُنقل كما حدث، ثم نعيد المنع.
update public.company_settings set allow_negative_treasury = true where id = 1;
select public.record_expense('c38741ca-ee20-4cda-af2d-31148883099c', 'حساب عمال نظافة الموقع قبل صب الأعمدة', 150, '2026-09-26',
  p_treasury_id => 'c504cce9-8bfd-4cda-8296-80febdec2432',
  p_project_id => '8d6f9107-23fa-4d91-9d26-83c95beaa058',
  p_phase_id => '8150dab0-dce5-4cee-bb71-aebf66398243',
  p_category_id => (select id from public.expense_categories where name = 'أخرى'));
update public.company_settings set allow_negative_treasury = false where id = 1;

-- التحقق: الأرصدة يجب أن تطابق النسخة السابقة
do $$
declare
  v numeric;
begin
  select balance into v from public.treasury_balances where treasury_id = 'a1faee9c-f081-49a5-990d-f013827f3568';
  if v <> 30000 then raise exception 'رصيد خزينة المقاولات المكتب % لا يطابق 30000', v; end if;
  select balance into v from public.treasury_balances where treasury_id = 'c504cce9-8bfd-4cda-8296-80febdec2432';
  if v <> -150 then raise exception 'رصيد خزينة المقاولات الرئيسية % لا يطابق −150', v; end if;
  select sum(balance) into v from public.treasury_balances;
  if v <> 29850 then raise exception 'مجموع الخزائن % لا يطابق 29850', v; end if;
end;
$$;

commit;
