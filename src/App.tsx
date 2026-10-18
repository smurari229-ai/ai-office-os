import { useMemo, useState, type FormEvent } from "react";
import { planFromProposal, summarizeRun, type AgentRole, type OfficeRun, type OfficeTask } from "./workflow";

const AGENTS: { role: AgentRole; icon: string; title: string; description: string; status: string }[] = [
  { role: "Boss", icon: "♛", title: "Boss role", description: "Goal and acceptance criteria", status: "Planning proposal" },
  { role: "Manager", icon: "▤", title: "Manager role", description: "Task breakdown and priorities", status: "Planning proposal" },
  { role: "Developer", icon: "⌘", title: "Developer role", description: "Implementation proposals", status: "Not executing code" },
  { role: "QA", icon: "✓", title: "QA role", description: "Verification requirements", status: "Not running tests" },
];

type SavedWorkflow = {
  id: string;
  goal: string;
  status: string;
  created_at: string;
  plan: { summary: string; tasks: Array<{ title: string; description: string; owner: AgentRole; acceptanceCriteria: string[] }> };
};

function StatusPill({ status }: { status: OfficeTask["status"] }) {
  const label = status === "in_progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
  return <span className={`status status--${status}`}>{label}</span>;
}

export default function App() {
  const [goal, setGoal] = useState("");
  const [run, setRun] = useState<OfficeRun | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [taskRunBusy, setTaskRunBusy] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<Record<string, { status: string; artifact: string; feedback: string }>>({});

  const summary = useMemo(() => run ? summarizeRun(run) : { total: 0, done: 0, queued: 0, blocked: 0 }, [run]);
  const qaPassedArtifacts = useMemo(() => Object.values(taskResults).filter((item) => item.status === "QA_PASSED").length, [taskResults]);
  const selected = run?.tasks.find((task) => task.id === selectedTask) ?? run?.tasks[0] ?? null;

  async function refreshTaskRuns(token: string) {
    const response = await fetch("/api/task-runs", { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json() as {
      error?: string;
      runs?: Array<{ workflow_id: string; task_index: number; status: string; artifact: string; qa_feedback: string }>;
    };
    if (!response.ok) throw new Error(payload.error || "Saved task artifacts could not be loaded.");
    const mapped: Record<string, { status: string; artifact: string; feedback: string }> = {};
    for (const item of payload.runs ?? []) {
      mapped[`${item.workflow_id}:${item.task_index}`] = {
        status: item.status,
        artifact: item.artifact,
        feedback: item.qa_feedback,
      };
    }
    setTaskResults(mapped);
  }

  async function refreshSaved(token: string) {
    const response = await fetch("/api/tasks", { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json() as { error?: string; workflows?: SavedWorkflow[] };
    if (!response.ok) throw new Error(payload.error || "Saved workflow history could not be loaded.");
    setSavedWorkflows(payload.workflows ?? []);
  }

  async function runApprovedTask(workflowId: string, taskIndex: number) {
    if (!accessToken || taskRunBusy) return;
    const key = `${workflowId}:${taskIndex}`;
    setTaskRunBusy(key);
    setNotice("Approved task ka artifact generate aur QA-check ho raha hai…");
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ workflowId, taskIndex }),
      });
      const payload = await response.json() as {
        error?: string; artifact?: string; qa?: { passed?: boolean; feedback?: string };
        run?: { status?: string }; externalActionsPerformed?: boolean;
      };
      if (!response.ok || !payload.artifact || !payload.run?.status || !payload.qa) {
        throw new Error(payload.error || "Task artifact was not confirmed as saved.");
      }
      setTaskResults((current) => ({
        ...current,
        [key]: { status: payload.run!.status!, artifact: payload.artifact!, feedback: payload.qa!.feedback || "No QA feedback returned." },
      }));
      await refreshTaskRuns(accessToken);
      setNotice(`Task artifact saved with status ${payload.run.status}. External actions performed: no.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Task artifact generation failed.");
    } finally {
      setTaskRunBusy(null);
    }
  }

  async function decideWorkflow(workflowId: string, decision: "approve" | "reject") {
    if (!accessToken || decisionBusy) return;
    setDecisionBusy(workflowId);
    setNotice(decision === "approve" ? "Approval decision save ho rahi hai…" : "Rejection decision save ho rahi hai…");
    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ workflowId, decision }),
      });
      const payload = await response.json() as { error?: string; status?: string; auditRecorded?: boolean };
      if (!response.ok || payload.auditRecorded !== true) {
        throw new Error(payload.error || "Database did not confirm an audited decision.");
      }
      await refreshSaved(accessToken);
      setNotice(`Decision recorded: ${payload.status}. This records human approval only; no task has been executed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Decision could not be recorded.");
    } finally {
      setDecisionBusy(null);
    }
  }

  async function authenticate(action: "signin" | "signup") {
    if (!email.trim() || !password) {
      setNotice("Email aur password bharo. Password kam se kam 8 characters ka hona chahiye.");
      return;
    }
    setAuthBusy(true);
    setNotice(action === "signup" ? "Supabase account create kar rahe hain…" : "Sign in kar rahe hain…");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, password }),
      });
      const payload = await response.json() as {
        error?: string; accessToken?: string; user?: { email?: string }; pendingVerification?: boolean; message?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Authentication failed.");
      if (!payload.accessToken) {
        setNotice(payload.message || "Email verification required. Check your inbox.");
        return;
      }
      setAccessToken(payload.accessToken);
      setSignedInEmail(payload.user?.email || email.trim());
      setPassword("");
      await refreshSaved(payload.accessToken);
      await refreshTaskRuns(payload.accessToken);
      setNotice("Sign in successful. Saved workflows and task artifacts are loaded from Supabase.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function signOut() {
    setAccessToken(null);
    setSignedInEmail("");
    setSavedWorkflows([]);
    setRun(null);
    setSelectedTask(null);
    setNotice("Signed out. The in-memory session was cleared.");
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedGoal = goal.trim();
    if (!accessToken) {
      setNotice("Real workflow save karne ke liye pehle Supabase account se sign in karo.");
      return;
    }
    if (!requestedGoal || requestedGoal.length > 500) {
      setNotice("Goal 1–500 characters ka hona chahiye.");
      return;
    }
    setIsPlanning(true);
    setNotice("Configured Gemini provider se real plan request ho rahi hai…");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: requestedGoal }),
      });
      const payload = await response.json() as { error?: string; plan?: unknown; requestId?: string };
      if (!response.ok || !payload.plan) throw new Error(payload.error || "AI plan request failed.");

      const planned = planFromProposal(requestedGoal, payload.plan);
      setRun(planned);
      setSelectedTask(planned.tasks[0]?.id ?? null);
      setGoal("");

      const saveResponse = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? `workflow_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        },
        body: JSON.stringify({ goal: requestedGoal, plan: payload.plan }),
      });
      const savePayload = await saveResponse.json() as { error?: string; saved?: boolean; workflow?: SavedWorkflow | null };
      if (!saveResponse.ok || !savePayload.saved) {
        setNotice(`AI plan generated, but NOT SAVED to the database. ${savePayload.error || "Storage did not confirm a saved record."}`);
        return;
      }
      await refreshSaved(accessToken);
      setNotice(`AI plan generated and saved to Supabase (workflow ${savePayload.workflow?.id ?? "recorded"}). Tasks are proposals only; execution and verification have NOT_RUN.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create or save the AI plan.");
    } finally {
      setIsPlanning(false);
    }
  }

  function clearCurrentPlan() {
    setRun(null);
    setSelectedTask(null);
    setNotice("Current in-memory plan cleared. Saved database records were not deleted.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="AI Office OS home"><span className="brand-mark">A</span><span>AI Office <small>OPERATING SYSTEM</small></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <a className="nav-item nav-item--active" href="#dashboard"><span>▦</span> Overview</a>
        <a className="nav-item" href="#agents"><span>◈</span> Agent roles <span className="nav-count">4</span></a>
        <a className="nav-item" href="#tasks"><span>☷</span> Proposed tasks</a>
        <a className="nav-item" href="#activity"><span>◷</span> Saved workflows</a>
        <div className="sidebar-bottom">
          <div className="founder-avatar">F</div>
          <div><strong>{signedInEmail || "Founder workspace"}</strong><small>{accessToken ? "Authenticated session" : "Sign in required"}</small></div>
          <span className="online-dot" aria-label={accessToken ? "Authenticated" : "Not signed in"} />
        </div>
      </aside>

      <main id="home" className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="top-actions"><span className="mode-badge"><i /> {accessToken ? "AUTHENTICATED" : "SIGN IN REQUIRED"}</span><a className="github-link" href="https://github.com/smurari229-ai/ai-office-os" target="_blank" rel="noreferrer">GitHub ↗</a></div></header>
        <section id="dashboard" className="welcome-row">
          <div><div className="eyebrow">AI OPERATIONS · EARLY MVP</div><h1>Your AI office, <em>at a glance.</em></h1><p>Gemini-backed planning, private workflow records, human approval, and bounded text artifacts with model QA. Autonomous employees, code execution, and repository writes are not enabled.</p></div>
          <div className="secure-note"><span>♧</span><div><strong>Human approval</strong><small>No external action is performed here</small></div></div>
        </section>

        <section className="goal-panel">
          <div className="panel-title"><div className="panel-icon">♙</div><div><h2>Account & secure session</h2><p>Supabase Auth is required to save and load your private workflows. Session stays in memory and is cleared on refresh.</p></div></div>
          {!accessToken ? <form className="goal-form" onSubmit={(event) => { event.preventDefault(); void authenticate("signin"); }}>
            <label htmlFor="auth-email">EMAIL</label>
            <div className="input-row"><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" required /></div>
            <label htmlFor="auth-password">PASSWORD (8–128 CHARACTERS)</label>
            <div className="input-row"><input id="auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required placeholder="Your Supabase account password" /><button className="primary-button" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : "Sign in →"}</button><button className="secondary-button" type="button" disabled={authBusy} onClick={() => void authenticate("signup")}>Create account</button></div>
          </form> : <div className="input-row"><strong>Signed in as {signedInEmail}</strong><button className="secondary-button" type="button" onClick={signOut}>Sign out</button></div>}
        </section>

        <section className="stats-grid" aria-label="Workspace statistics">
          <article className="stat-card"><div className="stat-heading">AGENT ROLE TEMPLATES <span>◈</span></div><div className="stat-value">04 <small>roles</small></div><div className="stat-foot">Role labels in the generated plan; each role is not an independently running AI process</div></article>
          <article className="stat-card"><div className="stat-heading">CURRENT PROPOSAL <span>☷</span></div><div className="stat-value">{summary.total.toString().padStart(2, "0")} <small>tasks</small></div><div className="stat-foot">In-memory proposal only</div></article>
          <article className="stat-card"><div className="stat-heading">AI QA-PASSED ARTIFACTS <span>✓</span></div><div className="stat-value">{qaPassedArtifacts.toString().padStart(2, "0")} <small>artifacts</small></div><div className="stat-foot">Model QA only; not deterministic tests or verified real-world completion</div></article>
          <article className="stat-card"><div className="stat-heading">SAVED WORKFLOWS <span>▤</span></div><div className="stat-value">{savedWorkflows.length.toString().padStart(2, "0")} <small>records</small></div><div className="stat-foot">Loaded from authenticated Supabase API</div></article>
        </section>

        <section className="goal-panel">
          <div className="panel-title"><div className="panel-icon">✳</div><div><h2>Create a real AI plan</h2><p>Requires sign-in, a configured Gemini API key, and the database migration.</p></div></div>
          <form onSubmit={createPlan} className="goal-form"><label htmlFor="goal-input">YOUR OBJECTIVE</label><div className="input-row"><input id="goal-input" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="e.g. Prepare a release checklist..." required /><button className="primary-button" type="submit" disabled={isPlanning || !accessToken}>{isPlanning ? "Planning…" : "✦ Create & save plan"} <span>→</span></button></div><div className="form-hint"><span>ⓘ</span> Real Gemini output is validated and saved as PROPOSED. It is not code execution, a verified task, or a GitHub change.</div></form>
          {notice && <div className="notice" role="status">{notice}</div>}
        </section>

        <section id="agents" className="section-block"><div className="section-heading"><div><div className="eyebrow">WORKFLOW RESPONSIBILITIES</div><h2>Office roles</h2></div><span className="subtle-label">ROLE LABELS · NOT SEPARATE RUNNING AGENTS</span></div>
          <div className="agent-grid">{AGENTS.map((agent) => <article className="agent-card" key={agent.role}><div className={`agent-icon agent-icon--${agent.role.toLowerCase()}`}>{agent.icon}</div><div className="agent-card-title"><h3>{agent.title}</h3><span className="agent-dot" /></div><p>{agent.description}</p><div className="agent-card-footer"><span>{agent.status}</span><span className="arrow-muted">↗</span></div></article>)}</div>
        </section>

        <section id="tasks" className="section-block task-section"><div className="section-heading"><div><div className="eyebrow">PROPOSAL QUEUE</div><h2>Proposed tasks <span className="count-badge">{summary.total}</span></h2></div><div className="task-actions"><button className="secondary-button" onClick={clearCurrentPlan} disabled={!run}>Clear current proposal</button></div></div>
          {!run ? <div className="empty-state"><div className="empty-icon">☷</div><h3>No current proposal</h3><p>Sign in, configure services, and submit an objective to create a real AI plan.</p></div> : <div className="task-layout"><div className="task-list">{run.tasks.map((task, index) => <button className={`task-row ${selected?.id === task.id ? "task-row--selected" : ""}`} key={task.id} onClick={() => setSelectedTask(task.id)}><span className="task-index">{String(index + 1).padStart(2, "0")}</span><span className="task-main"><strong>{task.title}</strong><small>{task.owner} role · {task.description}</small></span><StatusPill status={task.status} /></button>)}</div><aside className="task-detail"><div className="eyebrow">PROPOSAL DETAILS</div>{selected ? <><h3>{selected.title}</h3><p>{selected.description}</p><div className="detail-label">ASSIGNED ROLE</div><div className="detail-owner"><span className="small-avatar">{selected.owner.slice(0, 1)}</span>{selected.owner} role</div><div className="detail-label">EVIDENCE / ACCEPTANCE</div><div className="evidence-box">{selected.detail}</div><StatusPill status={selected.status} /></> : <p>Select a task to inspect it.</p>}</aside></div>}
        </section>

        <section id="activity" className="section-block activity-section"><div className="section-heading"><div><div className="eyebrow">DATABASE RECORDS</div><h2>Saved workflows</h2></div><span className="subtle-label">SUPABASE · USER-SCOPED</span></div><div className="activity-list">{savedWorkflows.length ? savedWorkflows.map((item) => <div className="activity-item" key={item.id}><span className="activity-dot activity-dot--latest" /><p><strong>{item.goal}</strong><br /><small>{item.plan?.tasks?.length ?? 0} proposed tasks · {item.status} · {new Date(item.created_at).toLocaleString()}</small></p><time>{item.id.slice(0, 8)}</time>{(item.status === "PROPOSED" || item.status === "WAITING_FOR_APPROVAL") && <div className="workflow-decision-actions"><button className="primary-button" type="button" disabled={decisionBusy !== null} onClick={() => void decideWorkflow(item.id, "approve")}>{decisionBusy === item.id ? "Saving…" : "Approve"}</button><button className="secondary-button" type="button" disabled={decisionBusy !== null} onClick={() => void decideWorkflow(item.id, "reject")}>Reject</button></div>}{item.status === "APPROVED" && <div className="saved-task-runs"><strong>Approved tasks · artifact generation only</strong>{item.plan?.tasks?.map((task, index) => { const key = `${item.id}:${index}`; const result = taskResults[key]; return <div className="saved-task-run" key={key}><span>{index + 1}. {task.title}</span><button className="secondary-button" type="button" disabled={taskRunBusy !== null} onClick={() => void runApprovedTask(item.id, index)}>{taskRunBusy === key ? "Running QA…" : "Generate & QA"}</button>{result && <div className="task-artifact-result"><small>Status: {result.status} · external actions: none</small><p>{result.artifact}</p><small>QA: {result.feedback}</small></div>}</div>; })}</div>}</div>) : <div className="empty-state"><h3>No saved workflows loaded</h3><p>Sign in after configuring Supabase to view your own records.</p></div>}</div></section>
        <footer className="footer"><span>AI OFFICE OS <span className="footer-separator">·</span> EARLY MVP</span><span>Gemini planning + Supabase workflow records + human decisions + bounded artifact generation · autonomous execution NOT_IMPLEMENTED</span></footer>
      </main>
    </div>
  );
}
