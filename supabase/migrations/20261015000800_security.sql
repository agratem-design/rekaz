-- ركاز v2 — الصلاحيات
-- 1) لا شيء لـ anon إطلاقاً.
-- 2) الجداول المالية: قراءة للمالية فقط، ولا كتابة مباشرة لأحد؛ الكتابة عبر دوال 0700.
-- 3) البيانات الأساسية: قراءة لكل الموظفين، وكتابة حسب الدور.
-- 4) الدوال الداخلية لا تُستدعى من الخارج.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- service_role (الخادم فقط، لا يصل للمتصفح) يحتفظ بالوصول الكامل للصيانة والنسخ الاحتياطي
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- تفعيل RLS على كل جدول
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- مساعد لإنشاء السياسات
-- ---------------------------------------------------------------------------
create function pg_temp.policy(p_table text, p_cmd text, p_using text, p_check text default null)
returns void
language plpgsql
as $$
begin
  execute format(
    'create policy %I on public.%I for %s to authenticated %s %s',
    p_table || '_' || lower(p_cmd), p_table, p_cmd,
    case when p_cmd in ('SELECT', 'DELETE', 'UPDATE') then 'using (' || p_using || ')' else '' end,
    case when p_cmd in ('INSERT', 'UPDATE') then 'with check (' || coalesce(p_check, p_using) || ')' else '' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- المستخدمون والإعدادات
-- ---------------------------------------------------------------------------
grant select on public.profiles, public.user_roles, public.company_settings to authenticated;
grant update on public.company_settings to authenticated;
grant insert, update, delete on public.profiles, public.user_roles to authenticated;

select pg_temp.policy('profiles', 'SELECT', 'public.is_staff() or id = auth.uid()');
select pg_temp.policy('profiles', 'INSERT', 'public.is_admin()');
select pg_temp.policy('profiles', 'UPDATE', 'public.is_admin()');
select pg_temp.policy('profiles', 'DELETE', 'public.is_admin()');
select pg_temp.policy('user_roles', 'SELECT', 'public.is_staff() or user_id = auth.uid()');
select pg_temp.policy('user_roles', 'INSERT', 'public.is_admin()');
select pg_temp.policy('user_roles', 'UPDATE', 'public.is_admin()');
select pg_temp.policy('user_roles', 'DELETE', 'public.is_admin()');
select pg_temp.policy('company_settings', 'SELECT', 'public.is_staff()');
select pg_temp.policy('company_settings', 'UPDATE', 'public.is_admin()');

grant select on public.audit_log to authenticated;
select pg_temp.policy('audit_log', 'SELECT', 'public.is_admin()');

-- ---------------------------------------------------------------------------
-- البيانات الأساسية: قراءة لكل الموظفين
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  writers text;
begin
  for t, writers in
    select * from (values
      ('clients', 'public.is_finance()'),
      ('suppliers', 'public.is_finance()'),
      ('employees', 'public.is_finance()'),
      ('technician_types', 'public.is_admin()'),
      ('technicians', 'public.has_any_role(array[''admin'',''accountant'',''engineer'',''supervisor'']::public.app_role[])'),
      ('engineers', 'public.is_admin()'),
      ('treasuries', 'public.is_finance()'),
      ('projects', 'public.has_any_role(array[''admin'',''engineer'',''supervisor'']::public.app_role[])'),
      ('project_phases', 'public.has_any_role(array[''admin'',''engineer'',''supervisor'']::public.app_role[])'),
      ('measurement_units', 'public.has_any_role(array[''admin'',''supervisor'']::public.app_role[])'),
      ('catalog_items', 'public.has_any_role(array[''admin'',''supervisor'']::public.app_role[])'),
      ('catalog_item_requirements', 'public.has_any_role(array[''admin'',''supervisor'']::public.app_role[])'),
      ('project_items', 'public.has_any_role(array[''admin'',''engineer'',''supervisor'']::public.app_role[])'),
      ('project_item_requirements', 'public.has_any_role(array[''admin'',''engineer'',''supervisor'']::public.app_role[])'),
      ('project_item_assignments', 'public.has_any_role(array[''admin'',''engineer'',''supervisor'']::public.app_role[])'),
      ('contracts', 'public.is_admin()'),
      ('contract_items', 'public.is_admin()'),
      ('contract_clauses', 'public.is_admin()'),
      ('clause_templates', 'public.is_admin()'),
      ('expense_categories', 'public.is_finance()')
    ) v(t, w)
  loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    perform pg_temp.policy(t, 'SELECT', 'public.is_staff()');
    perform pg_temp.policy(t, 'INSERT', writers);
    perform pg_temp.policy(t, 'UPDATE', writers);
  end loop;
end;
$$;

-- الحذف المسموح فقط حيث لا أثر مالي؛ قيود المفاتيح الأجنبية ترفض حذف ما له سجلات
grant delete on public.clients, public.suppliers, public.technicians, public.engineers, public.employees,
  public.project_phases, public.catalog_items, public.catalog_item_requirements,
  public.project_item_requirements, public.project_item_assignments,
  public.contract_items, public.contract_clauses, public.clause_templates, public.measurement_units
  to authenticated;
select pg_temp.policy('clients', 'DELETE', 'public.is_admin()');
select pg_temp.policy('suppliers', 'DELETE', 'public.is_admin()');
select pg_temp.policy('technicians', 'DELETE', 'public.is_admin()');
select pg_temp.policy('engineers', 'DELETE', 'public.is_admin()');
select pg_temp.policy('employees', 'DELETE', 'public.is_admin()');
select pg_temp.policy('project_phases', 'DELETE', 'public.has_any_role(array[''admin'',''engineer'']::public.app_role[])');
select pg_temp.policy('catalog_items', 'DELETE', 'public.is_admin()');
select pg_temp.policy('catalog_item_requirements', 'DELETE', 'public.has_any_role(array[''admin'',''supervisor'']::public.app_role[])');
select pg_temp.policy('project_item_requirements', 'DELETE', 'public.has_any_role(array[''admin'',''engineer'',''supervisor'']::public.app_role[])');
select pg_temp.policy('project_item_assignments', 'DELETE', 'public.has_any_role(array[''admin'',''engineer'',''supervisor'']::public.app_role[])');
select pg_temp.policy('contract_items', 'DELETE', 'public.is_admin()');
select pg_temp.policy('contract_clauses', 'DELETE', 'public.is_admin()');
select pg_temp.policy('clause_templates', 'DELETE', 'public.is_admin()');
select pg_temp.policy('measurement_units', 'DELETE', 'public.is_admin()');

-- ---------------------------------------------------------------------------
-- الجداول المالية: قراءة فقط
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'treasury_entries', 'client_receipts', 'client_credit_entries', 'purchases',
    'supplier_payments', 'supplier_payment_allocations', 'technician_payments', 'technician_receipts',
    'custodies', 'custody_returns', 'expenses', 'transfers'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    perform pg_temp.policy(t, 'SELECT', 'public.is_finance()');
  end loop;
end;
$$;

-- أعمال الفنيين يراها المهندسون والمشرفون أيضاً
grant select on public.technician_work to authenticated;
select pg_temp.policy('technician_work', 'SELECT', 'public.is_staff()');

-- العروض تعمل بصلاحيات المستدعي، فتحترم السياسات أعلاه
grant select on
  public.treasury_balances, public.project_costs, public.project_collections, public.project_financials,
  public.project_item_profitability, public.project_item_staffing,
  public.client_credit_balances, public.client_balances, public.purchase_balances,
  public.supplier_balances, public.technician_balances, public.custody_balances
  to authenticated;

-- ---------------------------------------------------------------------------
-- الدوال المسموح استدعاؤها من التطبيق (لمستخدمين مسجلين فقط)
-- ---------------------------------------------------------------------------
grant execute on function
  public.has_any_role(public.app_role[]),
  public.is_staff(),
  public.is_finance(),
  public.is_admin(),
  public.set_opening_balance(uuid, numeric, date),
  public.record_client_receipt(uuid, uuid, uuid, uuid, numeric, date, public.payment_method, text, text),
  public.reverse_client_receipt(uuid, text, date),
  public.apply_client_credit(uuid, uuid, uuid, numeric, text),
  public.move_project_overpayment_to_credit(uuid, uuid, numeric, text),
  public.reverse_client_credit_entry(uuid, text),
  public.record_purchase(uuid, uuid, public.purchase_kind, numeric, date, uuid, uuid, uuid, text, text, jsonb, uuid, text, text),
  public.reverse_purchase(uuid, text),
  public.pay_supplier(uuid, uuid, uuid, numeric, date, jsonb, public.payment_method, text, text),
  public.allocate_supplier_advance(uuid, uuid, numeric),
  public.reverse_supplier_payment(uuid, text, date),
  public.record_technician_work(uuid, uuid, uuid, date, public.rate_unit, numeric, numeric, uuid, uuid, text),
  public.reverse_technician_work(uuid, text),
  public.pay_technician(uuid, uuid, uuid, numeric, date, uuid, public.payment_method, text),
  public.reverse_technician_payment(uuid, text, date),
  public.receive_from_technician(uuid, uuid, uuid, numeric, date, public.payment_method, text),
  public.reverse_technician_receipt(uuid, text, date),
  public.issue_custody(uuid, uuid, numeric, date, uuid, uuid, uuid, text),
  public.return_custody_cash(uuid, uuid, uuid, numeric, date, text),
  public.close_custody(uuid),
  public.reverse_custody(uuid, text, date),
  public.reverse_custody_return(uuid, text, date),
  public.record_expense(uuid, text, numeric, date, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text),
  public.reverse_expense(uuid, text, date),
  public.transfer_between_treasuries(uuid, uuid, uuid, numeric, date, text),
  public.reverse_transfer(uuid, text, date),
  public.delete_project_item(uuid)
  to authenticated;
