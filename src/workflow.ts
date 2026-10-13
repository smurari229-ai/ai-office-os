export type AgentRole = "Boss" | "Manager" | "Developer" | "QA";
export type TaskStatus = "queued" | "in_progress" | "blocked" | "done";

export interface OfficeTask {
  id: string;
  title: string;
  description: string;
  owner: AgentRole;
  status: TaskStatus;
  detail: string;
}

export interface OfficeRun {
  id: string;
  goal: string;
  createdAt: string;
  tasks: OfficeTask[];
  log: string[];
  mode: "demo";
}

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function planGoal(goalInput: string, now = new Date()): OfficeRun {
  const goal = goalInput.trim();
  if (!goal) throw new Error("Please enter a goal before creating a plan.");
  if (goal.length > 500) throw new Error("Goal must be 500 characters or fewer.");

  const tasks: OfficeTask[] = [
    { id: makeId(), title: "Define success criteria", description: "Translate the goal into a clear outcome and acceptance criteria.", owner: "Boss", status: "queued", detail: "Demo planner created this task. A human should confirm the outcome before execution." },
    { id: makeId(), title: "Break work into safe steps", description: "Create a small plan with dependencies, limits, and approval gates.", owner: "Manager", status: "queued", detail: "Demo manager prepared a bounded task list. No external tools have been called." },
    { id: makeId(), title: "Prepare implementation proposal", description: "Draft a proposed implementation and identify likely files or resources.", owner: "Developer", status: "queued", detail: "Demo developer did not edit code or access a repository." },
    { id: makeId(), title: "Verify against acceptance criteria", description: "List checks required before the result can be considered complete.", owner: "QA", status: "queued", detail: "Demo QA has not run tests. Verification is pending real checks." },
  ];

  return {
    id: makeId(),
    goal,
    createdAt: now.toISOString(),
    tasks,
    log: ["Founder submitted a goal.", "Boss created success-criteria task.", "Manager organized a bounded demo plan.", "Developer and QA tasks are queued. No real tools or external services were used."],
    mode: "demo",
  };
}

export function runDemoStep(run: OfficeRun): OfficeRun {
  const next = { ...run, tasks: run.tasks.map((task) => ({ ...task })), log: [...run.log] };
  const activeIndex = next.tasks.findIndex((task) => task.status === "in_progress");
  const queuedIndex = next.tasks.findIndex((task) => task.status === "queued");
  const index = activeIndex >= 0 ? activeIndex : queuedIndex;

  if (index < 0) {
    next.log.push("No queued tasks remain. Human review is still required; demo completion is not proof of real-world success.");
    return next;
  }

  const task = next.tasks[index];
  if (task.owner === "QA") {
    task.status = "blocked";
    task.detail = "BLOCKED: the demo cannot claim tests passed because no application or external checks were executed.";
    next.log.push("QA marked the task BLOCKED because no real verification evidence exists.");
    return next;
  }

  task.status = "done";
  task.detail = `Demo step completed for ${task.owner}. This is simulated progress, not a real-world action.`;
  next.log.push(`${task.owner} completed a simulated step: ${task.title}.`);
  return next;
}

export function summarizeRun(run: OfficeRun) {
  return {
    total: run.tasks.length,
    done: run.tasks.filter((task) => task.status === "done").length,
    queued: run.tasks.filter((task) => task.status === "queued").length,
    blocked: run.tasks.filter((task) => task.status === "blocked").length,
  };
}
