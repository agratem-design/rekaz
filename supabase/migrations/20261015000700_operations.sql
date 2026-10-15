-- ركاز v2 — العمليات المالية
-- كل دالة: تتحقق من الصلاحية، تمنع التكرار بمفتاح الطلب، تقفل ما تحتاجه،
-- وتكتب السجل وحركة الخزينة معاً أو لا شيء.
-- إعادة الاستدعاء بنفس المفتاح تعيد معرّف السجل الأول دون أي كتابة جديدة.

-- ---------------------------------------------------------------------------
-- أدوات مشتركة
-- ---------------------------------------------------------------------------
create function public.assert_reversible(p_status public.record_status, p_reason text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_status = 'reversed' then
    raise exception 'السجل ملغى مسبقاً' using errcode = '23514';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'سبب الإلغاء مطلوب' using errcode = '23514';
  end if;
end;
$$;

-- يُمنع الفرع من القطاع الخطأ؛ العمليات بلا مشروع تقبل أي خزينة
create function public.assert_project_belongs_to_client(p_project_id uuid, p_client_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_project_id is not null and not exists (
    select 1 from public.projects where id = p_project_id and client_id = p_client_id
  ) then
    raise exception 'المشروع لا يتبع هذا الزبون' using errcode = '23514';
  end if;
end;
$$;

create function public.assert_project_refs(p_project_id uuid, p_phase_id uuid, p_item_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_project_id is null and (p_phase_id is not null or p_item_id is not null) then
    raise exception 'المرحلة أو البند يتطلبان مشروعاً' using errcode = '23514';
  end if;
  if p_phase_id is not null and not exists (
    select 1 from public.project_phases where id = p_phase_id and project_id = p_project_id
  ) then
    raise exception 'المرحلة لا تتبع هذا المشروع' using errcode = '23514';
  end if;
  if p_item_id is not null and not exists (
    select 1 from public.project_items where id = p_item_id and project_id = p_project_id
  ) then
    raise exception 'البند لا يتبع هذا المشروع' using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- قبض من زبون
-- ---------------------------------------------------------------------------
create function public.record_client_receipt(
  p_key uuid,
  p_client_id uuid,
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
begin
  perform public.require_finance();
  select id into v_id from public.client_receipts where idempotency_key = p_key;
  if found then return v_id; end if;

  perform public.assert_project_belongs_to_client(p_project_id, p_client_id);
  perform public.assert_treasury_for_project(p_treasury_id, p_project_id);

  insert into public.client_receipts
    (client_id, project_id, treasury_id, amount, receipt_date, method, reference, notes, idempotency_key)
  values
    (p_client_id, p_project_id, p_treasury_id, p_amount, p_date, p_method, p_reference, p_notes, p_key)
  returning id into v_id;

  perform public.post_treasury_entry(p_treasury_id, 'in', p_amount, p_date, 'client_receipt', v_id,
    'قبض من زبون');

  if p_project_id is null then
    insert into public.client_credit_entries (client_id, kind, amount, receipt_id, notes)
    values (p_client_id, 'advance_receipt', p_amount, v_id, 'دفعة مقدمة بلا مشروع');
  end if;
  return v_id;
end;
$$;

create function public.reverse_client_receipt(p_receipt_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.client_receipts;
  v_entry public.client_credit_entries;
  v_available numeric;
begin
  perform public.require_finance();
  select * into r from public.client_receipts where id = p_receipt_id for update;
  if not found then raise exception 'السند غير موجود'; end if;
  perform public.assert_reversible(r.status, p_reason);

  if r.project_id is null then
    -- لا يُلغى سند مقدم إذا كان رصيده قد طُبّق على مشروع
    perform 1 from public.clients where id = r.client_id for update;
    select coalesce(sum(amount), 0) into v_available from public.client_credit_entries where client_id = r.client_id;
    if v_available < r.amount then
      raise exception 'لا يمكن الإلغاء: جزء من هذه الدفعة طُبّق على مشروع؛ ألغِ التطبيق أولاً' using errcode = '23514';
    end if;
    select * into v_entry from public.client_credit_entries
      where receipt_id = r.id and kind = 'advance_receipt';
    insert into public.client_credit_entries (client_id, kind, amount, reverses_entry_id, notes)
    values (r.client_id, 'reversal', -v_entry.amount, v_entry.id, p_reason);
  end if;

  update public.client_receipts
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = r.id;
  perform public.reverse_treasury_entries('client_receipt', r.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- الرصيد الدائن: تطبيقه على مشروع، أو نقل زيادة مشروع إليه
-- ---------------------------------------------------------------------------
create function public.apply_client_credit(
  p_key uuid, p_client_id uuid, p_project_id uuid, p_amount numeric, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_available numeric;
  v_remaining numeric;
begin
  perform public.require_finance();
  select id into v_id from public.client_credit_entries where idempotency_key = p_key;
  if found then return v_id; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'المبلغ يجب أن يكون موجباً'; end if;
  perform public.assert_project_belongs_to_client(p_project_id, p_client_id);
  if p_project_id is null then raise exception 'المشروع مطلوب'; end if;

  perform 1 from public.clients where id = p_client_id for update;
  select available_credit into v_available from public.client_credit_balances where client_id = p_client_id;
  if v_available < p_amount then
    raise exception 'الرصيد الدائن المتاح % أقل من المطلوب %', v_available, p_amount using errcode = '23514';
  end if;
  select client_remaining into v_remaining from public.project_financials where project_id = p_project_id;
  if v_remaining < p_amount then
    raise exception 'المتبقي على المشروع % أقل من المبلغ %', v_remaining, p_amount using errcode = '23514';
  end if;

  insert into public.client_credit_entries (client_id, kind, amount, project_id, notes, idempotency_key)
  values (p_client_id, 'application', -p_amount, p_project_id, p_notes, p_key)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.move_project_overpayment_to_credit(
  p_key uuid, p_project_id uuid, p_amount numeric, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_client uuid;
  v_remaining numeric;
begin
  perform public.require_finance();
  select id into v_id from public.client_credit_entries where idempotency_key = p_key;
  if found then return v_id; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'المبلغ يجب أن يكون موجباً'; end if;

  select client_id into v_client from public.projects where id = p_project_id for update;
  if not found then raise exception 'المشروع غير موجود'; end if;
  select client_remaining into v_remaining from public.project_financials where project_id = p_project_id;
  if -v_remaining < p_amount then
    raise exception 'الزيادة المسددة على المشروع % أقل من المبلغ %', greatest(-v_remaining, 0), p_amount using errcode = '23514';
  end if;

  insert into public.client_credit_entries (client_id, kind, amount, project_id, notes, idempotency_key)
  values (v_client, 'from_project', p_amount, p_project_id, p_notes, p_key)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.reverse_client_credit_entry(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.client_credit_entries;
  v_available numeric;
begin
  perform public.require_finance();
  select * into e from public.client_credit_entries where id = p_entry_id;
  if not found then raise exception 'القيد غير موجود'; end if;
  if e.kind not in ('application', 'from_project') then
    raise exception 'هذا القيد يُلغى من خلال سند القبض المرتبط به' using errcode = '23514';
  end if;
  if exists (select 1 from public.client_credit_entries where reverses_entry_id = e.id) then
    raise exception 'القيد ملغى مسبقاً' using errcode = '23514';
  end if;
  perform public.assert_reversible('posted', p_reason);

  perform 1 from public.clients where id = e.client_id for update;
  if e.amount > 0 then
    select available_credit into v_available from public.client_credit_balances where client_id = e.client_id;
    if v_available < e.amount then
      raise exception 'لا يمكن الإلغاء: الرصيد المنقول طُبّق على مشروع آخر' using errcode = '23514';
    end if;
  end if;

  insert into public.client_credit_entries (client_id, kind, amount, project_id, reverses_entry_id, notes)
  values (e.client_id, 'reversal', -e.amount, e.project_id, e.id, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- فاتورة مورد (التزام فقط، بلا حركة خزينة)
-- ---------------------------------------------------------------------------
create function public.record_purchase(
  p_key uuid,
  p_supplier_id uuid,
  p_kind public.purchase_kind,
  p_total numeric,
  p_date date,
  p_project_id uuid default null,
  p_phase_id uuid default null,
  p_item_id uuid default null,
  p_invoice_no text default null,
  p_description text default null,
  p_lines jsonb default '[]'::jsonb,
  p_returns_purchase_id uuid default null,
  p_attachment_path text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  o public.purchases;
  v_already_returned numeric;
begin
  perform public.require_finance();
  select id into v_id from public.purchases where idempotency_key = p_key;
  if found then return v_id; end if;
  perform public.assert_project_refs(p_project_id, p_phase_id, p_item_id);

  if p_kind = 'return' then
    select * into o from public.purchases where id = p_returns_purchase_id for update;
    if not found or o.status <> 'posted' or o.kind = 'return' then
      raise exception 'الفاتورة الأصلية للمرتجع غير صالحة' using errcode = '23514';
    end if;
    if o.supplier_id <> p_supplier_id or o.project_id is distinct from p_project_id then
      raise exception 'المرتجع يجب أن يطابق مورد ومشروع الفاتورة الأصلية' using errcode = '23514';
    end if;
    select coalesce(sum(total_amount), 0) into v_already_returned
      from public.purchases where returns_purchase_id = o.id and status = 'posted';
    if v_already_returned + p_total > o.total_amount then
      raise exception 'المرتجع يتجاوز قيمة الفاتورة الأصلية' using errcode = '23514';
    end if;
  end if;

  insert into public.purchases
    (supplier_id, project_id, phase_id, project_item_id, kind, returns_purchase_id, invoice_no,
     invoice_date, description, lines, total_amount, attachment_path, notes, idempotency_key)
  values
    (p_supplier_id, p_project_id, p_phase_id, p_item_id, p_kind, p_returns_purchase_id, p_invoice_no,
     p_date, p_description, coalesce(p_lines, '[]'::jsonb), p_total, p_attachment_path, p_notes, p_key)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.reverse_purchase(p_purchase_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.purchases;
begin
  perform public.require_finance();
  select * into p from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  perform public.assert_reversible(p.status, p_reason);
  if exists (select 1 from public.supplier_payment_allocations where purchase_id = p.id and status = 'posted') then
    raise exception 'لا يمكن إلغاء فاتورة عليها سداد؛ ألغِ الدفعة أولاً' using errcode = '23514';
  end if;
  if exists (select 1 from public.purchases where returns_purchase_id = p.id and status = 'posted') then
    raise exception 'لا يمكن إلغاء فاتورة لها مرتجع قائم' using errcode = '23514';
  end if;
  update public.purchases
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- دفعة لمورد: على فواتير محددة و/أو مقدم
-- p_allocations: [{"purchase_id": "...", "amount": 100}, ...]، مجموعها ≤ مبلغ الدفعة
-- ---------------------------------------------------------------------------
create function public.pay_supplier(
  p_key uuid,
  p_supplier_id uuid,
  p_treasury_id uuid,
  p_amount numeric,
  p_date date,
  p_allocations jsonb default '[]'::jsonb,
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
  a jsonb;
  v_purchase public.purchases;
  v_remaining numeric;
  v_total_alloc numeric := 0;
begin
  perform public.require_finance();
  select id into v_id from public.supplier_payments where idempotency_key = p_key;
  if found then return v_id; end if;

  insert into public.supplier_payments
    (supplier_id, treasury_id, amount, payment_date, method, reference, notes, idempotency_key)
  values
    (p_supplier_id, p_treasury_id, p_amount, p_date, p_method, p_reference, p_notes, p_key)
  returning id into v_id;

  for a in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) loop
    select * into v_purchase from public.purchases where id = (a ->> 'purchase_id')::uuid for update;
    if not found or v_purchase.status <> 'posted' or v_purchase.kind = 'return' then
      raise exception 'فاتورة غير صالحة للسداد' using errcode = '23514';
    end if;
    if v_purchase.supplier_id <> p_supplier_id then
      raise exception 'الفاتورة لا تتبع هذا المورد' using errcode = '23514';
    end if;
    perform public.assert_treasury_for_project(p_treasury_id, v_purchase.project_id);
    select remaining into v_remaining from public.purchase_balances where purchase_id = v_purchase.id;
    if (a ->> 'amount')::numeric > v_remaining then
      raise exception 'مبلغ التوزيع % يتجاوز المتبقي على الفاتورة %', (a ->> 'amount')::numeric, v_remaining
        using errcode = '23514';
    end if;
    insert into public.supplier_payment_allocations (payment_id, purchase_id, amount)
    values (v_id, v_purchase.id, (a ->> 'amount')::numeric);
    v_total_alloc := v_total_alloc + (a ->> 'amount')::numeric;
  end loop;

  if v_total_alloc > p_amount then
    raise exception 'مجموع التوزيعات % يتجاوز مبلغ الدفعة %', v_total_alloc, p_amount using errcode = '23514';
  end if;

  perform public.post_treasury_entry(p_treasury_id, 'out', p_amount, p_date, 'supplier_payment', v_id, 'دفعة لمورد');
  return v_id;
end;
$$;

-- توزيع مقدم موجود على فاتورة لاحقة (بلا حركة خزينة)
create function public.allocate_supplier_advance(p_payment_id uuid, p_purchase_id uuid, p_amount numeric)
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

create function public.reverse_supplier_payment(p_payment_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sp public.supplier_payments;
begin
  perform public.require_finance();
  select * into sp from public.supplier_payments where id = p_payment_id for update;
  if not found then raise exception 'الدفعة غير موجودة'; end if;
  perform public.assert_reversible(sp.status, p_reason);
  update public.supplier_payment_allocations
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where payment_id = sp.id and status = 'posted';
  update public.supplier_payments
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = sp.id;
  perform public.reverse_treasury_entries('supplier_payment', sp.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- أعمال الفنيين ودفعاتهم
-- ---------------------------------------------------------------------------
create function public.record_technician_work(
  p_key uuid,
  p_technician_id uuid,
  p_project_id uuid,
  p_date date,
  p_rate_unit public.rate_unit,
  p_quantity numeric,
  p_rate numeric,
  p_phase_id uuid default null,
  p_item_id uuid default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_any_role(array['admin', 'accountant', 'engineer', 'supervisor']::public.app_role[]) then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select id into v_id from public.technician_work where idempotency_key = p_key;
  if found then return v_id; end if;
  perform public.assert_project_refs(p_project_id, p_phase_id, p_item_id);
  insert into public.technician_work
    (technician_id, project_id, phase_id, project_item_id, work_date, description, rate_unit, quantity, rate, idempotency_key)
  values
    (p_technician_id, p_project_id, p_phase_id, p_item_id, p_date, p_description, p_rate_unit, p_quantity, p_rate, p_key)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.reverse_technician_work(p_work_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.technician_work;
begin
  perform public.require_finance();
  select * into w from public.technician_work where id = p_work_id for update;
  if not found then raise exception 'السجل غير موجود'; end if;
  perform public.assert_reversible(w.status, p_reason);
  update public.technician_work
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = w.id;
end;
$$;

create function public.pay_technician(
  p_key uuid,
  p_technician_id uuid,
  p_treasury_id uuid,
  p_amount numeric,
  p_date date,
  p_context_project_id uuid default null,
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
begin
  perform public.require_finance();
  select id into v_id from public.technician_payments where idempotency_key = p_key;
  if found then return v_id; end if;
  perform public.assert_treasury_for_project(p_treasury_id, p_context_project_id);
  insert into public.technician_payments
    (technician_id, treasury_id, amount, payment_date, method, context_project_id, notes, idempotency_key)
  values
    (p_technician_id, p_treasury_id, p_amount, p_date, p_method, p_context_project_id, p_notes, p_key)
  returning id into v_id;
  perform public.post_treasury_entry(p_treasury_id, 'out', p_amount, p_date, 'technician_payment', v_id, 'دفعة لفني');
  return v_id;
end;
$$;

create function public.reverse_technician_payment(p_payment_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tp public.technician_payments;
begin
  perform public.require_finance();
  select * into tp from public.technician_payments where id = p_payment_id for update;
  if not found then raise exception 'الدفعة غير موجودة'; end if;
  perform public.assert_reversible(tp.status, p_reason);
  update public.technician_payments
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = tp.id;
  perform public.reverse_treasury_entries('technician_payment', tp.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

create function public.receive_from_technician(
  p_key uuid,
  p_technician_id uuid,
  p_treasury_id uuid,
  p_amount numeric,
  p_date date,
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
begin
  perform public.require_finance();
  select id into v_id from public.technician_receipts where idempotency_key = p_key;
  if found then return v_id; end if;
  insert into public.technician_receipts
    (technician_id, treasury_id, amount, receipt_date, method, notes, idempotency_key)
  values
    (p_technician_id, p_treasury_id, p_amount, p_date, p_method, p_notes, p_key)
  returning id into v_id;
  perform public.post_treasury_entry(p_treasury_id, 'in', p_amount, p_date, 'technician_deposit', v_id, 'مبلغ مستلم من فني');
  return v_id;
end;
$$;

create function public.reverse_technician_receipt(p_receipt_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tr public.technician_receipts;
begin
  perform public.require_finance();
  select * into tr from public.technician_receipts where id = p_receipt_id for update;
  if not found then raise exception 'السند غير موجود'; end if;
  perform public.assert_reversible(tr.status, p_reason);
  update public.technician_receipts
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = tr.id;
  perform public.reverse_treasury_entries('technician_deposit', tr.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- العُهد
-- ---------------------------------------------------------------------------
create function public.issue_custody(
  p_key uuid,
  p_treasury_id uuid,
  p_amount numeric,
  p_date date,
  p_employee_id uuid default null,
  p_engineer_id uuid default null,
  p_project_id uuid default null,
  p_purpose text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_finance();
  select id into v_id from public.custodies where idempotency_key = p_key;
  if found then return v_id; end if;
  perform public.assert_treasury_for_project(p_treasury_id, p_project_id);
  insert into public.custodies
    (employee_id, engineer_id, project_id, treasury_id, amount, issue_date, purpose, idempotency_key)
  values
    (p_employee_id, p_engineer_id, p_project_id, p_treasury_id, p_amount, p_date, p_purpose, p_key)
  returning id into v_id;
  perform public.post_treasury_entry(p_treasury_id, 'out', p_amount, p_date, 'custody_issue', v_id, 'صرف عهدة');
  return v_id;
end;
$$;

create function public.return_custody_cash(
  p_key uuid, p_custody_id uuid, p_treasury_id uuid, p_amount numeric, p_date date, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  c public.custodies;
  v_remaining numeric;
begin
  perform public.require_finance();
  select id into v_id from public.custody_returns where idempotency_key = p_key;
  if found then return v_id; end if;
  select * into c from public.custodies where id = p_custody_id for update;
  if not found or c.status <> 'posted' then raise exception 'العهدة غير صالحة'; end if;
  perform public.assert_treasury_for_project(p_treasury_id, c.project_id);
  select remaining into v_remaining from public.custody_balances where custody_id = c.id;
  if p_amount > v_remaining then
    raise exception 'المبلغ المرجع % يتجاوز المتبقي في العهدة %', p_amount, v_remaining using errcode = '23514';
  end if;
  insert into public.custody_returns (custody_id, treasury_id, amount, return_date, notes, idempotency_key)
  values (c.id, p_treasury_id, p_amount, p_date, p_notes, p_key)
  returning id into v_id;
  perform public.post_treasury_entry(p_treasury_id, 'in', p_amount, p_date, 'custody_return', v_id, 'إرجاع من عهدة');
  return v_id;
end;
$$;

create function public.close_custody(p_custody_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining numeric;
begin
  perform public.require_finance();
  perform 1 from public.custodies where id = p_custody_id and status = 'posted' for update;
  if not found then raise exception 'العهدة غير صالحة'; end if;
  select remaining into v_remaining from public.custody_balances where custody_id = p_custody_id;
  if v_remaining <> 0 then
    raise exception 'لا يمكن إغلاق عهدة متبقٍ فيها %', v_remaining using errcode = '23514';
  end if;
  update public.custodies set is_closed = true where id = p_custody_id;
end;
$$;

create function public.reverse_custody(p_custody_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.custodies;
begin
  perform public.require_finance();
  select * into c from public.custodies where id = p_custody_id for update;
  if not found then raise exception 'العهدة غير موجودة'; end if;
  perform public.assert_reversible(c.status, p_reason);
  if exists (select 1 from public.expenses where custody_id = c.id and status = 'posted')
     or exists (select 1 from public.custody_returns where custody_id = c.id and status = 'posted') then
    raise exception 'لا يمكن إلغاء عهدة عليها مصروفات أو إرجاعات قائمة' using errcode = '23514';
  end if;
  update public.custodies
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = c.id;
  perform public.reverse_treasury_entries('custody_issue', c.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

create function public.reverse_custody_return(p_return_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cr public.custody_returns;
begin
  perform public.require_finance();
  select * into cr from public.custody_returns where id = p_return_id for update;
  if not found then raise exception 'السجل غير موجود'; end if;
  perform public.assert_reversible(cr.status, p_reason);
  update public.custody_returns
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = cr.id;
  perform public.reverse_treasury_entries('custody_return', cr.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- المصروفات
-- ---------------------------------------------------------------------------
create function public.record_expense(
  p_key uuid,
  p_description text,
  p_amount numeric,
  p_date date,
  p_treasury_id uuid default null,
  p_custody_id uuid default null,
  p_project_id uuid default null,
  p_phase_id uuid default null,
  p_item_id uuid default null,
  p_category_id uuid default null,
  p_invoice_no text default null,
  p_attachment_path text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  c public.custodies;
  v_remaining numeric;
begin
  perform public.require_finance();
  select id into v_id from public.expenses where idempotency_key = p_key;
  if found then return v_id; end if;
  perform public.assert_project_refs(p_project_id, p_phase_id, p_item_id);

  if p_custody_id is not null then
    select * into c from public.custodies where id = p_custody_id for update;
    if not found or c.status <> 'posted' or c.is_closed then raise exception 'العهدة غير صالحة أو مغلقة'; end if;
    if c.project_id is not null and c.project_id is distinct from p_project_id then
      raise exception 'عهدة المشروع لا تُصرف إلا على نفس المشروع' using errcode = '23514';
    end if;
    select remaining into v_remaining from public.custody_balances where custody_id = c.id;
    if p_amount > v_remaining then
      raise exception 'المصروف % يتجاوز المتبقي في العهدة %', p_amount, v_remaining using errcode = '23514';
    end if;
  else
    perform public.assert_treasury_for_project(p_treasury_id, p_project_id);
  end if;

  insert into public.expenses
    (project_id, phase_id, project_item_id, category_id, description, amount, expense_date,
     treasury_id, custody_id, invoice_no, attachment_path, notes, idempotency_key)
  values
    (p_project_id, p_phase_id, p_item_id, p_category_id, p_description, p_amount, p_date,
     p_treasury_id, p_custody_id, p_invoice_no, p_attachment_path, p_notes, p_key)
  returning id into v_id;

  if p_treasury_id is not null then
    perform public.post_treasury_entry(p_treasury_id, 'out', p_amount, p_date, 'expense', v_id, p_description);
  end if;
  return v_id;
end;
$$;

create function public.reverse_expense(p_expense_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expenses;
begin
  perform public.require_finance();
  select * into e from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'المصروف غير موجود'; end if;
  perform public.assert_reversible(e.status, p_reason);
  update public.expenses
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = e.id;
  if e.treasury_id is not null then
    perform public.reverse_treasury_entries('expense', e.id, p_date, 'إلغاء: ' || p_reason);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- التحويل بين الخزائن
-- ---------------------------------------------------------------------------
create function public.transfer_between_treasuries(
  p_key uuid, p_from uuid, p_to uuid, p_amount numeric, p_date date, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_finance();
  select id into v_id from public.transfers where idempotency_key = p_key;
  if found then return v_id; end if;
  insert into public.transfers (from_treasury_id, to_treasury_id, amount, transfer_date, notes, idempotency_key)
  values (p_from, p_to, p_amount, p_date, p_notes, p_key)
  returning id into v_id;
  -- ترتيب ثابت للأقفال يمنع الجمود بين تحويلين متعاكسين
  perform 1 from public.treasuries where id in (p_from, p_to) order by id for update;
  perform public.post_treasury_entry(p_from, 'out', p_amount, p_date, 'transfer', v_id, 'تحويل صادر');
  perform public.post_treasury_entry(p_to, 'in', p_amount, p_date, 'transfer', v_id, 'تحويل وارد');
  return v_id;
end;
$$;

create function public.reverse_transfer(p_transfer_id uuid, p_reason text, p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transfers;
begin
  perform public.require_finance();
  select * into t from public.transfers where id = p_transfer_id for update;
  if not found then raise exception 'التحويل غير موجود'; end if;
  perform public.assert_reversible(t.status, p_reason);
  update public.transfers
    set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
    where id = t.id;
  perform 1 from public.treasuries where id in (t.from_treasury_id, t.to_treasury_id) order by id for update;
  perform public.reverse_treasury_entries('transfer', t.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- حذف بند مشروع مع تعييناته في عملية واحدة (يُرفض إذا عليه سجلات مالية)
-- ---------------------------------------------------------------------------
create function public.delete_project_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_any_role(array['admin', 'engineer', 'supervisor']::public.app_role[]) then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if exists (select 1 from public.technician_work where project_item_id = p_item_id)
     or exists (select 1 from public.purchases where project_item_id = p_item_id)
     or exists (select 1 from public.expenses where project_item_id = p_item_id)
     or exists (select 1 from public.contract_items where project_item_id = p_item_id) then
    raise exception 'لا يمكن حذف بند عليه أعمال أو مشتريات أو مصروفات أو مرتبط بعقد' using errcode = '23503';
  end if;
  delete from public.project_items where id = p_item_id;
  if not found then raise exception 'البند غير موجود'; end if;
end;
$$;
