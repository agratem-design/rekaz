-- ركاز v2 — جداول العمليات المالية
-- لا تُكتب هذه الجداول من الواجهة مباشرة. الكتابة فقط عبر دوال 0600 التي تكتب
-- السجل وحركة الخزينة معاً داخل معاملة واحدة. الإلغاء بقيد عكسي، لا حذف.

-- ---------------------------------------------------------------------------
-- قبض الزبائن
-- ---------------------------------------------------------------------------
create sequence public.client_receipt_no_seq;

create table public.client_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no bigint not null unique default nextval('public.client_receipt_no_seq'),
  client_id uuid not null references public.clients (id),
  -- بدون مشروع = دفعة مقدمة تذهب كاملة إلى الرصيد الدائن للزبون
  project_id uuid references public.projects (id),
  treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  receipt_date date not null,
  method public.payment_method not null default 'cash',
  reference text,
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index client_receipts_client_idx on public.client_receipts (client_id);
create index client_receipts_project_idx on public.client_receipts (project_id);

-- دفتر الرصيد الدائن للزبون (غير قابل للتعديل)
-- الدفعة على مشروع تبقى على المشروع حتى لو زادت عن المتبقي (يظهر المشروع "مسدداً بزيادة").
-- لا يتحرك أي مبلغ بين مشروعين أو إلى الرصيد إلا بقيد صريح هنا.
-- amount موجب = يزيد الرصيد المتاح، سالب = يُنقص
create type public.credit_entry_kind as enum (
  'advance_receipt',  -- دفعة بلا مشروع (+)
  'from_project',     -- نقل زيادة مشروع إلى الرصيد (+)، project_id = المشروع المصدر
  'application',      -- تطبيق رصيد على مشروع (−)، project_id = المشروع الهدف
  'reversal'          -- عكس قيد سابق، بعكس إشارته
);

create table public.client_credit_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  kind public.credit_entry_kind not null,
  amount numeric(14, 3) not null check (amount <> 0),
  receipt_id uuid references public.client_receipts (id),
  project_id uuid references public.projects (id),
  reverses_entry_id uuid unique references public.client_credit_entries (id),
  notes text,
  idempotency_key uuid unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint credit_sign check (
    (kind in ('advance_receipt', 'from_project') and amount > 0)
    or (kind = 'application' and amount < 0)
    or (kind = 'reversal' and reverses_entry_id is not null)
  ),
  constraint credit_receipt_link check (kind <> 'advance_receipt' or receipt_id is not null),
  constraint credit_project_link check (kind not in ('from_project', 'application') or project_id is not null)
);
create index client_credit_entries_client_idx on public.client_credit_entries (client_id);
create trigger client_credit_entries_immutable before update or delete on public.client_credit_entries
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- فواتير الموردين ودفعاتهم
-- ---------------------------------------------------------------------------
create type public.purchase_kind as enum ('material', 'service', 'return');

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id),
  -- بدون مشروع = مشتريات عامة للشركة، لا تدخل تكلفة أي مشروع
  project_id uuid references public.projects (id),
  phase_id uuid references public.project_phases (id),
  project_item_id uuid references public.project_items (id),
  kind public.purchase_kind not null,
  returns_purchase_id uuid references public.purchases (id),
  invoice_no text,
  invoice_date date not null,
  description text,
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  total_amount public.positive_money not null,
  attachment_path text,
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint purchase_return_link check ((kind = 'return') = (returns_purchase_id is not null))
);
create index purchases_supplier_idx on public.purchases (supplier_id);
create index purchases_project_idx on public.purchases (project_id);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id),
  treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  payment_date date not null,
  method public.payment_method not null default 'cash',
  reference text,
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index supplier_payments_supplier_idx on public.supplier_payments (supplier_id);

-- توزيع الدفعة على الفواتير. الجزء غير الموزع = مقدم ظاهر للمورد.
create table public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.supplier_payments (id),
  purchase_id uuid not null references public.purchases (id),
  amount public.positive_money not null,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index supplier_payment_allocations_purchase_idx on public.supplier_payment_allocations (purchase_id);
create index supplier_payment_allocations_payment_idx on public.supplier_payment_allocations (payment_id);

