-- ركاز v2 — المشاريع، المراحل، البنود، متطلبات العمالة، العقود

create type public.project_status as enum ('planned', 'active', 'on_hold', 'completed', 'cancelled');
create type public.budget_type as enum ('fixed', 'estimated');
create type public.supervision_mode as enum ('none', 'fixed_amount', 'percentage');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  project_type public.project_type not null,
  client_id uuid not null references public.clients (id),
  status public.project_status not null default 'active',
  location text,
  description text,
  start_date date,
  end_date date,
  budget public.money,
  budget_type public.budget_type,
  -- نسبة إدارة الشركة على التكلفة المباشرة: إلزامية للتشطيبات، ممنوعة للمقاولات
  finishing_percentage numeric(5, 2) check (finishing_percentage between 0 and 100),
  supervising_engineer_id uuid references public.engineers (id),
  supervision_mode public.supervision_mode not null default 'none',
  supervision_value numeric(14, 3) check (supervision_value >= 0),
  default_treasury_id uuid references public.treasuries (id),
  image_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_dates check (end_date is null or start_date is null or end_date >= start_date),
  constraint project_finishing_pct check (
    (project_type = 'finishing' and finishing_percentage is not null)
    or (project_type = 'contracting' and finishing_percentage is null)
  ),
  constraint project_supervision check (
    (supervision_mode = 'none' and supervision_value is null)
    or (supervision_mode <> 'none' and supervision_value is not null)
  )
);
create index projects_client_idx on public.projects (client_id);
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- الخزينة المستخدمة في أي عملية لمشروع يجب أن تتبع قطاع نوع المشروع
create function public.assert_treasury_for_project(p_treasury_id uuid, p_project_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_domain public.treasury_domain;
  v_type public.project_type;
begin
  if p_treasury_id is null or p_project_id is null then
    return;
  end if;
  select domain into v_domain from public.treasuries where id = p_treasury_id;
  select project_type into v_type from public.projects where id = p_project_id;
  if v_domain::text is distinct from v_type::text then
    raise exception 'الخزينة لا تتبع قطاع هذا المشروع' using errcode = '23514';
  end if;
end;
$$;

create function public.validate_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.default_treasury_id is not null and (
    select domain::text from public.treasuries where id = new.default_treasury_id
  ) <> new.project_type::text then
    raise exception 'الخزينة الافتراضية لا تتبع قطاع نوع المشروع' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.project_type <> old.project_type then
    raise exception 'لا يمكن تغيير نوع المشروع بعد إنشائه' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.client_id <> old.client_id
     and exists (select 1 from public.client_receipts where project_id = new.id) then
    raise exception 'لا يمكن تغيير زبون مشروع عليه دفعات' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger projects_validate before insert or update on public.projects
  for each row execute function public.validate_project();

-- ---------------------------------------------------------------------------
-- المراحل: رقم مرجعي سنوي تلقائي
-- ---------------------------------------------------------------------------
create type public.phase_status as enum ('planned', 'in_progress', 'completed', 'on_hold');

create table public.phase_reference_counters (
  year int primary key,
  last_number int not null default 0
);

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  reference_number text unique,
  status public.phase_status not null default 'planned',
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase_dates check (end_date is null or start_date is null or end_date >= start_date)
);
create index project_phases_project_idx on public.project_phases (project_id);
create trigger project_phases_touch before update on public.project_phases for each row execute function public.touch_updated_at();

create function public.assign_phase_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from coalesce(new.start_date, current_date));
  v_n int;
begin
  if new.reference_number is null then
    insert into public.phase_reference_counters (year, last_number) values (v_year, 1)
    on conflict (year) do update set last_number = public.phase_reference_counters.last_number + 1
    returning last_number into v_n;
    -- نفس صيغة النسخة السابقة: رقم/سنة من خانتين، مثل 48/26
    new.reference_number := v_n || '/' || lpad((v_year % 100)::text, 2, '0');
  end if;
  return new;
end;
$$;
create trigger project_phases_reference before insert on public.project_phases
  for each row execute function public.assign_phase_reference();

-- ---------------------------------------------------------------------------
-- وحدات القياس والبنود العامة
-- ---------------------------------------------------------------------------
-- components: أسماء الأبعاد المطلوبة، مثل ["length","width"]. الكمية = حاصل ضربها × factor
create table public.measurement_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  symbol text not null,
  components jsonb not null default '[]'::jsonb check (jsonb_typeof(components) = 'array'),
  factor numeric(12, 6) not null default 1 check (factor > 0),
  created_at timestamptz not null default now()
);

insert into public.measurement_units (name, symbol, components) values
  ('متر طولي', 'م.ط', '["length"]'),
  ('متر مربع', 'م²', '["length","width"]'),
  ('متر مكعب', 'م³', '["length","width","height"]'),
  ('قطعة', 'قطعة', '[]'),
  ('مقطوعية', 'مقطوعية', '[]');

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  unit_id uuid references public.measurement_units (id),
  default_unit_price public.money,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger catalog_items_touch before update on public.catalog_items for each row execute function public.touch_updated_at();

