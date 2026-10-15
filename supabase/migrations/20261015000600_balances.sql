-- ركاز v2 — الأرصدة والملخصات
-- كل رقم مالي يُعرض في الواجهة يأتي من هذه العروض، لا من حساب في المتصفح.
-- السجلات الملغاة (status = 'reversed') لا تدخل أي مجموع.

-- ---------------------------------------------------------------------------
-- تكاليف المشروع المباشرة
-- ---------------------------------------------------------------------------
create view public.project_costs
with (security_invoker = true)
as
select
  p.id as project_id,
  coalesce(pu.materials, 0)::numeric(16, 3) as materials,
  coalesce(pu.services, 0)::numeric(16, 3) as services,
  coalesce(pu.returns, 0)::numeric(16, 3) as returns,
  coalesce(tw.labor, 0)::numeric(16, 3) as labor,
  coalesce(ex.expenses, 0)::numeric(16, 3) as expenses,
  (coalesce(pu.materials, 0) + coalesce(pu.services, 0) - coalesce(pu.returns, 0)
   + coalesce(tw.labor, 0) + coalesce(ex.expenses, 0))::numeric(16, 3) as direct_cost
from public.projects p
left join (
  select project_id,
    sum(total_amount) filter (where kind = 'material') as materials,
    sum(total_amount) filter (where kind = 'service') as services,
    sum(total_amount) filter (where kind = 'return') as returns
  from public.purchases where status = 'posted' and project_id is not null
  group by project_id
) pu on pu.project_id = p.id
left join (
  select project_id, sum(amount) as labor
  from public.technician_work where status = 'posted'
  group by project_id
) tw on tw.project_id = p.id
left join (
  select project_id, sum(amount) as expenses
  from public.expenses where status = 'posted' and project_id is not null
  group by project_id
) ex on ex.project_id = p.id;

-- ---------------------------------------------------------------------------
-- تحصيلات المشروع
-- ---------------------------------------------------------------------------
create view public.project_collections
with (security_invoker = true)
as
select
  p.id as project_id,
  coalesce(r.receipts, 0)::numeric(16, 3) as receipts,
  coalesce(c.credit_applied, 0)::numeric(16, 3) as credit_applied,
  coalesce(c.moved_to_credit, 0)::numeric(16, 3) as moved_to_credit,
  (coalesce(r.receipts, 0) + coalesce(c.credit_applied, 0) - coalesce(c.moved_to_credit, 0))::numeric(16, 3) as collected
from public.projects p
left join (
  select project_id, sum(amount) as receipts
  from public.client_receipts where status = 'posted' and project_id is not null
  group by project_id
) r on r.project_id = p.id
left join (
  -- الأثر الصافي لكل قيد على المشروع، مع احتساب القيود العكسية بإشارة أصلها
  select coalesce(e.project_id, o.project_id) as project_id,
    sum(case when coalesce(o.kind, e.kind) = 'application' then -e.amount end) as credit_applied,
    sum(case when coalesce(o.kind, e.kind) = 'from_project' then e.amount end) as moved_to_credit
  from public.client_credit_entries e
  left join public.client_credit_entries o on o.id = e.reverses_entry_id
  where coalesce(o.kind, e.kind) in ('application', 'from_project')
  group by 1
) c on c.project_id = p.id;

