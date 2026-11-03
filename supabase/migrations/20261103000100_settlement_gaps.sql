-- ركاز v2 — استكمال نواقص دورة الصرف
-- 1) استلام مبلغ من مورد (مرتجع على فاتورة مسددة أو دفعة زائدة)
-- 2) نقل دفعة على الحساب إلى مشروع دون إلغائها
-- 3) الديون بين الخزائن: سلفة من خزينة لأخرى وسدادها
-- 4) مراجعة واعتماد فواتير الموردين
-- 5) راتب محمل على مشروع يُصرف من خزائن قطاعه أو الخزينة العامة فقط

alter type public.entry_source add value if not exists 'supplier_refund';

-- ---------------------------------------------------------------------------
-- الحماية العامة: يُسمح فقط بتصنيف لاحق لا يغير المال
-- (مشروع لدفعة كانت بلا مشروع، واعتماد فاتورة لم تُعتمد)
-- ---------------------------------------------------------------------------
create or replace function public.guard_financial_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_free text[] := array['status', 'reversed_at', 'reversed_by', 'reversal_reason', 'is_closed'];
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف سجل مالي؛ استخدم الإلغاء' using errcode = '42501';
  end if;
  if old.status = 'reversed' then
    raise exception 'السجل ملغى ولا يمكن تعديله' using errcode = '42501';
  end if;
  -- amount عمود محسوب لا تظهر قيمته قبل التحديث؛ الكمية والسعر يبقيان محروسين
  if tg_table_name = 'technician_work' then
    v_free := array_append(v_free, 'amount');
  end if;
  if tg_table_name = 'supplier_payments' and to_jsonb(old) ->> 'project_id' is null then
    v_free := array_append(v_free, 'project_id');
  end if;
  if tg_table_name = 'technician_payments' and to_jsonb(old) ->> 'context_project_id' is null then
    v_free := array_append(v_free, 'context_project_id');
  end if;
  if tg_table_name = 'purchases' and to_jsonb(old) ->> 'approved_at' is null then
    v_free := v_free || array['approved_at', 'approved_by'];
  end if;
  if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception 'لا يمكن تعديل سجل مالي بعد ترحيله؛ ألغِه وأنشئ سجلاً جديداً' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) استلام مبلغ من مورد: يدخل الخزينة ويقلّص ما لنا عنده
-- ---------------------------------------------------------------------------
create table public.supplier_refunds (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id),
  project_id uuid references public.projects (id),
  treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  refund_date date not null,
  method public.payment_method not null default 'cash',
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index supplier_refunds_supplier_idx on public.supplier_refunds (supplier_id);
create trigger supplier_refunds_guard before update or delete on public.supplier_refunds
  for each row execute function public.guard_financial_record();
create trigger supplier_refunds_audit after insert or update on public.supplier_refunds
  for each row execute function public.write_audit_log();
alter table public.supplier_refunds enable row level security;
create policy supplier_refunds_read on public.supplier_refunds for select to authenticated using (public.is_finance());
grant select on public.supplier_refunds to authenticated;
grant all on public.supplier_refunds to service_role;

-- الأعمدة الجديدة في آخر العرض حفاظاً على الأعمدة السابقة
create or replace view public.supplier_balances
with (security_invoker = true)
as
select
  s.id as supplier_id,
  s.name,
  coalesce(pu.invoiced, 0)::numeric(16, 3) as invoiced,
  coalesce(pu.returned, 0)::numeric(16, 3) as returned,
  coalesce(pa.paid, 0)::numeric(16, 3) as paid,
  coalesce(pa.paid, 0) - coalesce(al.allocated, 0) as unallocated_advance,
  (coalesce(pu.invoiced, 0) - coalesce(pu.returned, 0) - coalesce(pa.paid, 0) + coalesce(rf.refunded, 0))::numeric(16, 3) as balance_due,
  coalesce(rf.refunded, 0)::numeric(16, 3) as refunded
from public.suppliers s
left join (
  select supplier_id,
    sum(total_amount) filter (where kind <> 'return') as invoiced,
    sum(total_amount) filter (where kind = 'return') as returned
  from public.purchases where status = 'posted' group by 1
) pu on pu.supplier_id = s.id
left join (
  select supplier_id, sum(amount) as paid from public.supplier_payments where status = 'posted' group by 1
) pa on pa.supplier_id = s.id
left join (
  select sp.supplier_id, sum(a.amount) as allocated
  from public.supplier_payment_allocations a
  join public.supplier_payments sp on sp.id = a.payment_id
  where a.status = 'posted' group by 1
) al on al.supplier_id = s.id
left join (
  select supplier_id, sum(amount) as refunded from public.supplier_refunds where status = 'posted' group by 1
) rf on rf.supplier_id = s.id;

