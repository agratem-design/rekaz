-- ركاز v2 — السداد على مستوى المشروع
-- المقاول وسيط: قبض الزبون يدخل الخزينة، وكل صرف للمشروع يخرج منها، ولا يرتبط أحدهما بالآخر.
-- لكل مشروع حسابه مع كل مورد وفني، والدفعة تُسجل على المشروع دون اشتراط فاتورة أو بند.
-- التكلفة لا تتغير بالسداد: الاستحقاق منفصل عن النقد كما في القاعدة 4.5.

alter table public.supplier_payments add column project_id uuid references public.projects (id);
create index supplier_payments_project_idx on public.supplier_payments (project_id);

-- ---------------------------------------------------------------------------
-- حساب المورد في كل مشروع. project_id فارغ = عام (مشتريات عامة أو دفعة على الحساب).
-- الموزع يتبع مشروع فاتورته، وغير الموزع يتبع مشروع دفعته؛ والمجموع يساوي supplier_balances.
-- ---------------------------------------------------------------------------
create view public.supplier_project_balances
with (security_invoker = true)
as
select
  supplier_id,
  project_id,
  sum(invoiced)::numeric(16, 3) as invoiced,
  sum(returned)::numeric(16, 3) as returned,
  sum(paid)::numeric(16, 3) as paid,
  sum(advance)::numeric(16, 3) as unallocated_advance,
  sum(invoiced - returned - paid)::numeric(16, 3) as balance_due
from (
  select supplier_id, project_id,
    case when kind = 'return' then 0 else total_amount end as invoiced,
    case when kind = 'return' then total_amount else 0 end as returned,
    0::numeric as paid,
    0::numeric as advance
  from public.purchases
  where status = 'posted'
  union all
  select pu.supplier_id, pu.project_id, 0, 0, a.amount, 0
  from public.supplier_payment_allocations a
  join public.purchases pu on pu.id = a.purchase_id
  where a.status = 'posted'
  union all
  select sp.supplier_id, sp.project_id, 0, 0,
    sp.amount - coalesce(x.allocated, 0),
    sp.amount - coalesce(x.allocated, 0)
  from public.supplier_payments sp
  left join (
    select payment_id, sum(amount) as allocated
    from public.supplier_payment_allocations where status = 'posted'
    group by payment_id
  ) x on x.payment_id = sp.id
  where sp.status = 'posted'
) m
group by supplier_id, project_id;

-- ---------------------------------------------------------------------------
-- حساب الفني في كل مشروع. الفارغ = على حسابه العام؛ والمجموع يساوي technician_balances.
-- ---------------------------------------------------------------------------
create view public.technician_project_balances
with (security_invoker = true)
as
select
  technician_id,
  project_id,
  sum(earned)::numeric(16, 3) as earned,
  sum(paid)::numeric(16, 3) as paid,
  sum(received)::numeric(16, 3) as received_back,
  sum(earned - paid + received)::numeric(16, 3) as balance_due
from (
  select technician_id, project_id, amount as earned, 0::numeric as paid, 0::numeric as received
  from public.technician_work where status = 'posted'
  union all
  select technician_id, context_project_id, 0, amount, 0
  from public.technician_payments where status = 'posted'
  union all
  select technician_id, null::uuid, 0, 0, amount
  from public.technician_receipts where status = 'posted'
) m
group by technician_id, project_id;

-- ---------------------------------------------------------------------------
-- موقف المقاول النقدي في كل مشروع: ما دخل من الزبون مقابل ما خرج فعلاً.
-- سالب = الشركة تموّل المشروع من مالها، موجب = بيدها مال للزبون لم يُصرف بعد.
-- ---------------------------------------------------------------------------
create view public.project_cash_position
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
  select project_id, sum(paid) as paid, sum(greatest(balance_due, 0)) as due
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

