import { useEffect, useMemo, useState, type FormEvent } from "react";
import { planGoal, planFromProposal, runDemoStep, summarizeRun, type AgentRole, type OfficeRun, type OfficeTask } from "./workflow";

const AGENTS: { role: AgentRole; icon: string; title: string; description: string; status: string }[] = [
  { role: "Boss", icon: "♛", title: "Boss AI", description: "Goal & acceptance criteria", status: "Planning" },
  { role: "Manager", icon: "▤", title: "Manager AI", description: "Tasks & coordination", status: "Coordinating" },
  { role: "Developer", icon: "⌘", title: "Developer AI", description: "Implementation proposals", status: "Standby" },
  { role: "QA", icon: "✓", title: "QA AI", description: "Checks & evidence", status: "Verification gate" },
];

const STORAGE_KEY = "ai-office-os-demo-v1";

function readSavedRun(): OfficeRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as OfficeRun : null;
  } catch {
    return null;
  }
}

function StatusPill({ status }: { status: OfficeTask["status"] }) {
  const label = status === "in_progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
  return <span className={`status status--${status}`}>{label}</span>;
}

export default function App() {
  const [goal, setGoal] = useState("");
  const [run, setRun] = useState<OfficeRun | null>(() => readSavedRun());
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);

  useEffect(() => {
    if (run) localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    else localStorage.removeItem(STORAGE_KEY);
  }, [run]);

  const summary = useMemo(() => run ? summarizeRun(run) : { total: 0, done: 0, queued: 0, blocked: 0 }, [run]);
  const selected = run?.tasks.find((task) => task.id === selectedTask) ?? run?.tasks[0] ?? null;

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedGoal = goal.trim();
    if (!requestedGoal) {
      setNotice("Please enter a goal before requesting an AI plan.");
      return;
    }
    if (requestedGoal.length > 500) {
      setNotice("Goal must be 500 characters or fewer.");
      return;
    }
    setIsPlanning(true);
    setNotice("Asking the configured AI provider for a bounded plan…");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: requestedGoal }),
      });
      const payload = await response.json() as { error?: string; plan?: unknown };
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error || "AI plan request failed.");
      }
      const planned = planFromProposal(requestedGoal, payload.plan);
      setRun(planned);
      setSelectedTask(planned.tasks[0]?.id ?? null);
      setNotice("AI plan received and validated. These are proposals only; no code or external action was executed.");
      setGoal("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the AI plan.");
    } finally {
      setIsPlanning(false);
    }
  }

  function createDemoPlan() {
    try {
      const planned = planGoal(goal);
      setRun(planned);
      setSelectedTask(planned.tasks[0]?.id ?? null);
      setNotice("Demo plan created locally. No AI API or external tools were used.");
      setGoal("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the demo plan.");
    }
  }

  function stepForward() {
    if (!run) return;
    if (run.mode === "ai") {
      setNotice("AI tasks are proposals only. Real execution and evidence collection are not connected yet.");
      return;
    }
    setRun(runDemoStep(run));
    setNotice("One simulated step processed. Check each task's evidence before trusting its status.");
  }

  function resetDemo() {
    setRun(null);
    setSelectedTask(null);
    setNotice("Demo workspace cleared from this browser.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="AI Office OS home"><span className="brand-mark">A</span><span>AI Office <small>OPERATING SYSTEM</small></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <a className="nav-item nav-item--active" href="#dashboard"><span>▦</span> Overview</a>
        <a className="nav-item" href="#agents"><span>◈</span> AI Team <span className="nav-count">4</span></a>
        <a className="nav-item" href="#tasks"><span>☷</span> Task board</a>
        <a className="nav-item" href="#activity"><span>◷</span> Activity log</a>
        <div className="sidebar-bottom">
          <div className="founder-avatar">F</div>
          <div><strong>Founder workspace</strong><small>Human approval enabled</small></div>
          <span className="online-dot" aria-label="Demo is local" />
        </div>
      </aside>

      <main id="home" className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="top-actions"><span className="mode-badge"><i /> {run?.mode === "ai" ? "AI PLAN" : "DEMO MODE"}</span><a className="github-link" href="https://github.com/smurari229-ai/ai-office-os" target="_blank" rel="noreferrer">GitHub ↗</a></div></header>
        <section id="dashboard" className="welcome-row">
          <div><div className="eyebrow">WEDNESDAY · AI OPERATIONS</div><h1>Your AI office, <em>at a glance.</em></h1><p>Set a goal. Let your virtual team organize the work. You stay in control.</p></div>
          <div className="secure-note"><span>♧</span><div><strong>Human-in-the-loop</strong><small>Consequential actions need approval</small></div></div>
        </section>

        <section className="stats-grid" aria-label="Workspace statistics">
          <article className="stat-card"><div className="stat-heading">ACTIVE AGENTS <span>◈</span></div><div className="stat-value">04 <small>/ 04</small></div><div className="stat-foot"><span className="mini-dot" /> Role templates loaded</div></article>
          <article className="stat-card"><div className="stat-heading">TASKS IN PLAN <span>☷</span></div><div className="stat-value">{summary.total.toString().padStart(2, "0")} <small>tasks</small></div><div className="stat-foot">Current demo run</div></article>
          <article className="stat-card"><div className="stat-heading">SIMULATED DONE <span>✓</span></div><div className="stat-value">{summary.done.toString().padStart(2, "0")} <small>/ {summary.total.toString().padStart(2, "0")}</small></div><div className="progress-track"><span style={{ width: summary.total ? `${summary.done / summary.total * 100}%` : "0%" }} /></div></article>
          <article className="stat-card"><div className="stat-heading">BLOCKED / REVIEW <span>⚑</span></div><div className="stat-value">{summary.blocked.toString().padStart(2, "0")} <small>items</small></div><div className="stat-foot">Honest status, no fake passes</div></article>
        </section>

        <section className="goal-panel">
          <div className="panel-title"><div className="panel-icon">✳</div><div><h2>Give your office a goal</h2><p>The Boss agent will draft a bounded plan for your team.</p></div></div>
          <form onSubmit={createPlan} className="goal-form"><label htmlFor="goal-input">YOUR OBJECTIVE</label><div className="input-row"><input id="goal-input" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="e.g. Prepare a launch checklist for my new product..." /><button className="primary-button" type="submit" disabled={isPlanning}>{isPlanning ? "Planning…" : "✦ Create AI plan"} <span>→</span></button><button className="secondary-button" type="button" onClick={createDemoPlan} disabled={isPlanning}>Try demo</button></div><div className="form-hint"><span>ⓘ</span> AI mode needs a server-side GEMINI_API_KEY in Vercel. Plans are proposals only; this app does not edit repositories, run code, send emails, or perform external actions.</div></form>
          {notice && <div className="notice" role="status">{notice}</div>}
        </section>

        <section id="agents" className="section-block"><div className="section-heading"><div><div className="eyebrow">YOUR VIRTUAL TEAM</div><h2>Meet the agents</h2></div><span className="subtle-label">4 ROLE TEMPLATES</span></div>
          <div className="agent-grid">{AGENTS.map((agent) => <article className="agent-card" key={agent.role}><div className={`agent-icon agent-icon--${agent.role.toLowerCase()}`}>{agent.icon}</div><div className="agent-card-title"><h3>{agent.title}</h3><span className="agent-dot" /></div><p>{agent.description}</p><div className="agent-card-footer"><span>{agent.status}</span><span className="arrow-muted">↗</span></div></article>)}</div>
        </section>

        <section id="tasks" className="section-block task-section"><div className="section-heading"><div><div className="eyebrow">EXECUTION QUEUE</div><h2>Task board <span className="count-badge">{summary.total}</span></h2></div><div className="task-actions"><button className="secondary-button" onClick={resetDemo} disabled={!run}>Reset</button><button className="primary-button primary-button--small" onClick={stepForward} disabled={!run || run.mode === "ai" || (summary.queued === 0 && summary.blocked > 0)}>{run?.mode === "ai" ? "Execution not connected" : "Run next step →"}</button></div></div>
          {!run ? <div className="empty-state"><div className="empty-icon">☷</div><h3>Your task board is ready</h3><p>Enter a goal above to generate your first plan.</p></div> : <div className="task-layout"><div className="task-list">{run.tasks.map((task, index) => <button className={`task-row ${selected?.id === task.id ? "task-row--selected" : ""}`} key={task.id} onClick={() => setSelectedTask(task.id)}><span className="task-index">{String(index + 1).padStart(2, "0")}</span><span className="task-main"><strong>{task.title}</strong><small>{task.owner} agent · {task.description}</small></span><StatusPill status={task.status} /></button>)}</div><aside className="task-detail"><div className="eyebrow">TASK DETAILS</div>{selected ? <><h3>{selected.title}</h3><p>{selected.description}</p><div className="detail-label">ASSIGNED ROLE</div><div className="detail-owner"><span className="small-avatar">{selected.owner.slice(0, 1)}</span>{selected.owner} AI</div><div className="detail-label">EVIDENCE / NOTES</div><div className="evidence-box">{selected.detail}</div><StatusPill status={selected.status} /></> : <p>Select a task to inspect it.</p>}</aside></div>}
        </section>

        <section id="activity" className="section-block activity-section"><div className="section-heading"><div><div className="eyebrow">AUDIT TRAIL</div><h2>Recent activity</h2></div><span className="subtle-label">LOCAL DEMO LOG</span></div><div className="activity-list">{(run?.log ?? ["Workspace initialized.", "Four role templates loaded.", "Waiting for your first goal."]).slice().reverse().slice(0, 5).map((entry, index) => <div className="activity-item" key={`${index}-${entry}`}><span className={`activity-dot ${index === 0 ? "activity-dot--latest" : ""}`} /><p>{entry}</p><time>{index === 0 ? "Latest" : "History"}</time></div>)}</div></section>
        <footer className="footer"><span>AI OFFICE OS <span className="footer-separator">·</span> EARLY MVP</span><span>Demo mode · No real AI actions performed</span></footer>
      </main>
    </div>
  );
}