-- ---------------------------------------------------------------------------
-- الفنيون: الإنجاز هو المصدر الوحيد للمستحق
-- ---------------------------------------------------------------------------
create table public.technician_work (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id),
  project_id uuid not null references public.projects (id),
  phase_id uuid references public.project_phases (id),
  project_item_id uuid references public.project_items (id),
  work_date date not null,
  description text,
  rate_unit public.rate_unit not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  rate public.money not null,
  amount numeric(16, 3) generated always as (round(quantity * rate, 3)) stored,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index technician_work_technician_idx on public.technician_work (technician_id);
create index technician_work_project_idx on public.technician_work (project_id);

create table public.technician_payments (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id),
  treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  payment_date date not null,
  method public.payment_method not null default 'cash',
  -- سياق للعرض فقط، ليس توزيعاً محاسبياً
  context_project_id uuid references public.projects (id),
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index technician_payments_technician_idx on public.technician_payments (technician_id);

-- مبلغ يستلمه الصندوق من الفني (إرجاع زائد أو وديعة): اتجاه معاكس للدفعة
create table public.technician_receipts (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id),
  treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  receipt_date date not null,
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

-- ---------------------------------------------------------------------------
-- العُهد
-- ---------------------------------------------------------------------------
create table public.custodies (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id),
  engineer_id uuid references public.engineers (id),
  project_id uuid references public.projects (id),
  treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  issue_date date not null,
  purpose text,
  is_closed boolean not null default false,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint custody_one_holder check ((employee_id is null) <> (engineer_id is null))
);

create table public.custody_returns (
  id uuid primary key default gen_random_uuid(),
  custody_id uuid not null references public.custodies (id),
  treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  return_date date not null,
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- المصروفات: من خزينة، أو من عهدة (بلا حركة خزينة جديدة)
-- ---------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);
insert into public.expense_categories (name) values
  ('نقل ومواصلات'), ('وقود'), ('ضيافة'), ('إيجار'), ('كهرباء ومياه'),
  ('اتصالات'), ('قرطاسية'), ('صيانة'), ('رسوم حكومية'), ('أخرى');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  -- بدون مشروع = مصروف عام لا يدخل تكلفة أي مشروع
  project_id uuid references public.projects (id),
  phase_id uuid references public.project_phases (id),
  project_item_id uuid references public.project_items (id),
  category_id uuid references public.expense_categories (id),
  description text not null,
  amount public.positive_money not null,
  expense_date date not null,
  treasury_id uuid references public.treasuries (id),
  custody_id uuid references public.custodies (id),
  invoice_no text,
  attachment_path text,
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint expense_funding check ((treasury_id is null) <> (custody_id is null))
);
create index expenses_project_idx on public.expenses (project_id);

-- ---------------------------------------------------------------------------
-- التحويل بين الخزائن: حركتان مرتبطتان
-- ---------------------------------------------------------------------------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_treasury_id uuid not null references public.treasuries (id),
  to_treasury_id uuid not null references public.treasuries (id),
  amount public.positive_money not null,
  transfer_date date not null,
  notes text,
  status public.record_status not null default 'posted',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key uuid not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint transfer_distinct check (from_treasury_id <> to_treasury_id)
);

-- ---------------------------------------------------------------------------
-- حماية عامة: السجلات المالية لا تُحذف، ولا يتغير منها إلا حقول الإلغاء
-- ---------------------------------------------------------------------------
create function public.guard_financial_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف سجل مالي؛ استخدم الإلغاء' using errcode = '42501';
  end if;
  if old.status = 'reversed' then
    raise exception 'السجل ملغى ولا يمكن تعديله' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['status', 'reversed_at', 'reversed_by', 'reversal_reason', 'is_closed'])
     is distinct from
     (to_jsonb(old) - array['status', 'reversed_at', 'reversed_by', 'reversal_reason', 'is_closed']) then
    raise exception 'لا يمكن تعديل سجل مالي بعد ترحيله؛ ألغِه وأنشئ سجلاً جديداً' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'client_receipts', 'purchases', 'supplier_payments', 'supplier_payment_allocations',
    'technician_work', 'technician_payments', 'technician_receipts',
    'custodies', 'custody_returns', 'expenses', 'transfers'
  ] loop
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function public.guard_financial_record()',
      t || '_guard', t
    );
    execute format(
      'create trigger %I after insert or update on public.%I for each row execute function public.write_audit_log()',
      t || '_audit', t
    );
  end loop;
end;
$$;
