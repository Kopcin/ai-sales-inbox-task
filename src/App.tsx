import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { api, type Extraction } from "./api";
import type { Lead, Message } from "./types";

const path = window.location.pathname.replace(/\/+$/, "") || "/inbox";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function Layout({ children }: { children: ReactNode }) {
  const isPipeline = path === "/pipeline";
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/inbox" aria-label="InboxIQ home"><span className="brand-mark">IQ</span><span>InboxIQ</span></a>
        <nav aria-label="Primary navigation">
          <a className={!isPipeline ? "nav-link active" : "nav-link"} href="/inbox" aria-current={!isPipeline ? "page" : undefined}>Inbox</a>
          <a className={isPipeline ? "nav-link active" : "nav-link"} href="/pipeline" aria-current={isPipeline ? "page" : undefined}>Pipeline</a>
        </nav>
        <span className="status-pill"><span className="status-dot" /> Local workspace</span>
      </header>
      {children}
    </div>
  );
}

function StateMessage({ children }: { children: ReactNode }) {
  return <p className="state-message">{children}</p>;
}

function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listMessages().then((result) => {
      if (active) { setMessages(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Sales workspace</p><h1>Inbox</h1><p className="muted">Review inbound conversations and decide what deserves a follow-up.</p></div><div className="metric-card"><strong>{messages.length}</strong><span>messages</span></div></section>
      <section className="panel" aria-labelledby="messages-heading">
        <div className="panel-heading"><h2 id="messages-heading">Latest messages</h2><span className="muted">Deterministic demo data</span></div>
        {state === "loading" && <StateMessage>Loading inbox…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the inbox. Check that the API is running.</StateMessage>}
        {state === "ready" && (messages.length === 0
          ? <p className="state-message">No messages yet.</p>
          : <ul className="message-list">{messages.map((message) => <MessageRow key={message.id} message={message} />)}</ul>)}
      </section>
    </main>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <li>
      <a className="message-row" href={`/inbox/${message.id}`}>
        <span className="avatar">{message.senderName.slice(0, 1)}</span>
        <span className="message-copy">
          <span className="message-meta"><strong>{message.senderName}</strong><span>{formatDate(message.createdAt)}</span></span>
          <span className="message-subject">{message.subject}</span>
          <span className="message-preview">{message.company} · {message.body}</span>
        </span>
        <span className="row-arrow" aria-hidden="true">→</span>
      </a>
    </li>
  );
}

function DetailPage({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [fields, setFields] = useState({ product: "", quantity: "", material: "", budget: "" });
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    api.getMessage(messageId).then((result) => {
      if (active) { setMessage(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, [messageId]);

  if (state === "loading") return <main className="page-container"><StateMessage>Loading message…</StateMessage></main>;
  if (state === "error" || !message) return <main className="page-container"><StateMessage>Message not found.</StateMessage></main>;

  function applyExtraction(extraction: Extraction) {
    setFields((current) => ({
      product: current.product || extraction.product || "",
      quantity: current.quantity || (extraction.quantity == null ? "" : String(extraction.quantity)),
      material: current.material || extraction.material || "",
      budget: current.budget || (extraction.budget == null ? "" : String(extraction.budget)),
    }));
  }

  async function handleExtract() {
    setExtracting(true);
    setFormError("");
    try {
      applyExtraction(await api.extract(messageId));
    } catch {
      setFormError("Extraction failed. You can fill in the fields manually.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(fields.quantity);
    const budget = fields.budget === "" ? null : Number(fields.budget);
    if (!fields.product.trim()) {
      setFormError("Product is required.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setFormError("Quantity must be a positive whole number.");
      return;
    }
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      setFormError("Budget must be a non-negative number.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api.createLead({
        sourceMessageId: messageId,
        product: fields.product.trim(),
        quantity,
        material: fields.material,
        budget,
      });
      setSaved(true);
    } catch {
      setFormError("Could not save the lead. Check the values and try again.");
    } finally {
      setSaving(false);
    }
  }

  const updateField = (field: keyof typeof fields) => (event: ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [field]: event.target.value }));

  return (
    <main className="page-container detail-layout">
      <a className="back-link" href="/inbox">← Back to inbox</a>
      <section className="detail-grid">
        <article className="panel message-detail">
          <p className="eyebrow">Inbound message</p>
          <h1>{message.subject}</h1>
          <dl className="message-facts">
            <div><dt>Sender</dt><dd>{message.senderName} · {message.senderEmail}</dd></div>
            <div><dt>Company</dt><dd>{message.company}</dd></div>
          </dl>
          <div className="message-body">{message.body}</div>
        </article>
        <aside className="panel extraction-panel" aria-label="Lead extraction">
          <p className="eyebrow">Next step</p>
          <button className="primary-button" type="button" onClick={handleExtract} disabled={extracting || saving || saved}>{
            extracting ? "Extracting…" : "Extract with AI"
          }</button>
          <form className="lead-form" onSubmit={handleSave} noValidate>
            {(["product", "quantity", "material", "budget"] as const).map((field) => (
              <label key={field}>{field.charAt(0).toUpperCase() + field.slice(1)}
                <input
                  value={fields[field]}
                  onChange={updateField(field)}
                  type={field === "quantity" || field === "budget" ? "number" : "text"}
                  min={field === "quantity" ? 1 : field === "budget" ? 0 : undefined}
                  step={field === "quantity" ? 1 : field === "budget" ? "any" : undefined}
                  required={field === "product" || field === "quantity"}
                  disabled={saving || saved}
                />
              </label>
            ))}
            {formError && <p className="form-error" role="alert">{formError}</p>}
            {saved ? <p className="success-message" role="status">Lead saved. <a href="/pipeline">View pipeline</a></p> :
              <button className="primary-button" type="submit" disabled={saving || extracting}>{saving ? "Saving…" : "Save lead"}</button>}
          </form>
        </aside>
      </section>
    </main>
  );
}

function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listLeads().then((result) => {
      if (active) { setLeads(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Revenue view</p><h1>Pipeline</h1><p className="muted">Saved leads will appear here.</p></div><div className="metric-card"><strong>{leads.length}</strong><span>leads</span></div></section>
      <section className="panel" aria-labelledby="pipeline-heading">
        <div className="panel-heading"><h2 id="pipeline-heading">Leads</h2></div>
        {state === "loading" && <StateMessage>Loading pipeline…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the pipeline.</StateMessage>}
        {state === "ready" && (leads.length === 0 ? <p className="state-message">No leads yet.</p> : <ul className="lead-list">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}</ul>)}
      </section>
    </main>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(lead.status);
  async function markContacted() {
    setSaving(true);
    setError("");
    try {
      await api.markContacted(lead.id);
      setStatus("CONTACTED");
    } catch {
      setError("Could not update lead status.");
    } finally {
      setSaving(false);
    }
  }
  return <li className="lead-card"><div><h3>{lead.product}</h3><p>{lead.quantity} unit{lead.quantity === 1 ? "" : "s"}{lead.material ? ` · ${lead.material}` : ""}</p><span className="muted">{status} · {lead.budget === null ? "Budget unknown" : `${lead.budget}`}</span>{status === "NEW" && <button className="secondary-button" type="button" onClick={markContacted} disabled={saving}>{saving ? "Saving…" : "Mark as contacted"}</button>}{error && <p className="form-error" role="alert">{error}</p>}</div></li>;
}

export function App() {
  const content = path === "/pipeline" ? <PipelinePage /> : path.startsWith("/inbox/") ? <DetailPage messageId={decodeURIComponent(path.slice("/inbox/".length))} /> : <InboxPage />;
  return <Layout>{content}</Layout>;
}
