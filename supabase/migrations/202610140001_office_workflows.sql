-- AI Office OS: persistent, user-owned workflow proposals.
-- Apply with Supabase SQL Editor or Supabase CLI before enabling /api/tasks.
create table if not exists public.office_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  goal text not null check (char_length(goal) between 1 and 500),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED', 'WAITING_FOR_APPROVAL', 'RUNNING', 'PAUSED', 'BLOCKED', 'FAILED', 'COMPLETED', 'CANCELLED')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists office_workflows_user_created_idx
  on public.office_workflows (user_id, created_at desc);

alter table public.office_workflows enable row level security;
alter table public.office_workflows force row level security;

drop policy if exists "Users read their own office workflows" on public.office_workflows;
create policy "Users read their own office workflows"
  on public.office_workflows for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users create their own office workflows" on public.office_workflows;
create policy "Users create their own office workflows"
  on public.office_workflows for insert to authenticated
  with check (auth.uid() = user_id);

-- Browser clients and anon users have no direct access. Requests go through
-- the server endpoint with the user's validated access token and RLS remains on.
revoke all on table public.office_workflows from anon;
grant select, insert on table public.office_workflows to authenticated;

create or replace function public.set_office_workflows_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists office_workflows_updated_at on public.office_workflows;
create trigger office_workflows_updated_at
  before update on public.office_workflows
  for each row execute function public.set_office_workflows_updated_at();