create or replace view public.supplier_project_balances
with (security_invoker = true)
as
select
  supplier_id,
  project_id,
  sum(invoiced)::numeric(16, 3) as invoiced,
  sum(returned)::numeric(16, 3) as returned,
  sum(paid)::numeric(16, 3) as paid,
  sum(advance)::numeric(16, 3) as unallocated_advance,
  sum(invoiced - returned - paid + refunded)::numeric(16, 3) as balance_due,
  sum(refunded)::numeric(16, 3) as refunded
from (
  select supplier_id, project_id,
    case when kind = 'return' then 0 else total_amount end as invoiced,
    case when kind = 'return' then total_amount else 0 end as returned,
    0::numeric as paid, 0::numeric as advance, 0::numeric as refunded
  from public.purchases
  where status = 'posted'
  union all
  select pu.supplier_id, pu.project_id, 0, 0, a.amount, 0, 0
  from public.supplier_payment_allocations a
  join public.purchases pu on pu.id = a.purchase_id
  where a.status = 'posted'
  union all
  select sp.supplier_id, sp.project_id, 0, 0,
    sp.amount - coalesce(x.allocated, 0),
    sp.amount - coalesce(x.allocated, 0), 0
  from public.supplier_payments sp
  left join (
    select payment_id, sum(amount) as allocated
    from public.supplier_payment_allocations where status = 'posted'
    group by payment_id
  ) x on x.payment_id = sp.id
  where sp.status = 'posted'
  union all
  select supplier_id, project_id, 0, 0, 0, 0, amount
  from public.supplier_refunds where status = 'posted'
) m
group by supplier_id, project_id;

-- ما خرج للموردين على المشروع صافٍ مما استُرد منهم
create or replace view public.project_cash_position
with (security_invoker = true)
as
select
  p.id as project_id,
  col.collected as received,
  coalesce(su.paid, 0)::numeric(16, 3) as paid_suppliers,
  coalesce(te.paid, 0)::numeric(16, 3) as paid_technicians,
  coalesce(ex.paid, 0)::numeric(16, 3) as paid_expenses,
  coalesce(pr.paid, 0)::numeric(16, 3) as paid_payroll,
  (coalesce(su.paid, 0) + coalesce(te.paid, 0) + coalesce(ex.paid, 0) + coalesce(pr.paid, 0))::numeric(16, 3) as total_paid,
  (col.collected - coalesce(su.paid, 0) - coalesce(te.paid, 0) - coalesce(ex.paid, 0) - coalesce(pr.paid, 0))::numeric(16, 3) as cash_position,
  (coalesce(greatest(su.due, 0), 0) + coalesce(greatest(te.due, 0), 0))::numeric(16, 3) as unpaid_dues
from public.projects p
join public.project_collections col on col.project_id = p.id
left join (
  select project_id, sum(paid - refunded) as paid, sum(greatest(balance_due, 0)) as due
  from public.supplier_project_balances where project_id is not null group by project_id
) su on su.project_id = p.id
left join (
  select project_id, sum(paid) as paid, sum(greatest(balance_due, 0)) as due
  from public.technician_project_balances where project_id is not null group by project_id
) te on te.project_id = p.id
left join (
  select project_id, sum(amount) as paid
  from public.expenses where status = 'posted' and project_id is not null group by project_id
) ex on ex.project_id = p.id
left join (
  select s.project_id, sum(pp.amount) as paid
  from public.payroll_payments pp
  join public.payroll_slips s on s.id = pp.slip_id
  where pp.status = 'posted' and s.project_id is not null
  group by s.project_id
) pr on pr.project_id = p.id;

