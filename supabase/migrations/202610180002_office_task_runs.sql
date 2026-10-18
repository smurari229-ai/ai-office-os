-- Persist bounded AI-generated task artifacts and QA verdicts after approval.
create table if not exists public.office_workflow_task_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.office_workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_index integer not null check (task_index between 0 and 7),
  task_title text not null check (char_length(task_title) between 1 and 500),
  artifact text not null check (char_length(artifact) between 1 and 12000),
  qa_passed boolean not null,
  qa_feedback text not null check (char_length(qa_feedback) between 1 and 2000),
  status text not null check (status in ('QA_PASSED', 'QA_FAILED')),
  attempt integer not null default 1 check (attempt between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, task_index)
);
create index if not exists office_workflow_task_runs_user_created_idx
  on public.office_workflow_task_runs (user_id, created_at desc);
alter table public.office_workflow_task_runs enable row level security;
alter table public.office_workflow_task_runs force row level security;
drop policy if exists "Users read their own task artifacts" on public.office_workflow_task_runs;
create policy "Users read their own task artifacts"
  on public.office_workflow_task_runs for select to authenticated using (auth.uid() = user_id);
revoke all on table public.office_workflow_task_runs from anon;
grant select on table public.office_workflow_task_runs to authenticated;

create or replace function public.record_office_task_run(
  p_workflow_id uuid, p_task_index integer, p_artifact text, p_qa_passed boolean, p_qa_feedback text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_workflow_status text;
  v_plan jsonb;
  v_task_title text;
  v_result public.office_workflow_task_runs%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_task_index < 0 or p_task_index > 7 then raise exception 'Invalid task index'; end if;
  if p_artifact is null or char_length(p_artifact) < 1 or char_length(p_artifact) > 12000 then raise exception 'Invalid artifact size'; end if;
  if p_qa_feedback is null or char_length(p_qa_feedback) < 1 or char_length(p_qa_feedback) > 2000 then raise exception 'Invalid QA feedback size'; end if;
  select w.status, w.plan into v_workflow_status, v_plan
    from public.office_workflows as w where w.id = p_workflow_id and w.user_id = v_user_id for update;
  if not found then raise exception 'Workflow not found'; end if;
  if v_workflow_status <> 'APPROVED' then raise exception 'Workflow must be approved before execution'; end if;
  if jsonb_typeof(v_plan->'tasks') <> 'array' or p_task_index >= jsonb_array_length(v_plan->'tasks') then raise exception 'Task index outside approved plan'; end if;
  v_task_title := v_plan->'tasks'->p_task_index->>'title';
  if v_task_title is null or char_length(v_task_title) < 1 then raise exception 'Approved task title missing'; end if;
  insert into public.office_workflow_task_runs
    (workflow_id, user_id, task_index, task_title, artifact, qa_passed, qa_feedback, status, attempt)
  values (p_workflow_id, v_user_id, p_task_index, v_task_title, p_artifact, p_qa_passed, p_qa_feedback,
    case when p_qa_passed then 'QA_PASSED' else 'QA_FAILED' end, 1)
  on conflict (workflow_id, task_index) do update set
    task_title = excluded.task_title, artifact = excluded.artifact, qa_passed = excluded.qa_passed,
    qa_feedback = excluded.qa_feedback, status = excluded.status,
    attempt = public.office_workflow_task_runs.attempt + 1, updated_at = now()
  where public.office_workflow_task_runs.user_id = v_user_id
  returning * into v_result;
  if not found then raise exception 'Could not record task artifact'; end if;
  return jsonb_build_object('runId', v_result.id, 'workflowId', v_result.workflow_id,
    'taskIndex', v_result.task_index, 'taskTitle', v_result.task_title, 'status', v_result.status,
    'qaPassed', v_result.qa_passed, 'attempt', v_result.attempt, 'createdAt', v_result.created_at);
end;
$$;
revoke all on function public.record_office_task_run(uuid, integer, text, boolean, text) from public;
revoke all on function public.record_office_task_run(uuid, integer, text, boolean, text) from anon;
grant execute on function public.record_office_task_run(uuid, integer, text, boolean, text) to authenticated;
