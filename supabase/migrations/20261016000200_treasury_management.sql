-- إنشاء الخزينة والافتتاحي عملية واحدة، مع إيقاف قابل للتراجع بدلاً من حذف السجل المالي.
create or replace function public.validate_treasury()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.treasuries; b numeric;
begin
  perform pg_advisory_xact_lock(hashtext('rekaz-treasury-tree'));
  if new.parent_id is not null then
    select * into p from public.treasuries where id = new.parent_id for update;
    if not found or p.id = new.id or p.parent_id is not null then
      raise exception 'اختر خزينة رئيسية؛ لا يمكن ربط الفرع بنفسه أو بفرع آخر';
    end if;
    if p.domain is distinct from new.domain then raise exception 'الفرع يجب أن يتبع قطاع الخزينة الرئيسية'; end if;
    if new.is_active and not p.is_active then raise exception 'فعّل الخزينة الرئيسية قبل إضافة أو تفعيل الفرع'; end if;
    if exists(select 1 from public.treasuries where parent_id = new.id) then raise exception 'الخزينة التي لها فروع يجب أن تبقى رئيسية'; end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.domain <> old.domain and (exists(select 1 from public.treasury_entries where treasury_id = new.id) or exists(select 1 from public.treasuries where parent_id = new.id)) then
      raise exception 'لا يمكن تغيير قطاع خزينة لها حركات أو فروع';
    end if;
    if old.is_active and not new.is_active then
      select coalesce(sum(case when direction='in' then amount else -amount end),0) into b from public.treasury_entries where treasury_id=new.id;
      if b <> 0 then raise exception 'انقل رصيد الخزينة أو سوّه قبل إيقافها؛ الرصيد الحالي % د.ل', b; end if;
      if exists(select 1 from public.treasuries where parent_id=new.id and is_active) then raise exception 'أوقف الفروع المستخدمة أولاً'; end if;
    end if;
  end if;
  return new;
end $$;

create function public.save_treasury(p_document jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_opening numeric; v_kind public.treasury_kind;
begin
  perform public.require_finance();
  perform pg_advisory_xact_lock(hashtext('rekaz-treasury-tree'));
  v_kind := coalesce(p_document->>'kind','cash')::public.treasury_kind;
  v_opening := coalesce(nullif(p_document->>'opening',''),'0')::numeric;
  if v_opening < 0 then raise exception 'الرصيد الافتتاحي يجب أن يكون صفراً أو موجباً'; end if;
  if nullif(p_document->>'id','') is not null then
    v_id := (p_document->>'id')::uuid;
    if v_opening <> 0 then raise exception 'الرصيد الافتتاحي يُسجل عند إنشاء الخزينة فقط'; end if;
    update public.treasuries set name=trim(p_document->>'name'), domain=(p_document->>'domain')::public.treasury_domain,
      kind=v_kind, parent_id=nullif(p_document->>'parent_id','')::uuid,
      bank_name=case when v_kind='bank' then nullif(p_document->>'bank_name','') end,
      account_number=case when v_kind='bank' then nullif(p_document->>'account_number','') end,
      notes=nullif(p_document->>'notes',''), is_active=coalesce((p_document->>'is_active')::boolean,true)
    where id=v_id;
    if not found then raise exception 'الخزينة غير موجودة'; end if;
  else
    insert into public.treasuries(name,domain,kind,parent_id,bank_name,account_number,notes,is_active)
    values(trim(p_document->>'name'),(p_document->>'domain')::public.treasury_domain,v_kind,nullif(p_document->>'parent_id','')::uuid,
      case when v_kind='bank' then nullif(p_document->>'bank_name','') end,
      case when v_kind='bank' then nullif(p_document->>'account_number','') end,
      nullif(p_document->>'notes',''),true) returning id into v_id;
    if v_opening > 0 then
      if nullif(p_document->>'opening_date','') is null then raise exception 'حدد تاريخ الرصيد الافتتاحي'; end if;
      perform public.set_opening_balance(v_id,v_opening,(p_document->>'opening_date')::date);
    end if;
  end if;
  return v_id;
end $$;
revoke all on function public.save_treasury(jsonb) from public, anon;
grant execute on function public.save_treasury(jsonb) to authenticated;