-- ---------------------------------------------------------------------------
-- الملخص المالي للمشروع
-- مقاولات: الالتزام = العقود الفعالة، وإلا مجموع البنود
-- تشطيبات: الالتزام = التكلفة المباشرة × (1 + النسبة)
-- ---------------------------------------------------------------------------
create view public.project_financials
with (security_invoker = true)
as
with contract_totals as (
  select project_id, sum(amount) as contracts_total
  from public.contracts
  where status in ('active', 'completed') and project_id is not null
  group by project_id
),
item_totals as (
  select project_id,
    sum(total_price) as items_total,
    sum(total_price * progress / 100) as earned_value
  from public.project_items
  group by project_id
)
select
  p.id as project_id,
  p.name,
  p.project_type,
  p.client_id,
  p.status,
  pc.direct_cost,
  pc.materials, pc.services, pc.returns, pc.labor, pc.expenses,
  coalesce(ct.contracts_total, 0)::numeric(16, 3) as contracts_total,
  coalesce(it.items_total, 0)::numeric(16, 3) as items_total,
  coalesce(it.earned_value, 0)::numeric(16, 3) as earned_value,
  case
    when p.project_type = 'finishing' then round(pc.direct_cost * coalesce(p.finishing_percentage, 0) / 100, 3)
  end::numeric(16, 3) as company_fee,
  case
    when p.project_type = 'finishing' then round(pc.direct_cost * (1 + coalesce(p.finishing_percentage, 0) / 100), 3)
    else coalesce(ct.contracts_total, it.items_total, 0)
  end::numeric(16, 3) as client_obligation,
  col.collected,
  (case
    when p.project_type = 'finishing' then round(pc.direct_cost * (1 + coalesce(p.finishing_percentage, 0) / 100), 3)
    else coalesce(ct.contracts_total, it.items_total, 0)
  end - col.collected)::numeric(16, 3) as client_remaining,
  (case
    when p.project_type = 'finishing' then round(pc.direct_cost * coalesce(p.finishing_percentage, 0) / 100, 3)
    else coalesce(it.earned_value, 0) - pc.direct_cost
  end)::numeric(16, 3) as gross_profit_to_date
from public.projects p
join public.project_costs pc on pc.project_id = p.id
join public.project_collections col on col.project_id = p.id
left join contract_totals ct on ct.project_id = p.id
left join item_totals it on it.project_id = p.id;

-- ---------------------------------------------------------------------------
-- ربحية بنود المقاولات
-- ---------------------------------------------------------------------------
create view public.project_item_profitability
with (security_invoker = true)
as
select
  i.id as project_item_id,
  i.project_id,
  i.name,
  i.total_price as commercial_value,
  i.progress,
  round(i.total_price * i.progress / 100, 3)::numeric(16, 3) as earned_value,
  coalesce(l.labor, 0)::numeric(16, 3) as labor,
  coalesce(m.purchases, 0)::numeric(16, 3) as purchases,
  coalesce(e.expenses, 0)::numeric(16, 3) as expenses,
  (coalesce(l.labor, 0) + coalesce(m.purchases, 0) + coalesce(e.expenses, 0))::numeric(16, 3) as incurred_cost,
  (round(i.total_price * i.progress / 100, 3)
   - coalesce(l.labor, 0) - coalesce(m.purchases, 0) - coalesce(e.expenses, 0))::numeric(16, 3) as gross_profit_to_date
from public.project_items i
left join (
  select project_item_id, sum(amount) as labor from public.technician_work
  where status = 'posted' and project_item_id is not null group by 1
) l on l.project_item_id = i.id
left join (
  select project_item_id,
    sum(case when kind = 'return' then -total_amount else total_amount end) as purchases
  from public.purchases where status = 'posted' and project_item_id is not null group by 1
) m on m.project_item_id = i.id
left join (
  select project_item_id, sum(amount) as expenses from public.expenses
  where status = 'posted' and project_item_id is not null group by 1
) e on e.project_item_id = i.id;

-- ---------------------------------------------------------------------------
-- الزبائن: كشف لكل مشروع + رصيد دائن منفصل
-- ---------------------------------------------------------------------------
create view public.client_credit_balances
with (security_invoker = true)
as
select c.id as client_id, coalesce(sum(e.amount), 0)::numeric(16, 3) as available_credit
from public.clients c
left join public.client_credit_entries e on e.client_id = c.id
group by c.id;

