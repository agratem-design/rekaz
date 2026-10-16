-- Link an employee record to a login account (one account per employee), same as engineers.
alter table public.employees
 add column if not exists profile_id uuid unique references public.profiles (id) on delete set null;
