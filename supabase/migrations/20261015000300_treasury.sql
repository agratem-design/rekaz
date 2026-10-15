-- ركاز v2 — الخزائن ودفتر الحركات
-- رصيد الخزينة لا يُخزَّن: هو دائماً مجموع حركاتها. الحركات لا تُعدَّل ولا تُحذف.

create table public.treasuries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  domain public.treasury_domain not null,
  kind public.treasury_kind not null default 'cash',
  parent_id uuid references public.treasuries (id),
  bank_name text,
  account_number text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_bank_fields check (kind = 'bank' or (bank_name is null and account_number is null))
);
create trigger treasuries_touch before update on public.treasuries for each row execute function public.touch_updated_at();

-- الفرع يتبع قطاع أصله، ولا يغيّر قطاعه بعد وجود حركات
create function public.validate_treasury()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_domain public.treasury_domain;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'لا يمكن أن تكون الخزينة أصلاً لنفسها';
    end if;
    select domain into v_parent_domain from public.treasuries where id = new.parent_id;
    if v_parent_domain is distinct from new.domain then
      raise exception 'الفرع يجب أن يتبع قطاع الخزينة الأصل' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.domain <> old.domain
     and exists (select 1 from public.treasury_entries where treasury_id = new.id) then
    raise exception 'لا يمكن تغيير قطاع خزينة لها حركات' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- مصادر الحركات المسموحة: كل حركة مرتبطة بسجل مصدر واحد بمعرّفه
create type public.entry_source as enum (
  'opening_balance',
  'client_receipt',
  'supplier_payment',
  'technician_payment',
  'technician_deposit',
  'expense',
  'transfer',
  'custody_issue',
  'custody_return',
  'payroll_slip',
  'employee_advance',
  'advance_repayment'
);

create table public.treasury_entries (
  id uuid primary key default gen_random_uuid(),
  treasury_id uuid not null references public.treasuries (id),
  direction text not null check (direction in ('in', 'out')),
  amount public.positive_money not null,
  entry_date date not null,
  source_type public.entry_source not null,
  source_id uuid not null,
  reverses_entry_id uuid unique references public.treasury_entries (id),
  memo text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index treasury_entries_treasury_idx on public.treasury_entries (treasury_id, entry_date);
create index treasury_entries_source_idx on public.treasury_entries (source_type, source_id);

create trigger treasuries_validate before insert or update on public.treasuries
  for each row execute function public.validate_treasury();
create trigger treasury_entries_immutable before update or delete on public.treasury_entries
  for each row execute function public.forbid_mutation();

create view public.treasury_balances
with (security_invoker = true)
as
select
  t.id as treasury_id,
  t.name,
  t.domain,
  t.kind,
  t.parent_id,
  t.is_active,
  coalesce(sum(case when e.direction = 'in' then e.amount else -e.amount end), 0)::numeric(14, 3) as balance
from public.treasuries t
left join public.treasury_entries e on e.treasury_id = t.id
group by t.id;

-- المسار الوحيد لكتابة حركة خزينة. يقفل الخزينة ويمنع الرصيد السالب.
-- داخلي: لا يُمنح لأي دور خارجي.
create function public.post_treasury_entry(
  p_treasury_id uuid,
  p_direction text,
  p_amount numeric,
  p_date date,
  p_source_type public.entry_source,
  p_source_id uuid,
  p_memo text default null,
  p_reverses uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active boolean;
  v_balance numeric;
  v_id uuid;
begin
  select is_active into v_active from public.treasuries where id = p_treasury_id for update;
  if not found then
    raise exception 'الخزينة غير موجودة';
  end if;
  if not v_active and p_reverses is null then
    raise exception 'الخزينة موقوفة';
  end if;

  if p_direction = 'out' and not (select allow_negative_treasury from public.company_settings where id = 1) then
    select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)
      into v_balance
      from public.treasury_entries where treasury_id = p_treasury_id;
    if v_balance < p_amount then
      raise exception 'الرصيد غير كافٍ: المتاح % والمطلوب %', v_balance, p_amount using errcode = '23514';
    end if;
  end if;

  insert into public.treasury_entries
    (treasury_id, direction, amount, entry_date, source_type, source_id, memo, reverses_entry_id)
  values
    (p_treasury_id, p_direction, p_amount, p_date, p_source_type, p_source_id, p_memo, p_reverses)
  returning id into v_id;
  return v_id;
end;
$$;

-- يعكس كل حركات مصدر معيّن بحركات معاكسة مرتبطة بها
create function public.reverse_treasury_entries(
  p_source_type public.entry_source,
  p_source_id uuid,
  p_date date,
  p_memo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select * from public.treasury_entries e
    where e.source_type = p_source_type
      and e.source_id = p_source_id
      and e.reverses_entry_id is null
      and not exists (select 1 from public.treasury_entries x where x.reverses_entry_id = e.id)
    order by e.created_at
  loop
    perform public.post_treasury_entry(
      r.treasury_id,
      case when r.direction = 'in' then 'out' else 'in' end,
      r.amount, p_date, p_source_type, p_source_id, p_memo, r.id
    );
  end loop;
end;
$$;

-- رصيد افتتاحي لخزينة جديدة (مرة واحدة)
create function public.set_opening_balance(p_treasury_id uuid, p_amount numeric, p_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_finance();
  if exists (select 1 from public.treasury_entries where treasury_id = p_treasury_id) then
    raise exception 'لا يمكن وضع رصيد افتتاحي لخزينة لها حركات';
  end if;
  return public.post_treasury_entry(p_treasury_id, 'in', p_amount, p_date, 'opening_balance', p_treasury_id, 'رصيد افتتاحي');
end;
$$;