-- ---------------------------------------------------------------------------
-- دفعة لمورد على مشروع: لا تتطلب اختيار فاتورة أو بند.
-- تغطي فواتيره في هذا المشروع من الأقدم، والزيادة تبقى مقدماً على المشروع نفسه.
-- ---------------------------------------------------------------------------
create function public.pay_supplier_on_project(
  p_key uuid,
  p_supplier_id uuid,
  p_project_id uuid,
  p_treasury_id uuid,
  p_amount numeric,
  p_date date,
  p_method public.payment_method default 'cash',
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_purchase public.purchases;
  v_remaining numeric;
  v_part numeric;
  v_left numeric := p_amount;
begin
  perform public.require_finance();
  select id into v_id from public.supplier_payments where idempotency_key = p_key;
  if found then return v_id; end if;
  if p_project_id is null then raise exception 'المشروع مطلوب' using errcode = '23514'; end if;
  perform public.assert_treasury_for_project(p_treasury_id, p_project_id);

  insert into public.supplier_payments
    (supplier_id, project_id, treasury_id, amount, payment_date, method, reference, notes, idempotency_key)
  values
    (p_supplier_id, p_project_id, p_treasury_id, p_amount, p_date, p_method, p_reference, p_notes, p_key)
  returning id into v_id;

  for v_purchase in
    select * from public.purchases
    where supplier_id = p_supplier_id and project_id = p_project_id and status = 'posted' and kind <> 'return'
    order by invoice_date, created_at
    for update
  loop
    exit when v_left <= 0;
    select remaining into v_remaining from public.purchase_balances where purchase_id = v_purchase.id;
    continue when coalesce(v_remaining, 0) <= 0;
    v_part := least(v_left, v_remaining);
    insert into public.supplier_payment_allocations (payment_id, purchase_id, amount)
    values (v_id, v_purchase.id, v_part);
    v_left := v_left - v_part;
  end loop;

  perform public.post_treasury_entry(p_treasury_id, 'out', p_amount, p_date, 'supplier_payment', v_id, 'دفعة لمورد على مشروع');
  return v_id;
end;
$$;

-- مقدم المشروع لا يُوزَّع على مشروع آخر؛ ما يخص مشروعاً يبقى له
create or replace function public.allocate_supplier_advance(p_payment_id uuid, p_purchase_id uuid, p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sp public.supplier_payments;
  v_purchase public.purchases;
  v_unallocated numeric;
  v_remaining numeric;
  v_id uuid;
begin
  perform public.require_finance();
  if p_amount is null or p_amount <= 0 then raise exception 'المبلغ يجب أن يكون موجباً'; end if;
  select * into sp from public.supplier_payments where id = p_payment_id for update;
  if not found or sp.status <> 'posted' then raise exception 'الدفعة غير صالحة'; end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found or v_purchase.status <> 'posted' or v_purchase.kind = 'return' or v_purchase.supplier_id <> sp.supplier_id then
    raise exception 'الفاتورة غير صالحة لهذه الدفعة' using errcode = '23514';
  end if;
  if sp.project_id is not null and sp.project_id is distinct from v_purchase.project_id then
    raise exception 'هذه الدفعة مسجلة على مشروع آخر' using errcode = '23514';
  end if;
  perform public.assert_treasury_for_project(sp.treasury_id, v_purchase.project_id);
  select sp.amount - coalesce(sum(amount), 0) into v_unallocated
    from public.supplier_payment_allocations where payment_id = sp.id and status = 'posted';
  select remaining into v_remaining from public.purchase_balances where purchase_id = v_purchase.id;
  if p_amount > v_unallocated or p_amount > v_remaining then
    raise exception 'المبلغ يتجاوز المتاح من الدفعة أو المتبقي على الفاتورة' using errcode = '23514';
  end if;
  insert into public.supplier_payment_allocations (payment_id, purchase_id, amount)
  values (sp.id, v_purchase.id, p_amount) returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- تعديل عمل فني بزيادة أو نقص، أو تقسيمه بين فنيين، في عملية واحدة:
-- يُلغى السجل الأصلي بقيد مسبب، وتُنشأ مكانه أجزاء بنفس المشروع والمرحلة والبند.
-- p_parts: [{"technician_id": "...", "quantity": 8, "rate": 50}, ...]
-- ما صُرف للفني يبقى كما هو؛ وإن نقص مستحقه عن المصروف يظهر الفرق مقدماً عنده.
-- ---------------------------------------------------------------------------
create function public.rework_technician_work(p_key uuid, p_work_id uuid, p_reason text, p_parts jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.technician_work;
  j jsonb;
  v_id uuid;
  v_first uuid;
  v_key uuid;
begin
  perform public.require_finance();
  select id into v_id from public.technician_work where idempotency_key = p_key;
  if found then return v_id; end if;
  select * into w from public.technician_work where id = p_work_id for update;
  if not found then raise exception 'السجل غير موجود'; end if;
  perform public.assert_reversible(w.status, p_reason);
  if jsonb_typeof(p_parts) is distinct from 'array' or jsonb_array_length(p_parts) not between 1 and 10 then
    raise exception 'حدد فنياً واحداً على الأقل، بحد أقصى 10' using errcode = '23514';
  end if;

  update public.technician_work
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = w.id;

  for j in select value from jsonb_array_elements(p_parts) loop
    v_key := case when v_first is null then p_key else gen_random_uuid() end;
    insert into public.technician_work
      (technician_id, project_id, phase_id, project_item_id, work_date, description, rate_unit, quantity, rate, idempotency_key)
    values
      ((j ->> 'technician_id')::uuid, w.project_id, w.phase_id, w.project_item_id, w.work_date,
       w.description, w.rate_unit, (j ->> 'quantity')::numeric, (j ->> 'rate')::numeric, v_key)
    returning id into v_id;
    v_first := coalesce(v_first, v_id);
  end loop;
  return v_first;
end;
$$;

revoke all on function
  public.pay_supplier_on_project(uuid, uuid, uuid, uuid, numeric, date, public.payment_method, text, text),
  public.rework_technician_work(uuid, uuid, text, jsonb)
  from public, anon;
grant execute on function
  public.pay_supplier_on_project(uuid, uuid, uuid, uuid, numeric, date, public.payment_method, text, text),
  public.rework_technician_work(uuid, uuid, text, jsonb)
  to authenticated, service_role;
grant select on public.supplier_project_balances, public.technician_project_balances, public.project_cash_position to authenticated;

notify pgrst, 'reload schema';
