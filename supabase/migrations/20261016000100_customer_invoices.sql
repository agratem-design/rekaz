-- فواتير الزبائن التاريخية: المطالبات المصدرة مستقلة عن تكاليف التنفيذ وسلف العمال.
-- الملخصات وثائق مرجعية فقط؛ لا تكرر مطالبة أو حركة خزينة.
begin;
create table public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  project_id uuid references public.projects(id),
  document_type text not null check (document_type in ('contracting','reimbursement','finishing','opening_balance','service','summary')),
  source_key text not null unique check (length(trim(source_key)) > 0),
  invoice_number text,
  invoice_date date,
  title text not null check (length(trim(title)) > 0),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) > 0),
  subtotal numeric(16,3) not null check (subtotal >= 0),
  fee_percentage numeric(7,3) not null default 0 check (fee_percentage between 0 and 100),
  fee_amount numeric(16,3) not null default 0 check (fee_amount >= 0),
  amount numeric(16,3) not null check (amount >= 0),
  source_filename text,
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz, reversed_by uuid, reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  check (document_type = 'summary' or project_id is not null),
  check (document_type = 'summary' or (amount = subtotal + fee_amount and fee_amount = round(subtotal * fee_percentage / 100,3)))
);
create index customer_invoices_client_idx on public.customer_invoices(client_id);
create index customer_invoices_project_idx on public.customer_invoices(project_id);
create function public.validate_customer_invoice() returns trigger language plpgsql set search_path = '' as $$
declare total numeric; line jsonb;
begin
  perform public.assert_project_belongs_to_client(new.project_id,new.client_id);
  for line in select * from jsonb_array_elements(new.lines) loop
    if jsonb_typeof(line) <> 'object' or nullif(trim(line->>'label'),'') is null or jsonb_typeof(line->'amount') is distinct from 'number' then
      raise exception 'كل سطر يتطلب بياناً ومبلغاً رقمياً' using errcode='23514';
    end if;
    if new.document_type <> 'summary' and (line->>'amount')::numeric < 0 then
      raise exception 'مبلغ سطر الفاتورة لا يكون سالباً' using errcode='23514';
    end if;
  end loop;
  select sum((v->>'amount')::numeric) into total from jsonb_array_elements(new.lines) v;
  if new.document_type <> 'summary' and total <> new.subtotal then
    raise exception 'مجموع الأسطر لا يطابق الإجمالي قبل الأتعاب' using errcode='23514';
  end if;
  if tg_op='UPDATE' then
    if old.status <> 'posted' or new.status <> 'reversed'
      or (to_jsonb(new) - array['status','reversed_at','reversed_by','reversal_reason']) is distinct from (to_jsonb(old) - array['status','reversed_at','reversed_by','reversal_reason']) then
      raise exception 'الفاتورة المصدرة لا تعدل؛ ألغها بقيد عكسي' using errcode='23514';
    end if;
    perform public.assert_reversible(old.status,new.reversal_reason);
  end if;
  return new;
end; $$;
create trigger customer_invoices_validate before insert or update on public.customer_invoices for each row execute function public.validate_customer_invoice();
create trigger customer_invoices_audit after insert or update or delete on public.customer_invoices for each row execute function public.write_audit_log();
alter table public.customer_invoices enable row level security;
create policy customer_invoices_read on public.customer_invoices for select to authenticated using(public.is_finance());
grant select on public.customer_invoices to authenticated;
grant all on public.customer_invoices to service_role;

create function public.record_customer_invoice(p_key uuid,p_document jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; existing public.customer_invoices; sub numeric;
begin
  perform public.require_finance();
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select * into existing from public.customer_invoices where idempotency_key=p_key;
  if found then return existing.id; end if;
  select * into existing from public.customer_invoices where source_key=p_document->>'source_key';
  if found then raise exception 'المستند المصدر مستورد مسبقاً' using errcode='23505'; end if;
  select sum((v->>'amount')::numeric) into sub from jsonb_array_elements(p_document->'lines') v;
  insert into public.customer_invoices(client_id,project_id,document_type,source_key,invoice_number,invoice_date,title,lines,subtotal,fee_percentage,fee_amount,amount,source_filename,notes,idempotency_key)
  values ((p_document->>'client_id')::uuid,nullif(p_document->>'project_id','')::uuid,p_document->>'document_type',p_document->>'source_key',p_document->>'invoice_number',nullif(p_document->>'invoice_date','')::date,p_document->>'title',p_document->'lines',
    case when p_document->>'document_type'='summary' then coalesce((p_document->>'subtotal')::numeric,0) else sub end,
    coalesce((p_document->>'fee_percentage')::numeric,0),
    case when p_document->>'document_type'='summary' then 0 else round(sub*coalesce((p_document->>'fee_percentage')::numeric,0)/100,3) end,
    case when p_document->>'document_type'='summary' then (p_document->>'amount')::numeric else sub+round(sub*coalesce((p_document->>'fee_percentage')::numeric,0)/100,3) end,
    p_document->>'source_filename',p_document->>'notes',p_key)
  returning id into result;
  return result;
end; $$;
create function public.reverse_customer_invoice(p_invoice_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.require_finance();
  update public.customer_invoices set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=p_reason where id=p_invoice_id;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
end; $$;
revoke all on function public.validate_customer_invoice(),public.record_customer_invoice(uuid,jsonb),public.reverse_customer_invoice(uuid,text) from public,anon,authenticated;
grant execute on function public.record_customer_invoice(uuid,jsonb),public.reverse_customer_invoice(uuid,text) to authenticated,service_role;
create or replace view public.project_financials
with (security_invoker = true)
as
with contract_totals as (
  select project_id, sum(amount) as contracts_total
  from public.contracts
  where status in ('active', 'completed') and project_id is not null
  group by project_id
),
invoice_totals as (
  select project_id, sum(amount) as invoiced, sum(fee_amount) as fee
  from public.customer_invoices where status = 'posted' and document_type <> 'summary' group by project_id
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
    when inv.project_id is not null then inv.fee
    when p.project_type = 'finishing' then round(pc.direct_cost * coalesce(p.finishing_percentage, 0) / 100, 3)
  end::numeric(16, 3) as company_fee,
  case
    when inv.project_id is not null then inv.invoiced
    when p.project_type = 'finishing' then round(pc.direct_cost * (1 + coalesce(p.finishing_percentage, 0) / 100), 3)
    else coalesce(ct.contracts_total, it.items_total, 0)
  end::numeric(16, 3) as client_obligation,
  col.collected,
  (case
    when inv.project_id is not null then inv.invoiced
    when p.project_type = 'finishing' then round(pc.direct_cost * (1 + coalesce(p.finishing_percentage, 0) / 100), 3)
    else coalesce(ct.contracts_total, it.items_total, 0)
  end - col.collected)::numeric(16, 3) as client_remaining,
  (case
    when inv.project_id is not null then inv.fee
    when p.project_type = 'finishing' then round(pc.direct_cost * coalesce(p.finishing_percentage, 0) / 100, 3)
    else coalesce(it.earned_value, 0) - pc.direct_cost
  end)::numeric(16, 3) as gross_profit_to_date
from public.projects p
join public.project_costs pc on pc.project_id = p.id
join public.project_collections col on col.project_id = p.id
left join invoice_totals inv on inv.project_id = p.id
left join contract_totals ct on ct.project_id = p.id
left join item_totals it on it.project_id = p.id;

comment on table public.customer_invoices is 'Issued customer invoices and source summaries. Posted non-summary documents replace estimated project obligations; costs and payments remain independent.';
notify pgrst, 'reload schema';
commit;
