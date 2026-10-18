-- Auditable human approval decisions for workflow proposals.
-- Apply after 202610140001_office_workflows.sql.
alter table public.office_workflows
  drop constraint if exists office_workflows_status_check;

alter table public.office_workflows
  add constraint office_workflows_status_check
  check (status in (
    'PROPOSED', 'WAITING_FOR_APPROVAL', 'APPROVED', 'RUNNING',
    'PAUSED', 'BLOCKED', 'FAILED', 'COMPLETED', 'CANCELLED'
  ));

create table if not exists public.office_workflow_approval_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.office_workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('approve', 'reject')),
  from_status text not null,
  to_status text not null check (to_status in ('APPROVED', 'CANCELLED')),
  created_at timestamptz not null default now()
);

create index if not exists office_workflow_approval_events_user_created_idx
  on public.office_workflow_approval_events (user_id, created_at desc);

alter table public.office_workflow_approval_events enable row level security;
alter table public.office_workflow_approval_events force row level security;

drop policy if exists "Users read their own approval events" on public.office_workflow_approval_events;
create policy "Users read their own approval events"
  on public.office_workflow_approval_events for select to authenticated
  using (auth.uid() = user_id);

revoke all on table public.office_workflow_approval_events from anon;
grant select on table public.office_workflow_approval_events to authenticated;

-- A single transaction updates the workflow and records the decision atomically.
-- The function is narrowly scoped, checks the caller's identity, and uses a fixed
-- search_path. It does not execute tasks or perform external side effects.
create or replace function public.decide_office_workflow(
  p_workflow_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_from_status text;
  v_to_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid decision';
  end if;

  select w.status into v_from_status
  from public.office_workflows as w
  where w.id = p_workflow_id and w.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Workflow not found';
  end if;

  if v_from_status not in ('PROPOSED', 'WAITING_FOR_APPROVAL') then
    raise exception 'Workflow is not awaiting a decision';
  end if;

  v_to_status := case when p_decision = 'approve' then 'APPROVED' else 'CANCELLED' end;

  update public.office_workflows
    set status = v_to_status, updated_at = now()
    where id = p_workflow_id and user_id = v_user_id;

  insert into public.office_workflow_approval_events
    (workflow_id, user_id, decision, from_status, to_status)
    values (p_workflow_id, v_user_id, p_decision, v_from_status, v_to_status);

  return jsonb_build_object(
    'workflowId', p_workflow_id,
    'decision', p_decision,
    'status', v_to_status,
    'auditRecorded', true
  );
end;
$$;

revoke all on function public.decide_office_workflow(uuid, text) from public;
revoke all on function public.decide_office_workflow(uuid, text) from anon;
grant execute on function public.decide_office_workflow(uuid, text) to authenticated;
