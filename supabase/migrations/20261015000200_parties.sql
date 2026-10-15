-- ركاز v2 — أطراف التعامل

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  city text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- التخصص يأتي من هذا الجدول فقط، لا من نص حر
create table public.technician_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- نفس التخصصات المعتمدة في النسخة السابقة وبنفس المعرّفات
insert into public.technician_types (id, code, name) values
  ('d415717b-8919-4cb5-b461-7589d81d2a10', 'daily_worker', 'عامل / عمالة يومية'),
  ('a7832db5-ec5a-498c-a264-2b25acc1d4dc', 'reinforced_carpenter', 'نجار مسلح'),
  ('698d75cb-a9a4-4f8c-9388-337aca60bc9f', 'rebar_blacksmith', 'حداد مسلح'),
  ('c4e02287-9e7a-432d-ba48-e7e65c11a7c7', 'builder_mason', 'بنّاء'),
  ('39bbd364-59cf-4287-9fe1-43446dca5147', 'electrician', 'كهربائي'),
  ('a1a2bb10-d47c-436f-bf4e-1d26c1c6c756', 'plumber', 'سباك'),
  ('f84aa8e7-ea75-480c-8030-02aaf8f914a6', 'hvac_technician', 'فني تكييف وتبريد'),
  ('fe6f3ced-cc9d-4142-9fd3-e397ffe9f508', 'gypsum_technician', 'فني جبس'),
  ('a6a4e3d9-5a76-41a2-80a7-b6ab886d4844', 'painter', 'فني دهان'),
  ('091f7017-6521-4d1b-a6c9-808a3860275d', 'tile_ceramic_mason', 'فني بلاط وسيراميك'),
  ('50c93bcb-fded-4cbc-b92e-c82a44cd4326', 'aluminum_technician', 'فني ألمنيوم'),
  ('01ef8874-82fa-4e80-b296-922c74a58474', 'welder', 'فني لحام'),
  ('9596f282-e91e-4a03-827c-18d839e31e27', 'insulation_technician', 'فني عزل'),
  ('65762477-3382-4c2b-9827-d862e0e35ca4', 'glass_technician', 'فني زجاج'),
  ('c0093395-51e1-48f3-a700-a22edc1f9dd2', 'carpenter', 'فني نجارة'),
  ('ea9efc03-f7ec-47fa-9366-c510c8243e98', 'door_installer', 'فني تركيب أبواب'),
  ('7e2dfb2f-b958-4d2e-a209-d0015f897415', 'stone_marble_mason', 'فني حجر ورخام');

create type public.rate_unit as enum ('day', 'hour', 'meter', 'piece', 'lump_sum');

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  technician_type_id uuid references public.technician_types (id),
  phone text,
  default_rate_unit public.rate_unit,
  default_rate public.money,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.engineers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  specialty text,
  license_number text,
  phone text,
  email text,
  profile_id uuid unique references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  position text,
  department text,
  phone text,
  email text,
  hire_date date,
  base_salary public.money not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger suppliers_touch before update on public.suppliers for each row execute function public.touch_updated_at();
create trigger technicians_touch before update on public.technicians for each row execute function public.touch_updated_at();
create trigger engineers_touch before update on public.engineers for each row execute function public.touch_updated_at();
create trigger employees_touch before update on public.employees for each row execute function public.touch_updated_at();