create view public.client_balances
with (security_invoker = true)
as
select
  c.id as client_id,
  c.name,
  coalesce(sum(f.client_obligation), 0)::numeric(16, 3) as total_obligation,
  coalesce(sum(f.collected), 0)::numeric(16, 3) as total_collected,
  -- مجموع المتبقي على المشاريع غير المسددة فقط؛ زيادة مشروع لا تخفي دين مشروع آخر
  coalesce(sum(greatest(f.client_remaining, 0)), 0)::numeric(16, 3) as total_due,
  coalesce(sum(greatest(-f.client_remaining, 0)), 0)::numeric(16, 3) as total_overpaid_on_projects,
  cb.available_credit
from public.clients c
left join public.project_financials f on f.client_id = c.id
join public.client_credit_balances cb on cb.client_id = c.id
group by c.id, cb.available_credit;

-- ---------------------------------------------------------------------------
-- الموردون والفواتير
-- ---------------------------------------------------------------------------
create view public.purchase_balances
with (security_invoker = true)
as
select
  p.id as purchase_id,
  p.supplier_id,
  p.project_id,
  p.kind,
  p.total_amount,
  coalesce(a.paid, 0)::numeric(16, 3) as paid,
  case when p.kind = 'return' then 0 else p.total_amount - coalesce(a.paid, 0) end::numeric(16, 3) as remaining
from public.purchases p
left join (
  select purchase_id, sum(amount) as paid
  from public.supplier_payment_allocations where status = 'posted'
  group by purchase_id
) a on a.purchase_id = p.id
where p.status = 'posted';

create view public.supplier_balances
with (security_invoker = true)
as
select
  s.id as supplier_id,
  s.name,
  coalesce(pu.invoiced, 0)::numeric(16, 3) as invoiced,
  coalesce(pu.returned, 0)::numeric(16, 3) as returned,
  coalesce(pa.paid, 0)::numeric(16, 3) as paid,
  coalesce(pa.paid, 0) - coalesce(al.allocated, 0) as unallocated_advance,
  (coalesce(pu.invoiced, 0) - coalesce(pu.returned, 0) - coalesce(pa.paid, 0))::numeric(16, 3) as balance_due
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
) al on al.supplier_id = s.id;

-- ---------------------------------------------------------------------------
-- الفنيون
-- ---------------------------------------------------------------------------
create view public.technician_balances
with (security_invoker = true)
as
select
  t.id as technician_id,
  t.name,
  coalesce(w.earned, 0)::numeric(16, 3) as earned,
  coalesce(pa.paid, 0)::numeric(16, 3) as paid,
  coalesce(r.received, 0)::numeric(16, 3) as received_back,
  -- موجب = مستحق للفني، سالب = مقدم عند الفني
  (coalesce(w.earned, 0) - coalesce(pa.paid, 0) + coalesce(r.received, 0))::numeric(16, 3) as balance_due
from public.technicians t
left join (select technician_id, sum(amount) as earned from public.technician_work where status = 'posted' group by 1) w on w.technician_id = t.id
left join (select technician_id, sum(amount) as paid from public.technician_payments where status = 'posted' group by 1) pa on pa.technician_id = t.id
left join (select technician_id, sum(amount) as received from public.technician_receipts where status = 'posted' group by 1) r on r.technician_id = t.id;

-- ---------------------------------------------------------------------------
-- العُهد
-- ---------------------------------------------------------------------------
create view public.custody_balances
with (security_invoker = true)
as
select
  c.id as custody_id,
  c.employee_id,
  c.engineer_id,
  c.project_id,
  c.amount as issued,
  coalesce(e.spent, 0)::numeric(16, 3) as spent,
  coalesce(r.returned, 0)::numeric(16, 3) as returned,
  (c.amount - coalesce(e.spent, 0) - coalesce(r.returned, 0))::numeric(16, 3) as remaining,
  c.is_closed
from public.custodies c
left join (select custody_id, sum(amount) as spent from public.expenses where status = 'posted' and custody_id is not null group by 1) e on e.custody_id = c.id
left join (select custody_id, sum(amount) as returned from public.custody_returns where status = 'posted' group by 1) r on r.custody_id = c.id
where c.status = 'posted';
