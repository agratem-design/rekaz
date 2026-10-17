-- Existing quantities remain unchanged. New entries explicitly store the base quantity.
alter table public.project_items
 add column if not exists base_quantity numeric(14,3),
 add column if not exists cubic_factor numeric(14,6) not null default 1;

alter table public.project_items add constraint project_item_cubic_factor_positive
 check (cubic_factor > 0 and cubic_factor::text not in ('NaN','Infinity','-Infinity'));
alter table public.project_items add constraint project_item_base_quantity_positive
 check (base_quantity is null or (base_quantity > 0 and base_quantity::text not in ('NaN','Infinity','-Infinity')));

create or replace function public.calculate_item_cubic_quantity()
returns trigger language plpgsql set search_path = public as $$
begin
 if new.base_quantity is null and new.cubic_factor <> 1 then
  new.base_quantity := new.quantity;
 end if;
 if new.base_quantity is not null then
  new.quantity := round(new.base_quantity * new.cubic_factor, 3);
 end if;
 if new.quantity <= 0 or new.quantity::text in ('NaN','Infinity','-Infinity') then
  raise exception 'الكمية الناتجة من معامل التكعيب يجب أن تكون موجبة وصالحة';
 end if;
 return new;
end $$;

create trigger calculate_project_item_cubic_quantity
 before insert or update on public.project_items
 for each row execute function public.calculate_item_cubic_quantity();
