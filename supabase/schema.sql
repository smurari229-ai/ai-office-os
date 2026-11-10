-- DukaanAI customer records: one owner per row, enforced by RLS.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text not null check (length(trim(phone)) > 0),
  need text not null default 'Not specified',
  status text not null default 'New'
    check (status in ('New', 'Contacted', 'Interested', 'Converted', 'Lost')),
  follow_up date,
  created_at timestamptz not null default now()
);

create index if not exists customers_user_created_idx
  on public.customers (user_id, created_at desc);
create index if not exists customers_user_follow_up_idx
  on public.customers (user_id, follow_up);

alter table public.customers enable row level security;

drop policy if exists "Customers are readable by their owner" on public.customers;
create policy "Customers are readable by their owner"
  on public.customers for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers can be created by their owner" on public.customers;
create policy "Customers can be created by their owner"
  on public.customers for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers can be updated by their owner" on public.customers;
create policy "Customers can be updated by their owner"
  on public.customers for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers can be deleted by their owner" on public.customers;
create policy "Customers can be deleted by their owner"
  on public.customers for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.customers to authenticated;
revoke all on public.customers from anon;