create table public.catalog_item_requirements (
  catalog_item_id uuid not null references public.catalog_items (id) on delete cascade,
  technician_type_id uuid not null references public.technician_types (id),
  required_count int not null check (required_count > 0),
  primary key (catalog_item_id, technician_type_id)
);

-- ---------------------------------------------------------------------------
-- بنود المشروع (المقايسة)
-- ---------------------------------------------------------------------------
create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid references public.project_phases (id) on delete set null,
  catalog_item_id uuid references public.catalog_items (id) on delete set null,
  name text not null,
  description text,
  unit_id uuid references public.measurement_units (id),
  dimensions jsonb not null default '{}'::jsonb,
  quantity numeric(14, 3) not null check (quantity >= 0),
  unit_price public.money not null default 0,
  total_price numeric(16, 3) generated always as (round(quantity * unit_price, 3)) stored,
  progress numeric(5, 2) not null default 0 check (progress between 0 and 100),
  engineer_id uuid references public.engineers (id),
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_items_project_idx on public.project_items (project_id);
create trigger project_items_touch before update on public.project_items for each row execute function public.touch_updated_at();

-- البند والمرحلة يجب أن يتبعا نفس المشروع
create function public.validate_project_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phase_id is not null and not exists (
    select 1 from public.project_phases where id = new.phase_id and project_id = new.project_id
  ) then
    raise exception 'المرحلة لا تتبع هذا المشروع' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'لا يمكن نقل بند إلى مشروع آخر' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger project_items_validate before insert or update on public.project_items
  for each row execute function public.validate_project_item();

-- نسخة مستقلة من متطلبات البند العام وقت الإنشاء
create table public.project_item_requirements (
  project_item_id uuid not null references public.project_items (id) on delete cascade,
  technician_type_id uuid not null references public.technician_types (id),
  required_count int not null check (required_count > 0),
  primary key (project_item_id, technician_type_id)
);

create function public.snapshot_item_requirements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.catalog_item_id is not null then
    insert into public.project_item_requirements (project_item_id, technician_type_id, required_count)
    select new.id, technician_type_id, required_count
    from public.catalog_item_requirements where catalog_item_id = new.catalog_item_id
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger project_items_snapshot after insert on public.project_items
  for each row execute function public.snapshot_item_requirements();

-- تعيين فني على بند: خطة عمل فقط، صفر أثر مالي
create table public.project_item_assignments (
  id uuid primary key default gen_random_uuid(),
  project_item_id uuid not null references public.project_items (id) on delete cascade,
  technician_id uuid not null references public.technicians (id),
  rate_unit public.rate_unit,
  agreed_rate public.money,
  planned_quantity numeric(14, 3) check (planned_quantity >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (project_item_id, technician_id)
);

create view public.project_item_staffing
with (security_invoker = true)
as
select
  r.project_item_id,
  r.technician_type_id,
  r.required_count,
  count(a.id) filter (where t.technician_type_id = r.technician_type_id) as assigned_count,
  greatest(0, r.required_count - count(a.id) filter (where t.technician_type_id = r.technician_type_id)) as missing_count
from public.project_item_requirements r
left join public.project_item_assignments a on a.project_item_id = r.project_item_id
left join public.technicians t on t.id = a.technician_id
group by r.project_item_id, r.technician_type_id, r.required_count;

-- ---------------------------------------------------------------------------
-- العقود
-- ---------------------------------------------------------------------------
create type public.contract_status as enum ('draft', 'active', 'completed', 'cancelled');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text unique,
  title text not null,
  client_id uuid not null references public.clients (id),
  project_id uuid references public.projects (id),
  phase_id uuid references public.project_phases (id),
  amount public.money not null default 0,
  status public.contract_status not null default 'draft',
  start_date date,
  end_date date,
  payment_terms text,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contracts_touch before update on public.contracts for each row execute function public.touch_updated_at();

create function public.validate_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects where id = new.project_id and client_id = new.client_id
  ) then
    raise exception 'المشروع لا يتبع زبون العقد' using errcode = '23514';
  end if;
  if new.phase_id is not null and not exists (
    select 1 from public.project_phases where id = new.phase_id and project_id = new.project_id
  ) then
    raise exception 'المرحلة لا تتبع مشروع العقد' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger contracts_validate before insert or update on public.contracts
  for each row execute function public.validate_contract();

create table public.contract_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  project_item_id uuid references public.project_items (id) on delete set null,
  name text not null,
  description text,
  quantity numeric(14, 3) not null default 1 check (quantity >= 0),
  unit_price public.money not null default 0,
  total_price numeric(16, 3) generated always as (round(quantity * unit_price, 3)) stored,
  order_index int not null default 0
);

create table public.clause_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  is_active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.contract_clauses (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  title text not null,
  content text not null,
  order_index int not null default 0
);
