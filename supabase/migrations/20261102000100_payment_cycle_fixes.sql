-- ركاز v2 — إصلاحات دورة الصرف
-- لا تضيف مساراً مالياً جديداً؛ تصحح ما يُحسب أو يُعكس خطأ في المسارات الموجودة.

-- ---------------------------------------------------------------------------
-- إلغاء سجل عمل الفني كان يفشل دائماً: amount عمود محسوب لا تظهر قيمته في مشغل
-- قبل التحديث، فيبدو السجل معدلاً. الكمية والسعر يبقيان محروسين، وamount مشتق منهما.
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
  if tg_table_name = 'technician_work' then
    v_free := array_append(v_free, 'amount');
  end if;
  if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception 'لا يمكن تعديل سجل مالي بعد ترحيله؛ ألغِه وأنشئ سجلاً جديداً' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- المتبقي على الفاتورة صافٍ من مرتجعاتها، حتى لا تُسدَّد بأكثر مما هو مستحق فعلاً.
-- إن تجاوز المرتجع غير المسدد يبقى المتبقي صفراً، ويظهر الفرق سالباً في رصيد المورد.
-- ---------------------------------------------------------------------------
create or replace view public.purchase_balances
with (security_invoker = true)
as
select
  p.id as purchase_id,
  p.supplier_id,
  p.project_id,
  p.kind,
  p.total_amount,
  coalesce(a.paid, 0)::numeric(16, 3) as paid,
  case when p.kind = 'return' then 0 else greatest(p.total_amount - coalesce(r.returned, 0) - coalesce(a.paid, 0), 0) end::numeric(16, 3) as remaining,
  coalesce(r.returned, 0)::numeric(16, 3) as returned
from public.purchases p
left join (
  select purchase_id, sum(amount) as paid
  from public.supplier_payment_allocations where status = 'posted'
  group by purchase_id
) a on a.purchase_id = p.id
left join (
  select returns_purchase_id, sum(total_amount) as returned
  from public.purchases where status = 'posted' and kind = 'return'
  group by returns_purchase_id
) r on r.returns_purchase_id = p.id
where p.status = 'posted';

-- ---------------------------------------------------------------------------
-- إلغاء إرجاع أو مصروف يعيد المبلغ إلى العهدة، فتعود مفتوحة إن كانت قد أُغلقت.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_custody_return(p_return_id uuid, p_reason text, p_date date default current_date)
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
  update public.custodies set is_closed = false where id = cr.custody_id and is_closed;
  perform public.reverse_treasury_entries('custody_return', cr.id, p_date, 'إلغاء: ' || p_reason);
end;
$$;

create or replace function public.reverse_expense(p_expense_id uuid, p_reason text, p_date date default current_date)
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
  if e.custody_id is not null then
    update public.custodies set is_closed = false where id = e.custody_id and is_closed;
  end if;
end;
$$;

notify pgrst, 'reload schema';
