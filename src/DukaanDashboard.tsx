import { useEffect, useMemo, useState, type FormEvent } from "react";

type LeadStatus = "New" | "Contacted" | "Interested" | "Converted" | "Lost";
type Lead = { id: string; name: string; phone: string; need: string; status: LeadStatus; followUp: string; createdAt: string };

const KEY = "dukaanai-leads-v1";
const initial: Lead[] = [];

function localDate(): string {\n  const now = new Date();\n  const pad = (value: number) => String(value).padStart(2, "0");\n  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;\n}\n\nfunction loadLeads(): Lead[] {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) as Lead[] : initial; }
  catch { return initial; }
}

export default function DukaanDashboard() {
  const [leads, setLeads] = useState<Lead[]>(loadLeads);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("Your workspace is ready. Add a real enquiry to start tracking customers.");
  const [form, setForm] = useState({ name: "", phone: "", need: "", followUp: "" });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(leads)); }, [leads]);
  const filtered = useMemo(() => leads.filter(l => (statusFilter === "All" || l.status === statusFilter) && (l.name + l.phone + l.need).toLowerCase().includes(query.toLowerCase())), [leads, query, statusFilter]);
  const today = localDate();
  const due = leads.filter(l => l.followUp && l.followUp <= today && !["Converted", "Lost"].includes(l.status)).length;
  const converted = leads.filter(l => l.status === "Converted").length;

  function addLead(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { setNotice("Customer name and phone are required."); return; }
    const lead: Lead = { ...form, id: crypto.randomUUID(), name: form.name.trim(), phone: form.phone.trim(), need: form.need.trim() || "Not specified", status: "New", createdAt: today };
    setLeads(prev => [lead, ...prev]); setForm({ name: "", phone: "", need: "", followUp: "" }); setShowForm(false); setNotice("Customer added. Remember to contact them and update their status.");
  }
  function updateStatus(id: string, status: LeadStatus) { setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l)); setNotice("Customer status updated."); }

  return <div className="dukaan-shell">
    <aside className="dukaan-sidebar"><a className="dukaan-brand" href="#top"><span className="dukaan-logo">D</span><span>DukaanAI<small>BUSINESS DESK</small></span></a><div className="dukaan-nav-label">WORKSPACE</div><a className="dukaan-nav active" href="#overview">▦ <span>Overview</span></a><a className="dukaan-nav" href="#customers">♙ <span>Customers & leads</span></a><a className="dukaan-nav" href="#followups">◷ <span>Follow-ups</span></a><div className="dukaan-side-note"><b>Early access</b><p>Customer records stay in this browser in this prototype. No cloud sync yet.</p></div></aside>
    <main id="top" className="dukaan-main"><header className="dukaan-topbar"><span>Workspace <i>/</i> Overview</span><span className="dukaan-local"><b/> LOCAL WORKSPACE</span></header>
      <section id="overview" className="dukaan-welcome"><div><div className="dukaan-eyebrow">YOUR BUSINESS, IN CONTROL</div><h1>Good business starts with <em>good follow-up.</em></h1><p>Keep enquiries organized, remember who needs a call, and move every lead forward.</p></div><button className="dukaan-primary" onClick={() => setShowForm(v => !v)}>＋ Add customer</button></section>
      <section className="dukaan-stats"><article><span>TOTAL CUSTOMERS</span><strong>{leads.length}</strong><small>All saved enquiries</small></article><article><span>FOLLOW-UPS DUE</span><strong>{due}</strong><small>Due today or overdue</small></article><article><span>INTERESTED</span><strong>{leads.filter(l => l.status === "Interested").length}</strong><small>Warm opportunities</small></article><article><span>CONVERTED</span><strong>{converted}</strong><small>Marked as won by you</small></article></section>
      {showForm && <form className="dukaan-form" onSubmit={addLead}><div className="dukaan-form-head"><div><b>Add a customer</b><p>Save an enquiry and set a reminder date.</p></div><button type="button" className="dukaan-close" onClick={() => setShowForm(false)} aria-label="Close">×</button></div><div className="dukaan-fields"><label>Customer name<input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="e.g. Priya Sharma" required /></label><label>Phone number<input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+91..." required /></label><label>What do they need?<input value={form.need} onChange={e => setForm({...form,need:e.target.value})} placeholder="Product, service, course..." /></label><label>Follow-up date<input type="date" value={form.followUp} onChange={e => setForm({...form,followUp:e.target.value})} /></label></div><button className="dukaan-primary" type="submit">Save customer</button></form>}
      {notice && <div className="dukaan-notice" role="status">{notice}</div>}
      <section id="customers" className="dukaan-card"><div className="dukaan-section-head"><div><div className="dukaan-eyebrow">CUSTOMER RELATIONSHIPS</div><h2>Customers & leads</h2></div><button className="dukaan-secondary" onClick={() => setShowForm(true)}>＋ New enquiry</button></div><div className="dukaan-toolbar"><input aria-label="Search customers" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone or enquiry..." /><select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>{["All","New","Contacted","Interested","Converted","Lost"].map(s => <option key={s}>{s}</option>)}</select></div><div className="dukaan-table-wrap"><table className="dukaan-table"><thead><tr><th>CUSTOMER</th><th>ENQUIRY</th><th>STATUS</th><th>FOLLOW-UP</th><th>UPDATE STATUS</th></tr></thead><tbody>{filtered.map(l => <tr key={l.id}><td><b>{l.name}</b><small>{l.phone}</small></td><td>{l.need}</td><td><span className={"dukaan-status s-" + l.status.toLowerCase()}>{l.status}</span></td><td>{l.followUp || "Not set"}</td><td><select aria-label={"Update status for " + l.name} value={l.status} onChange={e => updateStatus(l.id, e.target.value as LeadStatus)}>{["New","Contacted","Interested","Converted","Lost"].map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="dukaan-empty">No matching customers. Add a new enquiry to get started.</div>}</div></section>
      <section id="followups" className="dukaan-bottom-grid"><article className="dukaan-card"><div className="dukaan-eyebrow">NEXT ACTIONS</div><h2>Follow-up list</h2>{leads.filter(l => l.followUp && !["Converted","Lost"].includes(l.status)).sort((a,b)=>a.followUp.localeCompare(b.followUp)).slice(0,4).map(l=><div className="dukaan-follow" key={l.id}><span className="dukaan-follow-dot"/><div><b>{l.name}</b><small>{l.need}</small></div><time>{l.followUp}</time></div>)}{leads.every(l => !l.followUp || ["Converted","Lost"].includes(l.status)) && <p className="dukaan-muted">No follow-ups scheduled yet.</p>}</article><article className="dukaan-card dukaan-assist"><div className="dukaan-eyebrow">AI ASSISTANT</div><h2>Your next best action</h2><p>This first release tracks customers and follow-up dates. AI-generated replies, WhatsApp messaging, reminders and automatic lead scoring are not connected yet.</p><span className="dukaan-coming">PLANNED · NOT ACTIVE</span></article></section>
      <footer className="dukaan-footer">DUKAANAI · EARLY MVP <span>Prototype only · No messages or payments are sent</span></footer>
    </main>
  </div>;
}
