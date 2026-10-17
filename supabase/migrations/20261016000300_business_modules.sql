-- Payroll, advances, equipment hire and perpetual inventory. All postings are atomic and idempotent.
create table public.business_requests (
 id uuid primary key, action text not null, payload jsonb not null, result uuid not null,
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);
create table public.payroll_runs (
 id uuid primary key default gen_random_uuid(), period date not null check(extract(day from period)=1),
 notes text, created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.payroll_slips (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.payroll_runs,
 employee_id uuid not null references public.employees, project_id uuid references public.projects,
 period date not null, base_salary public.money not null, allowances public.money not null default 0,
 deductions public.money not null default 0, advance_deduction public.money not null default 0,
 net_amount numeric(14,3) generated always as (base_salary+allowances-deductions-advance_deduction) stored,
 notes text, status public.record_status not null default 'posted', reversal_reason text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(),
 check(base_salary+allowances>=deductions+advance_deduction)
);
create unique index payroll_employee_period on public.payroll_slips(employee_id,period) where status='posted';
create table public.payroll_payments (
 id uuid primary key default gen_random_uuid(), slip_id uuid not null references public.payroll_slips,
 treasury_id uuid not null references public.treasuries, amount public.positive_money not null,
 payment_date date not null, notes text, status public.record_status not null default 'posted', reversal_reason text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.employee_advances (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees,
 kind text not null check(kind in ('advance','repayment','opening')), treasury_id uuid references public.treasuries,
 amount public.positive_money not null, entry_date date not null, notes text,
 status public.record_status not null default 'posted', reversal_reason text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(),
 check((kind='opening' and treasury_id is null) or (kind<>'opening' and treasury_id is not null))
);
create view public.employee_advance_balances with(security_invoker=true) as
 select e.id employee_id, (coalesce(a.amount,0)-coalesce(s.recovered,0))::numeric(16,3) remaining
 from public.employees e left join (
 select employee_id,sum(case when kind='repayment' then -amount else amount end) amount from public.employee_advances where status='posted' group by 1
 ) a on a.employee_id=e.id left join (
 select employee_id,sum(advance_deduction) recovered from public.payroll_slips where status='posted' group by 1
 ) s on s.employee_id=e.id;
create view public.payroll_balances with(security_invoker=true) as
 select s.*,coalesce(p.paid,0)::numeric(16,3) paid,(s.net_amount-coalesce(p.paid,0))::numeric(16,3) remaining
 from public.payroll_slips s left join(select slip_id,sum(amount) paid from public.payroll_payments where status='posted' group by 1) p on p.slip_id=s.id;
create table public.equipment (
 id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code))>0),
 name text not null check(length(trim(name))>0), ownership text not null check(ownership in ('owned','hired')),
 status text not null default 'available' check(status in ('available','maintenance','inactive')),
 daily_rate public.money not null default 0, notes text, created_at timestamptz not null default now()
);
create table public.equipment_rentals (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment,
 project_id uuid not null references public.projects, supplier_id uuid references public.suppliers,
 purchase_id uuid unique references public.purchases, start_date date not null, end_date date not null,
 quantity numeric(14,3) not null default 1 check(quantity>0), daily_rate public.money not null,
 agreed_amount public.money not null, returned_on date, notes text,
 status public.record_status not null default 'posted', reversal_reason text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), check(end_date>=start_date),
 check(returned_on is null or returned_on>=start_date)
);
create table public.warehouses (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name))>0),
 location text, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.stock_products (
 id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code))>0),
 name text not null check(length(trim(name))>0), unit_id uuid not null references public.measurement_units,
 minimum_quantity numeric(14,3) not null default 0 check(minimum_quantity>=0),
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 product_id uuid not null references public.stock_products, warehouse_id uuid not null references public.warehouses,
 target_warehouse_id uuid references public.warehouses, project_id uuid references public.projects,
 purchase_id uuid references public.purchases, source_movement_id uuid references public.stock_movements,
 kind text not null check(kind in ('opening','receipt','issue','return','transfer','count_in','count_out')),
 quantity numeric(14,3) not null check(quantity>0), unit_cost public.money not null,
 total_cost numeric(16,3) not null check(total_cost>=0), movement_date date not null, notes text,
 status public.record_status not null default 'posted', reversal_reason text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(),
 check((kind='transfer' and target_warehouse_id is not null and target_warehouse_id<>warehouse_id) or (kind<>'transfer' and target_warehouse_id is null)),
 check(kind<>'receipt' or purchase_id is not null), check(kind<>'return' or source_movement_id is not null)
);
create index stock_product_sequence on public.stock_movements(product_id,sequence);
create table public.stock_counts (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.stock_products,
 warehouse_id uuid not null references public.warehouses, book_quantity numeric(14,3) not null,
 actual_quantity numeric(14,3) not null check(actual_quantity>=0), movement_id uuid references public.stock_movements,
 count_date date not null, notes text not null check(length(trim(notes))>0),
 created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create view public.stock_ledger with(security_invoker=true) as
 select id,sequence,product_id,warehouse_id,movement_date,
 quantity*(case when kind in ('issue','transfer','count_out') then -1 else 1 end) quantity,
 total_cost*(case when kind in ('issue','transfer','count_out') then -1 else 1 end) value
 from public.stock_movements where status='posted'
 union all select id,sequence,product_id,target_warehouse_id,movement_date,quantity,total_cost
 from public.stock_movements where status='posted' and kind='transfer';
create view public.stock_balances with(security_invoker=true) as
 select product_id,warehouse_id,sum(quantity)::numeric(16,3) quantity,sum(value)::numeric(16,3) value,
 case when sum(quantity)>0 then round(sum(value)/sum(quantity),6) else 0 end average_cost
 from public.stock_ledger group by 1,2;

-- Prevent changing the source invoice while equipment or stock still relies on it.
create function public.guard_operational_purchase() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='posted' and new.status='reversed' and (
 exists(select 1 from public.stock_movements where purchase_id=old.id and status='posted') or
 exists(select 1 from public.equipment_rentals where purchase_id=old.id and status='posted')) then
 raise exception 'ألغِ حركة المخزون أو عقد إيجار المعدة المرتبط أولاً'; end if;
 return new;
end $$;
create trigger purchase_operational_guard before update on public.purchases for each row execute function public.guard_operational_purchase();

-- Single server-side command boundary: no direct client writes to operational records.
create function public.business_command(p_key uuid,p_action text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 result uuid; req public.business_requests; j jsonb; emp public.employees; slip public.payroll_slips;
 adv public.employee_advances; pay public.payroll_payments; asset public.equipment; rental public.equipment_rentals;
 mov public.stock_movements; original public.stock_movements; inv public.purchases;
 v_employee uuid; v_product uuid; v_warehouse uuid; v_target uuid; v_project uuid; v_purchase uuid; v_id uuid;
 v_date date; v_period date; v_kind text; v_reason text; v_qty numeric; v_cost numeric; v_total numeric;
 v_balance numeric; v_value numeric; v_remaining numeric; v_base numeric; v_allow numeric; v_deduct numeric; v_recover numeric;
begin
 perform public.require_finance();
 if p_key is null or jsonb_typeof(p_data)<>'object' then raise exception 'طلب غير صالح'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into req from public.business_requests where id=p_key;
 if found then
   if req.action<>p_action or req.payload<>p_data or req.created_by<>auth.uid() then raise exception 'مفتاح الحفظ مستخدم لبيانات أخرى؛ راجع العملية السابقة'; end if;
   return req.result;
 end if;
 v_date:=coalesce(nullif(p_data->>'date','')::date,current_date);
 v_reason:=nullif(trim(p_data->>'reason'),'');
 v_project:=nullif(p_data->>'project_id','')::uuid;
 if v_project is not null and not exists(select 1 from public.projects where id=v_project and status<>'cancelled') then raise exception 'المشروع غير صالح'; end if;

 if p_action='payroll_run' then
   v_period:=date_trunc('month',(p_data->>'period')::date)::date;
   if v_period is null or jsonb_typeof(p_data->'lines')<>'array' or jsonb_array_length(p_data->'lines') not between 1 and 500 then raise exception 'حدد الشهر وموظفًا واحدًا على الأقل، بحد أقصى 500'; end if;
   insert into public.payroll_runs(period,notes) values(v_period,p_data->>'notes') returning id into result;
   for j in select value from jsonb_array_elements(p_data->'lines') order by value->>'employee_id' loop
     select * into emp from public.employees where id=(j->>'employee_id')::uuid and is_active for update;
     if not found then raise exception 'الموظف غير موجود أو موقوف'; end if;
     v_base:=(j->>'base_salary')::numeric; v_allow:=coalesce((j->>'allowances')::numeric,0); v_deduct:=coalesce((j->>'deductions')::numeric,0); v_recover:=coalesce((j->>'advance_deduction')::numeric,0);
     if v_base is null or least(v_base,v_allow,v_deduct,v_recover)<0 or v_base+v_allow<v_deduct+v_recover then raise exception 'قيم الراتب والاستقطاعات غير صحيحة'; end if;
     select remaining into v_remaining from public.employee_advance_balances where employee_id=emp.id;
     if v_recover>v_remaining then raise exception 'استقطاع السلفة يتجاوز المتبقي للموظف %',emp.name; end if;
     insert into public.payroll_slips(run_id,employee_id,project_id,period,base_salary,allowances,deductions,advance_deduction,notes)
     values(result,emp.id,v_project,v_period,v_base,v_allow,v_deduct,v_recover,j->>'notes');
   end loop;
 elsif p_action='payroll_payment' then
   select * into slip from public.payroll_slips where id=(p_data->>'slip_id')::uuid for update;
   if not found or slip.status<>'posted' then raise exception 'قسيمة الراتب غير صالحة'; end if;
   select remaining into v_remaining from public.payroll_balances where id=slip.id;
   v_total:=(p_data->>'amount')::numeric;
   if v_total is null or v_total<=0 or v_total>v_remaining then raise exception 'الدفعة تتجاوز صافي الراتب المتبقي'; end if;
   insert into public.payroll_payments(slip_id,treasury_id,amount,payment_date,notes)
   values(slip.id,(p_data->>'treasury_id')::uuid,v_total,v_date,p_data->>'notes') returning id into result;
   perform public.post_treasury_entry((p_data->>'treasury_id')::uuid,'out',v_total,v_date,'payroll_slip',result,'صرف راتب');
 elsif p_action='employee_advance' then
   v_employee:=(p_data->>'employee_id')::uuid;
   perform 1 from public.employees where id=v_employee and is_active for update;
   if not found then raise exception 'الموظف غير موجود أو موقوف'; end if;
   v_kind:=p_data->>'kind'; v_total:=(p_data->>'amount')::numeric;
   select remaining into v_remaining from public.employee_advance_balances where employee_id=v_employee;
   if v_kind='repayment' and v_total>v_remaining then raise exception 'الرد يتجاوز السلفة المتبقية'; end if;
   if v_kind='opening' and (nullif(trim(p_data->>'notes'),'') is null or exists(select 1 from public.employee_advances where employee_id=v_employee and status='posted')) then raise exception 'الرصيد السابق يتطلب بيانًا ويُسجل قبل بقية حركات السلف'; end if;
   insert into public.employee_advances(employee_id,kind,treasury_id,amount,entry_date,notes)
   values(v_employee,v_kind,case when v_kind='opening' then null else (p_data->>'treasury_id')::uuid end,v_total,v_date,p_data->>'notes') returning id into result;
   if v_kind<>'opening' then perform public.post_treasury_entry((p_data->>'treasury_id')::uuid,case when v_kind='repayment' then 'in' else 'out' end,v_total,v_date,case when v_kind='repayment' then 'advance_repayment'::public.entry_source else 'employee_advance'::public.entry_source end,result,'سلفة موظف / رد سلفة'); end if;
 elsif p_action='reverse_payroll_slip' then
   if v_reason is null then raise exception 'سبب الإلغاء مطلوب'; end if;
   select * into slip from public.payroll_slips where id=(p_data->>'id')::uuid for update;
   if not found or slip.status<>'posted' then raise exception 'القسيمة غير صالحة'; end if;
   perform 1 from public.employees where id=slip.employee_id for update;
   if exists(select 1 from public.payroll_payments where slip_id=slip.id and status='posted') then raise exception 'ألغِ دفعات الراتب أولاً'; end if;
   update public.payroll_slips set status='reversed',reversal_reason=v_reason where id=slip.id; result:=slip.id;
 elsif p_action='reverse_payroll_payment' then
   if v_reason is null then raise exception 'سبب الإلغاء مطلوب'; end if;
   select * into pay from public.payroll_payments where id=(p_data->>'id')::uuid for update;
   if not found or pay.status<>'posted' then raise exception 'الدفعة غير صالحة'; end if;
   perform 1 from public.payroll_slips where id=pay.slip_id for update;
   perform public.reverse_treasury_entries('payroll_slip',pay.id,v_date,v_reason);
   update public.payroll_payments set status='reversed',reversal_reason=v_reason where id=pay.id; result:=pay.id;
 elsif p_action='reverse_employee_advance' then
   if v_reason is null then raise exception 'سبب الإلغاء مطلوب'; end if;
   select * into adv from public.employee_advances where id=(p_data->>'id')::uuid for update;
   if not found or adv.status<>'posted' then raise exception 'السلفة غير صالحة'; end if;
   perform 1 from public.employees where id=adv.employee_id for update;
   select remaining into v_remaining from public.employee_advance_balances where employee_id=adv.employee_id;
   if adv.kind<>'repayment' and v_remaining<adv.amount then raise exception 'السلفة استُقطعت أو سُددت؛ ألغِ تسويتها أولاً'; end if;
   if adv.kind<>'opening' then perform public.reverse_treasury_entries(case when adv.kind='repayment' then 'advance_repayment'::public.entry_source else 'employee_advance'::public.entry_source end,adv.id,v_date,v_reason); end if;
   update public.employee_advances set status='reversed',reversal_reason=v_reason where id=adv.id; result:=adv.id;
 elsif p_action='equipment_save' then
   v_id:=nullif(p_data->>'id','')::uuid;
   if v_id is null then
    insert into public.equipment(code,name,ownership,status,daily_rate,notes) values(trim(p_data->>'code'),trim(p_data->>'name'),p_data->>'ownership',p_data->>'status',coalesce((p_data->>'daily_rate')::numeric,0),p_data->>'notes') returning id into result;
   else
    select * into asset from public.equipment where id=v_id for update;
    if not found then raise exception 'المعدة غير موجودة'; end if;
    if exists(select 1 from public.equipment_rentals where equipment_id=v_id and status='posted' and returned_on is null) and (p_data->>'status'<>'available' or p_data->>'ownership'<>asset.ownership) then raise exception 'أعد المعدة من الاستخدام أولاً'; end if;
    update public.equipment set code=trim(p_data->>'code'),name=trim(p_data->>'name'),ownership=p_data->>'ownership',status=p_data->>'status',daily_rate=(p_data->>'daily_rate')::numeric,notes=p_data->>'notes' where id=v_id; result:=v_id;
   end if;
 elsif p_action='equipment_rental' then
   select * into asset from public.equipment where id=(p_data->>'equipment_id')::uuid for update;
   if not found or asset.status<>'available' then raise exception 'المعدة غير متاحة'; end if;
   if v_project is null then raise exception 'حدد المشروع'; end if;
   if asset.ownership='owned' and exists(select 1 from public.equipment_rentals where equipment_id=asset.id and status='posted' and returned_on is null and (p_data->>'start_date')::date<=end_date and (p_data->>'end_date')::date>=start_date) then raise exception 'المعدة محجوزة في هذه المدة'; end if;
   v_qty:=(p_data->>'quantity')::numeric; v_cost:=(p_data->>'daily_rate')::numeric;
   if asset.ownership='owned' then v_cost:=0; if v_qty<>1 then raise exception 'تسجيل المعدة المملوكة يكون بكمية واحدة'; end if; end if;
   v_total:=round(v_qty*v_cost*((p_data->>'end_date')::date-(p_data->>'start_date')::date+1),3);
   if asset.ownership='hired' then
    if nullif(p_data->>'supplier_id','') is null or v_total<=0 then raise exception 'حدد المورد وقيمة الإيجار'; end if;
    v_purchase:=public.record_purchase(gen_random_uuid(),(p_data->>'supplier_id')::uuid,'service',v_total,v_date,v_project,null,null,null,'إيجار معدة: '||asset.name,'[]',null,null,p_data->>'notes');
   end if;
   insert into public.equipment_rentals(equipment_id,project_id,supplier_id,purchase_id,start_date,end_date,quantity,daily_rate,agreed_amount,notes)
   values(asset.id,v_project,nullif(p_data->>'supplier_id','')::uuid,v_purchase,(p_data->>'start_date')::date,(p_data->>'end_date')::date,v_qty,v_cost,v_total,p_data->>'notes') returning id into result;
 elsif p_action='equipment_return' then
   select * into rental from public.equipment_rentals where id=(p_data->>'id')::uuid for update;
   if not found or rental.status<>'posted' or rental.returned_on is not null then raise exception 'عقد الاستخدام مغلق أو غير صالح'; end if;
   update public.equipment_rentals set returned_on=v_date where id=rental.id; result:=rental.id;
 elsif p_action='reverse_equipment_rental' then
   if v_reason is null then raise exception 'سبب الإلغاء مطلوب'; end if;
   select * into rental from public.equipment_rentals where id=(p_data->>'id')::uuid for update;
   if not found or rental.status<>'posted' then raise exception 'العقد غير صالح'; end if;
   update public.equipment_rentals set status='reversed',reversal_reason=v_reason where id=rental.id;
   if rental.purchase_id is not null then perform public.reverse_purchase(rental.purchase_id,v_reason); end if;
   result:=rental.id;
 elsif p_action='warehouse_save' then
   v_id:=nullif(p_data->>'id','')::uuid;
   if v_id is null then insert into public.warehouses(name,location) values(trim(p_data->>'name'),p_data->>'location') returning id into result;
   else
    perform 1 from public.warehouses where id=v_id for update;
    if not found then raise exception 'المخزن غير موجود'; end if;
    if not (p_data->>'is_active')::boolean and exists(select 1 from public.stock_balances where warehouse_id=v_id and quantity<>0) then raise exception 'لا يمكن إيقاف مخزن به رصيد'; end if;
    update public.warehouses set name=trim(p_data->>'name'),location=p_data->>'location',is_active=(p_data->>'is_active')::boolean where id=v_id; result:=v_id;
   end if;
 elsif p_action='stock_product_save' then
   v_id:=nullif(p_data->>'id','')::uuid;
   if v_id is null then insert into public.stock_products(code,name,unit_id,minimum_quantity) values(trim(p_data->>'code'),trim(p_data->>'name'),(p_data->>'unit_id')::uuid,coalesce((p_data->>'minimum_quantity')::numeric,0)) returning id into result;
   else
    perform 1 from public.stock_products where id=v_id for update;
    if not found then raise exception 'المادة غير موجودة'; end if;
    if exists(select 1 from public.stock_movements where product_id=v_id) and (select unit_id from public.stock_products where id=v_id)<>(p_data->>'unit_id')::uuid then raise exception 'لا يمكن تغيير وحدة مادة لها حركات'; end if;
    if not (p_data->>'is_active')::boolean and exists(select 1 from public.stock_balances where product_id=v_id and quantity<>0) then raise exception 'لا يمكن إيقاف مادة لها رصيد'; end if;
    update public.stock_products set code=trim(p_data->>'code'),name=trim(p_data->>'name'),unit_id=(p_data->>'unit_id')::uuid,minimum_quantity=(p_data->>'minimum_quantity')::numeric,is_active=(p_data->>'is_active')::boolean where id=v_id; result:=v_id;
   end if;
 elsif p_action in ('stock_movement','stock_count') then
   v_product:=(p_data->>'product_id')::uuid; v_warehouse:=(p_data->>'warehouse_id')::uuid; v_target:=nullif(p_data->>'target_warehouse_id','')::uuid;
   perform 1 from public.stock_products where id=v_product and is_active for update;
   if not found then raise exception 'المادة غير صالحة'; end if;
   perform 1 from public.warehouses where id=v_warehouse and is_active;
   if not found then raise exception 'المخزن غير صالح'; end if;
   if v_target is not null and not exists(select 1 from public.warehouses where id=v_target and is_active) then raise exception 'المخزن المستلم غير صالح'; end if;
   if exists(select 1 from public.stock_ledger where product_id=v_product and warehouse_id in(v_warehouse,v_target) and movement_date>v_date) then raise exception 'أدخل الحركات بترتيب تاريخي؛ توجد حركة أحدث لهذه المادة'; end if;
   select coalesce(sum(quantity),0),coalesce(sum(value),0) into v_balance,v_value from public.stock_ledger where product_id=v_product and warehouse_id=v_warehouse;
   v_kind:=p_data->>'kind';v_qty:=(p_data->>'quantity')::numeric;
   if p_action='stock_count' then
     if v_qty is null or v_qty<0 or nullif(trim(p_data->>'notes'),'') is null then raise exception 'أدخل الكمية الفعلية وسبب فرق الجرد'; end if;
     insert into public.stock_counts(product_id,warehouse_id,book_quantity,actual_quantity,count_date,notes) values(v_product,v_warehouse,v_balance,v_qty,v_date,p_data->>'notes') returning id into result;
     v_qty:=v_qty-v_balance;v_kind:=case when v_qty>=0 then 'count_in' else 'count_out' end;v_qty:=abs(v_qty);
     if v_qty=0 then insert into public.business_requests(id,action,payload,result) values(p_key,p_action,p_data,result);return result; end if;
   elsif v_kind not in ('opening','receipt','issue','return','transfer') then raise exception 'نوع حركة غير صالح'; end if;
   if v_qty is null or v_qty<=0 then raise exception 'الكمية يجب أن تكون موجبة'; end if;
   if v_kind in ('issue','transfer','count_out') and v_qty>v_balance then raise exception 'رصيد المخزن غير كافٍ؛ المتاح %',v_balance; end if;
   if v_kind in ('issue','transfer','count_out','count_in') then v_cost:=case when v_balance>0 then round(v_value/v_balance,6) else coalesce((p_data->>'unit_cost')::numeric,0) end;
   else v_cost:=(p_data->>'unit_cost')::numeric; end if;
   if v_cost is null or v_cost<0 then raise exception 'تكلفة الوحدة غير صحيحة'; end if;
   v_total:=case when v_qty=v_balance and v_kind in ('issue','transfer','count_out') then v_value else round(v_qty*v_cost,3) end;
   if v_kind='opening' and exists(select 1 from public.stock_ledger where product_id=v_product and warehouse_id=v_warehouse) then raise exception 'الرصيد الافتتاحي يكون قبل بقية الحركات'; end if;
   if v_kind='receipt' then
    select * into inv from public.purchases where id=(p_data->>'purchase_id')::uuid for update;
    if not found or inv.status<>'posted' or inv.kind<>'material' or inv.project_id is not null then raise exception 'اختر فاتورة مواد عامة للشركة؛ تُحمّل التكلفة للمشروع عند الصرف من المخزن'; end if;
    select coalesce(sum(total_cost),0) into v_remaining from public.stock_movements where purchase_id=inv.id and status='posted';
    if v_total<=0 or v_remaining+v_total>inv.total_amount then raise exception 'قيمة الاستلام تتجاوز المتاح من فاتورة المورد'; end if;
    v_purchase:=inv.id;
   end if;
   if v_kind='issue' and v_project is null then raise exception 'حدد المشروع المستلم للمواد'; end if;
   if v_kind='return' then
    select * into original from public.stock_movements where id=(p_data->>'source_movement_id')::uuid for update;
    if not found or original.status<>'posted' or original.kind<>'issue' or original.product_id<>v_product or original.warehouse_id<>v_warehouse then raise exception 'حركة الصرف الأصلية غير صالحة'; end if;
    select coalesce(sum(quantity),0) into v_remaining from public.stock_movements where source_movement_id=original.id and status='posted';
    if v_qty+v_remaining>original.quantity then raise exception 'المرتجع يتجاوز الكمية المصروفة'; end if;
    v_project:=original.project_id;v_cost:=original.unit_cost;
    v_total:=round(v_qty*original.total_cost/original.quantity,3);
   end if;
   insert into public.stock_movements(product_id,warehouse_id,target_warehouse_id,project_id,purchase_id,source_movement_id,kind,quantity,unit_cost,total_cost,movement_date,notes)
   values(v_product,v_warehouse,case when v_kind='transfer' then v_target end,case when v_kind in ('issue','return') then v_project end,v_purchase,case when v_kind='return' then original.id end,v_kind,v_qty,v_cost,v_total,v_date,p_data->>'notes') returning id into v_id;
   if p_action='stock_count' then update public.stock_counts set movement_id=v_id where id=result; else result:=v_id; end if;
 elsif p_action='reverse_stock_movement' then
   if v_reason is null then raise exception 'سبب الإلغاء مطلوب'; end if;
   select * into mov from public.stock_movements where id=(p_data->>'id')::uuid;
   if not found or mov.status<>'posted' then raise exception 'الحركة غير صالحة'; end if;
   perform 1 from public.stock_products where id=mov.product_id for update;
   if exists(select 1 from public.stock_movements where product_id=mov.product_id and sequence>mov.sequence and status='posted') then raise exception 'ألغِ الحركات الأحدث للمادة أولاً للحفاظ على تقييم المخزون'; end if;
   update public.stock_movements set status='reversed',reversal_reason=v_reason where id=mov.id; result:=mov.id;
 elsif p_action in ('import_expenses','import_master','import_stock') then
   if jsonb_typeof(p_data->'lines')<>'array' or jsonb_array_length(p_data->'lines') not between 1 and 1000 then raise exception 'استورد من 1 إلى 1000 سطر'; end if;
   result:=gen_random_uuid();
   for j in select value from jsonb_array_elements(p_data->'lines') loop
    if p_action='import_expenses' then
     perform public.record_expense(gen_random_uuid(),j->>'description',(j->>'amount')::numeric,(j->>'date')::date,(j->>'treasury_id')::uuid,null,nullif(j->>'project_id','')::uuid,null,null,null,null,null,j->>'notes');
    elsif p_action='import_stock' then
     perform public.business_command(gen_random_uuid(),'stock_movement',j||jsonb_build_object('kind','opening'));
    elsif p_data->>'target'='employees' then
     insert into public.employees(name,phone,base_salary) values(trim(j->>'name'),nullif(j->>'phone',''),(j->>'base_salary')::numeric);
    elsif p_data->>'target'='clients' then
     insert into public.clients(name,phone) values(trim(j->>'name'),nullif(j->>'phone',''));
    elsif p_data->>'target'='suppliers' then
     insert into public.suppliers(name,phone) values(trim(j->>'name'),nullif(j->>'phone',''));
    elsif p_data->>'target'='stock_products' then
     perform public.business_command(gen_random_uuid(),'stock_product_save',j);
    else raise exception 'نوع الاستيراد غير صالح'; end if;
   end loop;
 elsif p_action='import_items' then
   if not public.has_any_role(array['admin','accountant']::public.app_role[]) or v_project is null then raise exception 'حدد المشروع'; end if;
   if jsonb_typeof(p_data->'lines')<>'array' or jsonb_array_length(p_data->'lines') not between 1 and 1000 then raise exception 'استورد من 1 إلى 1000 بند في الدفعة'; end if;
   perform 1 from public.projects where id=v_project for update;
   result:=gen_random_uuid();
   for j in select value from jsonb_array_elements(p_data->'lines') loop
    perform public.assert_project_refs(v_project,nullif(j->>'phase_id','')::uuid,null);
    if nullif(trim(j->>'name'),'') is null or (j->>'quantity')::numeric<=0 or (j->>'unit_price')::numeric<0 or not exists(select 1 from public.measurement_units where id=(j->>'unit_id')::uuid) then raise exception 'سطر استيراد غير صالح'; end if;
    insert into public.project_items(project_id,phase_id,name,unit_id,quantity,unit_price,order_index)
    values(v_project,nullif(j->>'phase_id','')::uuid,trim(j->>'name'),(j->>'unit_id')::uuid,(j->>'quantity')::numeric,(j->>'unit_price')::numeric,(select coalesce(max(order_index),0)+1 from public.project_items where project_id=v_project));
   end loop;
 else raise exception 'عملية غير معروفة'; end if;
 insert into public.business_requests(id,action,payload,result) values(p_key,p_action,p_data,result);
 return result;
end $$;

-- Audit and least-privilege reads; only the command can mutate operational data.
do $$ declare t text; begin
 foreach t in array array['business_requests','payroll_runs','payroll_slips','payroll_payments','employee_advances','equipment','equipment_rentals','warehouses','stock_products','stock_movements','stock_counts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy business_read on public.%I for select to authenticated using(public.is_finance())',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create trigger business_audit after insert or update or delete on public.%I for each row execute function public.write_audit_log()',t);
 end loop;
end $$;
grant select on public.employee_advance_balances,public.payroll_balances,public.stock_ledger,public.stock_balances to authenticated;
revoke all on function public.business_command(uuid,text,jsonb),public.guard_operational_purchase() from public,anon,authenticated;
grant execute on function public.business_command(uuid,text,jsonb) to authenticated,service_role;

-- Cost once: stock purchase is general; only project issues/returns enter project cost.
create or replace view public.project_costs with(security_invoker=true) as
select p.id project_id,
 (coalesce(pu.materials,0)+coalesce(st.cost,0))::numeric(16,3) materials,
 coalesce(pu.services,0)::numeric(16,3) services,coalesce(pu.returns,0)::numeric(16,3) returns,
 (coalesce(tw.labor,0)+coalesce(pr.cost,0))::numeric(16,3) labor,
 coalesce(ex.expenses,0)::numeric(16,3) expenses,
 (coalesce(pu.materials,0)+coalesce(pu.services,0)-coalesce(pu.returns,0)+coalesce(st.cost,0)+coalesce(tw.labor,0)+coalesce(pr.cost,0)+coalesce(ex.expenses,0))::numeric(16,3) direct_cost
from public.projects p
left join(select project_id,sum(total_amount) filter(where kind='material') materials,sum(total_amount) filter(where kind='service') services,sum(total_amount) filter(where kind='return') returns from public.purchases where status='posted' group by 1) pu on pu.project_id=p.id
left join(select project_id,sum(amount) labor from public.technician_work where status='posted' group by 1) tw on tw.project_id=p.id
left join(select project_id,sum(amount) expenses from public.expenses where status='posted' group by 1) ex on ex.project_id=p.id
left join(select project_id,sum(case when kind='issue' then total_cost else -total_cost end) cost from public.stock_movements where status='posted' and kind in('issue','return') group by 1) st on st.project_id=p.id
left join(select project_id,sum(base_salary+allowances-deductions) cost from public.payroll_slips where status='posted' group by 1) pr on pr.project_id=p.id;
notify pgrst,'reload schema';