-- لا يُستلم إلا ما لنا عند المورد فعلاً (في المشروع إن حُدد)
create function public.receive_from_supplier(
  p_key uuid,
  p_supplier_id uuid,
  p_treasury_id uuid,
  p_amount numeric,
  p_date date,
  p_project_id uuid default null,
  p_method public.payment_method default 'cash',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_credit numeric;
begin
  perform public.require_finance();
  select id into v_id from public.supplier_refunds where idempotency_key = p_key;
  if found then return v_id; end if;
  perform 1 from public.suppliers where id = p_supplier_id for update;
  if not found then raise exception 'المورد غير موجود'; end if;
  perform public.assert_treasury_for_project(p_treasury_id, p_project_id);
  if p_project_id is null then
    select -balance_due into v_credit from public.supplier_balances where supplier_id = p_supplier_id;
  else
    select -balance_due into v_credit from public.supplier_project_balances where supplier_id = p_supplier_id and project_id = p_project_id;
  end if;
  if coalesce(v_credit, 0) < p_amount then
    raise exception 'ما لنا عند المورد % فقط', greatest(coalesce(v_credit, 0), 0) using errcode = '23514';
  end if;
  insert into public.supplier_refunds (supplier_id, project_id, treasury_id, amount, refund_date, method, notes, idempotency_key)
  values (p_supplier_id, p_project_id, p_treasury_id, p_amount, p_date, p_method, p_notes, p_key)
  returning id into v_id;
  perform public.post_treasury_entry(p_treasury_id, 'in', p_amount, p_date, 'supplier_refund', v_id, 'مبلغ مسترد من مورد');
  return v_id;
end;
$$;

create function public.reverse_supplier_refund(p_refund_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.supplier_refunds;
begin
  perform public.require_finance();
  select * into r from public.supplier_refunds where id = p_refund_id for update;
  if not found then raise exception 'السند غير موجود'; end if;
  perform public.assert_reversible(r.status, p_reason);
  update public.supplier_refunds
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = r.id;
  perform public.reverse_treasury_entries('supplier_refund', r.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) دفعة على الحساب تُنقل لاحقاً إلى مشروع: تصنيف فقط، لا حركة خزينة
-- ---------------------------------------------------------------------------
create function public.assign_payment_to_project(p_kind text, p_payment_id uuid, p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sp public.supplier_payments;
  tp public.technician_payments;
  v_unallocated numeric;
begin
  perform public.require_finance();
  if p_project_id is null then raise exception 'المشروع مطلوب' using errcode = '23514'; end if;
  if p_kind = 'supplier' then
    select * into sp from public.supplier_payments where id = p_payment_id for update;
    if not found or sp.status <> 'posted' then raise exception 'الدفعة غير صالحة'; end if;
    if sp.project_id is not null then raise exception 'الدفعة مسجلة على مشروع مسبقاً' using errcode = '23514'; end if;
    select sp.amount - coalesce(sum(amount), 0) into v_unallocated
      from public.supplier_payment_allocations where payment_id = sp.id and status = 'posted';
    if v_unallocated <= 0 then raise exception 'الدفعة موزعة بالكامل على فواتير؛ لا يبقى منها ما يُنقل' using errcode = '23514'; end if;
    -- ما استُرد من حساب المورد العام جاء من مقدماته؛ لا يُنقل مقدم استُرد منه
    if (select coalesce(sum(refunded), 0) from public.supplier_project_balances where supplier_id = sp.supplier_id and project_id is null)
       > (select coalesce(sum(unallocated_advance), 0) from public.supplier_project_balances where supplier_id = sp.supplier_id and project_id is null) - v_unallocated then
      raise exception 'استُرد جزء من مقدم هذا المورد؛ ألغِ الاسترداد قبل نقل الدفعة' using errcode = '23514';
    end if;
    perform public.assert_treasury_for_project(sp.treasury_id, p_project_id);
    update public.supplier_payments set project_id = p_project_id where id = sp.id;
  elsif p_kind = 'technician' then
    select * into tp from public.technician_payments where id = p_payment_id for update;
    if not found or tp.status <> 'posted' then raise exception 'الدفعة غير صالحة'; end if;
    if tp.context_project_id is not null then raise exception 'الدفعة مسجلة على مشروع مسبقاً' using errcode = '23514'; end if;
    perform public.assert_treasury_for_project(tp.treasury_id, p_project_id);
    update public.technician_payments set context_project_id = p_project_id where id = tp.id;
  else
    raise exception 'نوع غير معروف';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) الديون بين الخزائن: السلفة تبقى ديناً على الخزينة المستفيدة حتى تُسدَّد
-- ---------------------------------------------------------------------------
alter table public.transfers add column kind text not null default 'transfer' check (kind in ('transfer', 'loan', 'repayment'));

create view public.treasury_loans
with (security_invoker = true)
as
select
  lender_id,
  borrower_id,
  sum(lent)::numeric(16, 3) as lent,
  sum(repaid)::numeric(16, 3) as repaid,
  sum(lent - repaid)::numeric(16, 3) as outstanding
from (
  select from_treasury_id as lender_id, to_treasury_id as borrower_id, amount as lent, 0::numeric as repaid
  from public.transfers where status = 'posted' and kind = 'loan'
  union all
  select to_treasury_id, from_treasury_id, 0, amount
  from public.transfers where status = 'posted' and kind = 'repayment'
) m
group by lender_id, borrower_id;

drop function public.transfer_between_treasuries(uuid, uuid, uuid, numeric, date, text);
create function public.transfer_between_treasuries(
  p_key uuid, p_from uuid, p_to uuid, p_amount numeric, p_date date, p_notes text default null, p_kind text default 'transfer'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_outstanding numeric;
begin
  perform public.require_finance();
  select id into v_id from public.transfers where idempotency_key = p_key;
  if found then return v_id; end if;
  -- ترتيب ثابت للأقفال يمنع الجمود بين تحويلين متعاكسين
  perform 1 from public.treasuries where id in (p_from, p_to) order by id for update;
  if p_kind = 'repayment' then
    select outstanding into v_outstanding from public.treasury_loans where lender_id = p_to and borrower_id = p_from;
    if coalesce(v_outstanding, 0) < p_amount then
      raise exception 'الدين القائم على هذه الخزينة % فقط', greatest(coalesce(v_outstanding, 0), 0) using errcode = '23514';
    end if;
  end if;
  insert into public.transfers (from_treasury_id, to_treasury_id, amount, transfer_date, notes, idempotency_key, kind)
  values (p_from, p_to, p_amount, p_date, p_notes, p_key, coalesce(p_kind, 'transfer'))
  returning id into v_id;
  perform public.post_treasury_entry(p_from, 'out', p_amount, p_date, 'transfer', v_id,
    case p_kind when 'loan' then 'سلفة صادرة لخزينة' when 'repayment' then 'سداد سلفة' else 'تحويل صادر' end);
  perform public.post_treasury_entry(p_to, 'in', p_amount, p_date, 'transfer', v_id,
    case p_kind when 'loan' then 'سلفة واردة من خزينة' when 'repayment' then 'سداد سلفة مستلم' else 'تحويل وارد' end);
  return v_id;
end;
$$;

-- لا تُلغى سلفة سُدد منها ما يجعل السداد أكبر من الدين
create or replace function public.reverse_transfer(p_transfer_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transfers;
  v_outstanding numeric;
begin
  perform public.require_finance();
  select * into t from public.transfers where id = p_transfer_id for update;
  if not found then raise exception 'التحويل غير موجود'; end if;
  perform public.assert_reversible(t.status, p_reason);
  perform 1 from public.treasuries where id in (t.from_treasury_id, t.to_treasury_id) order by id for update;
  if t.kind = 'loan' then
    select outstanding into v_outstanding from public.treasury_loans where lender_id = t.from_treasury_id and borrower_id = t.to_treasury_id;
    if coalesce(v_outstanding, 0) < t.amount then
      raise exception 'سُدد جزء من هذه السلفة؛ ألغِ السداد أولاً' using errcode = '23514';
    end if;
  end if;
  update public.transfers
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = t.id;
  perform public.reverse_treasury_entries('transfer', t.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) مراجعة واعتماد فواتير الموردين (المدير). الاعتماد مراجعة ولا يمنع السداد.
-- ---------------------------------------------------------------------------
alter table public.purchases add column approved_at timestamptz, add column approved_by uuid;

create function public.approve_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.purchases;
begin
  if not public.is_admin() then raise exception 'اعتماد الفواتير للمدير فقط' using errcode = '42501'; end if;
  select * into p from public.purchases where id = p_purchase_id for update;
  if not found or p.status <> 'posted' then raise exception 'الفاتورة غير صالحة'; end if;
  if p.approved_at is not null then return; end if;
  update public.purchases set approved_at = now(), approved_by = auth.uid() where id = p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) راتب على مشروع: من خزائن قطاع المشروع أو الخزينة العامة فقط
-- ---------------------------------------------------------------------------
create function public.validate_payroll_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_domain text;
begin
  select pr.project_type::text into v_type
    from public.payroll_slips s join public.projects pr on pr.id = s.project_id
    where s.id = new.slip_id;
  if v_type is null then return new; end if;
  select domain::text into v_domain from public.treasuries where id = new.treasury_id;
  if v_domain not in (v_type, 'general') then
    raise exception 'راتب هذا المشروع يُصرف من خزائن قطاعه أو الخزينة العامة' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger payroll_payments_validate before insert on public.payroll_payments
  for each row execute function public.validate_payroll_payment();

revoke all on function
  public.receive_from_supplier(uuid, uuid, uuid, numeric, date, uuid, public.payment_method, text),
  public.reverse_supplier_refund(uuid, text, date),
  public.assign_payment_to_project(text, uuid, uuid),
  public.transfer_between_treasuries(uuid, uuid, uuid, numeric, date, text, text),
  public.approve_purchase(uuid),
  public.validate_payroll_payment()
  from public, anon;
grant execute on function
  public.receive_from_supplier(uuid, uuid, uuid, numeric, date, uuid, public.payment_method, text),
  public.reverse_supplier_refund(uuid, text, date),
  public.assign_payment_to_project(text, uuid, uuid),
  public.transfer_between_treasuries(uuid, uuid, uuid, numeric, date, text, text),
  public.approve_purchase(uuid)
  to authenticated, service_role;
grant select on public.treasury_loans to authenticated;

notify pgrst, 'reload schema';
