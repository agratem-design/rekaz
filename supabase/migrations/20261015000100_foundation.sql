-- ركاز v2 — الأساس: الأدوار، الملفات الشخصية، الإعدادات، سجل العمليات
-- كل الجداول في هذا المخطط مقفلة أمام anon. لا شيء يُقرأ دون تسجيل دخول.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- الأنواع
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'accountant', 'engineer', 'supervisor');
create type public.project_type as enum ('contracting', 'finishing');
create type public.treasury_domain as enum ('contracting', 'finishing', 'general');
create type public.treasury_kind as enum ('cash', 'bank');
create type public.payment_method as enum ('cash', 'bank_transfer', 'cheque', 'other');
create type public.record_status as enum ('posted', 'reversed');
create type public.storage_provider as enum ('supabase', 'google_drive');

-- المبالغ: دينار ليبي بثلاث خانات عشرية (الدرهم)
create domain public.money as numeric(14, 3) check (value >= 0);
create domain public.positive_money as numeric(14, 3) check (value > 0);

-- ---------------------------------------------------------------------------
-- المستخدمون والأدوار
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

-- ملف شخصي تلقائي لكل حساب دخول جديد (بلا أي دور؛ المدير يمنح الأدوار)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), new.id::text));
begin
  v_username := left(regexp_replace(v_username, '[^a-z0-9._-]', '', 'g'), 32);
  if length(v_username) < 3 or exists (select 1 from public.profiles where username = v_username) then
    v_username := left(v_username, 23) || '-' || left(new.id::text, 8);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, coalesce(new.raw_user_meta_data ->> 'display_name', v_username))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- هل المستخدم الحالي نشط ويملك أحد الأدوار المعطاة؟
create function public.has_any_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and p.is_active
      and ur.role = any (roles)
  );
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['admin', 'accountant', 'engineer', 'supervisor']::public.app_role[]);
$$;

create function public.is_finance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['admin', 'accountant']::public.app_role[]);
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['admin']::public.app_role[]);
$$;

-- يُستدعى في بداية كل دالة مالية
create function public.require_finance()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_finance() then
    raise exception 'غير مصرح: هذه العملية للمدير أو المحاسب فقط' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- إعدادات الشركة (صف واحد)
-- ---------------------------------------------------------------------------
create table public.company_settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'شركة ركاز العقارية',
  tagline text,
  phone text,
  address text,
  logo_path text,
  signee_name text,
  signee_title text,
  storage_provider public.storage_provider not null default 'supabase',
  google_drive_folder_url text,
  allow_negative_treasury boolean not null default false,
  print_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.company_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- updated_at تلقائي
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger company_settings_touch before update on public.company_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- سجل العمليات (يُكتب بالمشغلات فقط، ولا يُعدَّل)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index audit_log_table_record_idx on public.audit_log (table_name, record_id);

create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (table_name, record_id, action, old_data, new_data, actor_id)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;

-- يمنع تعديل أو حذف الجداول غير القابلة للتعديل (الدفاتر)
create function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'الجدول % غير قابل للتعديل أو الحذف؛ استخدم قيداً عكسياً', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();
