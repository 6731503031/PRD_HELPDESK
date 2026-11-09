/**
 * Ticket detail — shared by My Tickets (requester) and the admin dashboard.
 * Follows the Use Case doc v1.1:
 *   Requester: UC-04 follow status + repair progress · UC-05 edit while still open · UC-13 chat (button "แชท")
 *   Admin:     ① UC-07 triage → ② UC-08 send to Team 10 → ③ UC-09 resolve — in the centre column, under the problem
 */
import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Category, Priority, TicketDetail as Detail } from '../api/types';
import { isStaff, useIdentity } from '../auth/identity';
import { PRIORITY_LABEL, ROUTE_LABEL, formatDateTime, isRepairDone, maintenanceLabel, statusLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Avatar, Icon } from './Icon';
import { ErrorNotice, Field, Loading, Notice, Panel, PriorityText, StatusBadge, StatusTrack } from './ui';

export function TicketDetail({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const { user } = useIdentity();
  const { data: t, error, loading, reload } = useAsync(() => api.ticket(id), [id, user?.id]);

  if (loading && !t) return <Loading variant="detail" />;
  if (error) return <ErrorNotice error={error} />;
  if (!t) return null;

  const staff = isStaff(user);
  const closed = t.status === 'resolved' || t.status === 'closed';
  const changed = () => {
    void reload();
    onChanged?.();
  };

  return (
    <>
      <div className="pagebar">
        <div>
          <p className="muted small">Ticket <strong>{t.ticket_number}</strong></p>
          <h1>{t.title}</h1>
        </div>
        <div className="pagebar__actions">
          <a className="btn btn--secondary btn--small" href={`#/chat/${t.id}`}>
            <Icon name="chat" size={16} /> Chat
          </a>
          <PriorityText priority={t.priority} />
          <StatusBadge status={t.status} />
        </div>
      </div>

      <div className="layout-ticket">
        {/* Main: where the ticket is, what the problem is, repair progress, outcome — and, for the admin, the steps to take */}
        <div>
          <Panel>
            <StatusTrack status={t.status} />

            {!staff && t.status === 'open' ? (
              <RequesterEdit ticket={t} onSaved={changed} />
            ) : (
              <>
                <h3 className="mt-5">Problem details</h3>
                <p className="description mt-2">{t.description}</p>
              </>
            )}

            {staff && !closed && <SystemSuggestion ticket={t} />}

            {t.maintenance_work_order_id && (
              <div className="mt-5">
                <Notice
                  tone={isRepairDone(t.maintenance_status) ? 'ok' : 'info'}
                  title={`Sent to Maintenance, work order ${t.maintenance_work_order_id}`}
                >
                  <p>
                    Repair status: <strong>{maintenanceLabel(t.maintenance_status)}</strong>
                    {t.maintenance_status_at && <span className="muted"> (updated {formatDateTime(t.maintenance_status_at)})</span>}
                  </p>
                </Notice>
              </div>
            )}

            {closed && (
              <div className="mt-5">
                <Notice tone="ok" title={`Resolved on ${formatDateTime(t.resolved_at)}`}>
                  {t.resolution_note && <p>{t.resolution_note}</p>}
                </Notice>
              </div>
            )}
          </Panel>

          {staff && <AdminActions ticket={t} onChanged={changed} />}

          {!staff && !closed && (
            <Panel title="What happens next" quiet>
              <p className="small">{nextStepForRequester(t)}</p>
            </Panel>
          )}
        </div>

        {/* Side: properties and history */}
        <div>
          <Panel title="Ticket information">
            <dl className="meta">
              <dt>Category</dt>
              <dd><span className="chip">{t.category_name ?? '–'}</span></dd>
              <dt>Urgency</dt>
              <dd><PriorityText priority={t.priority} /></dd>
              <dt>Requester</dt>
              <dd className="person"><Avatar name={t.customer_name} size={22} /> {t.customer_name ?? `#${t.customer_id}`}</dd>
              <dt>Reported</dt>
              <dd>{formatDateTime(t.created_at)}</dd>
              <dt>Last updated</dt>
              <dd>{formatDateTime(t.updated_at)}</dd>
            </dl>
          </Panel>

          <Panel title="Status history">
            {t.history.length === 0 ? (
              <p className="muted">No status changes yet.</p>
            ) : (
              <ol className="history">
                {t.history.map((h, i) => (
                  <li key={i}>
                    <strong>{statusLabel(h.to_status)}</strong>
                    {h.note && <span> — {h.note}</span>}
                    <time>
                      {formatDateTime(h.created_at)}
                      {h.source === 'maintenance' ? ' by Maintenance' : h.changed_by_name ? ` by ${h.changed_by_name}` : ''}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** What the requester can expect next. Questions go through the chat button. */
function nextStepForRequester(t: Detail): string {
  if (t.maintenance_work_order_id) {
    return isRepairDone(t.maintenance_status)
      ? 'The repair is done. The Helpdesk team will check the result with you in the chat, then resolve the ticket. The summary will appear on this page.'
      : 'Your ticket has been sent to Maintenance. The repair status updates on this page automatically.';
  }
  if (t.status === 'open') return 'The Helpdesk team will review this ticket. Until then you can still edit the subject and description. Questions? Use the "Chat" button.';
  return 'The Helpdesk team is working on it. When it is resolved, the summary will appear on this page. Questions? Use the "Chat" button.';
}

/* ---------------------------------------------------------------------------
   UC-05 — requester fixes the wording while the ticket is still open
   --------------------------------------------------------------------------- */
function RequesterEdit({ ticket, onSaved }: { ticket: Detail; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const unchanged = title.trim() === ticket.title && description.trim() === ticket.description;
  const tooShort = title.trim().length < 5 || description.trim().length < 10;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateTicket(ticket.id, { title: title.trim(), description: description.trim() });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setTitle(ticket.title);
    setDescription(ticket.description);
    setError(null);
    setEditing(false);
  };

  if (!editing) {
    return (
      <>
        <div className="section-head mt-5">
          <h3>Problem details</h3>
          <button className="btn btn--secondary btn--small" onClick={() => setEditing(true)}>Edit ticket</button>
        </div>
        <p className="description mt-2">{ticket.description}</p>
      </>
    );
  }

  return (
    <form className="form mt-5" onSubmit={save}>
      <h3>Edit ticket</h3>
      <p className="muted small">You can edit until the Helpdesk team starts work. Category and urgency are set by the Helpdesk team.</p>
      <Field id="edit-title" label="Subject" required>
        <input id="edit-title" className="input" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="edit-description" label="Description" required>
        <textarea id="edit-description" className="textarea" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {error ? <ErrorNotice error={error} /> : null}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={saving || unchanged || tooShort}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn btn--plain" type="button" onClick={cancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------
   Admin — PRD §8.1 / FR-10: what the system suggested, advisory only (F31, P4)
   --------------------------------------------------------------------------- */
function SystemSuggestion({ ticket: t }: { ticket: Detail }) {
  if (!t.ai_source || !t.ai_route) {
    return <p className="muted small mt-5">No system suggestion for this ticket yet.</p>;
  }
  const categoryDiffers = t.ai_category_id != null && t.ai_category_id !== t.category_id;
  const priorityDiffers = t.ai_priority != null && t.ai_priority !== t.priority;
  const needsWorkOrder = t.ai_route === 'maintenance' && !t.maintenance_work_order_id;

  return (
    <div className="mt-5">
      <Notice tone={categoryDiffers || priorityDiffers || needsWorkOrder ? 'warn' : 'info'} title={`Suggested: ${ROUTE_LABEL[t.ai_route] ?? t.ai_route}`}>
        <p className="small">
          Category {t.ai_category_name ?? '–'}, urgency {t.ai_priority ? PRIORITY_LABEL[t.ai_priority] : '–'}
          <span className="muted"> ({t.ai_source === 'ai' ? 'suggested by AI' : 'suggested by system rules'})</span>
        </p>
        {(categoryDiffers || priorityDiffers) && (
          <p className="small">
            The requester chose{categoryDiffers ? ` category ${t.category_name ?? '–'}` : ''}
            {priorityDiffers ? ` urgency ${PRIORITY_LABEL[t.priority]}` : ''}, which differs from the suggestion. Check before saving the triage.
          </p>
        )}
        {needsWorkOrder && <p className="small">This is a repair: send it to Maintenance (step 2).</p>}
      </Notice>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Admin steps, in the order the work happens:
   ① UC-07 triage → ② UC-08 send to Team 10 (only for repairs) → ③ UC-09 resolve
   --------------------------------------------------------------------------- */
function AdminActions({ ticket, onChanged }: { ticket: Detail; onChanged: () => void }) {
  const { data: categories, error: categoriesError } = useAsync(() => api.categories(), []);
  const { data: settings } = useAsync(() => api.config(), []);
  const closed = ticket.status === 'resolved' || ticket.status === 'closed';
  const cancelled = ticket.maintenance_status === 'cancelled'; // Team 10 cancelled it: a new work order may be linked
  const linked = !!ticket.maintenance_work_order_id && !cancelled;
  const repairDone = isRepairDone(ticket.maintenance_status);

  const [priority, setPriority] = useState<Priority>(ticket.priority);
  const [categoryId, setCategoryId] = useState<number>(ticket.category_id);
  const [workOrder, setWorkOrder] = useState('');
  const [repairTitle, setRepairTitle] = useState(ticket.title);
  const [repairDescription, setRepairDescription] = useState(ticket.description);
  /** Step ②: show the repair text so the admin can check or edit it before sending. */
  const [editRepair, setEditRepair] = useState(false);
  /** null = not touched yet: follow the default (ticked for repairs). */
  const [sendWithStart, setSendWithStart] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text?: string; error?: unknown; warn?: string } | null>(null);

  const run = async (name: string, action: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setResult(null);
    try {
      await action();
      setResult({ ok: true, text: done });
      setConfirming(false);
      setEditRepair(false);
      onChanged();
    } catch (err) {
      setResult({ ok: false, error: err });
    } finally {
      setBusy(null);
    }
  };

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(ticket.ticket_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false); // the number is on screen to copy by hand
    }
  };

  // Nothing left to do on a finished ticket: no panel (the outcome is shown above). Only the message of the action
  // the admin has just taken stays, so closing a ticket is still acknowledged.
  if (closed) return result?.ok ? <Notice tone="ok" title={result.text} /> : null;

  const triaged = priority === ticket.priority && categoryId === ticket.category_id;
  const noteReady = note.trim().length >= 5;

  // Where the admin is: ① until the work starts, ② only for repairs, ③ once work is under way.
  const started = ticket.status !== 'open';
  const s1: StepState = started ? 'done' : 'current';
  // The category decides: only Facility (repairs) can go to Team 10. Other categories never see step ②.
  const chosenCategory = categories?.find((c) => c.id === categoryId)?.name ?? ticket.category_name;
  const isRepair = (chosenCategory ?? '').toLowerCase() === 'facility';
  const showStep2 = isRepair || linked || cancelled;
  // ② needs ① first: a repair is sent when the admin starts the work (UC-07 → UC-08).
  const s2: StepState = linked ? 'done' : !started ? 'todo' : 'current';
  const portal = settings?.maintenance_portal_url
    ? settings.maintenance_portal_url.replace('{ticketRef}', encodeURIComponent(ticket.ticket_number))
    : null;
  const woText = workOrder.trim();
  const woProblem = /^tkt-/i.test(woText) ? 'This is our own ticket number. Paste the work order number issued by Team 10.' : null;
  const repairReady = repairTitle.trim().length >= 3 && repairDescription.trim().length >= 5;
  const sendNow = isRepair && (sendWithStart ?? true);

  /**
   * ① "start": saves the triage (category + urgency) and moves to in_progress, then, for a repair, sends it to
   * Team 10. If the send fails the work has still started and step ② offers to send again.
   */
  const startWork = async () => {
    setBusy('progress');
    setResult(null);
    try {
      await api.updateTicket(ticket.id, { status: 'in_progress', priority, category_id: categoryId });
    } catch (err) {
      setResult({ ok: false, error: err });
      setBusy(null);
      return;
    }
    if (!sendNow) {
      setResult({ ok: true, text: 'Work started. The requester can no longer edit the ticket.' });
    } else {
      try {
        await api.sendWorkOrder(ticket.id, { title: repairTitle.trim(), description: repairDescription.trim() });
        setResult({ ok: true, text: 'Work started and sent to Team 10. The work order has been linked to this ticket.' });
      } catch (err) {
        setResult({
          ok: true,
          text: 'Work started',
          warn: `but it could not be sent to Team 10: ${err instanceof Error ? err.message : 'something went wrong'} You can send it again in step 2.`,
        });
      }
    }
    setBusy(null);
    onChanged();
  };
  const s3: StepState = started ? 'current' : 'todo';

  return (
    <Panel title="Actions">
      <p className="small muted">
        {showStep2
          ? 'Repair (Facility): step 1, press "Start work and send to Team 10"; step 2, check the result; step 3, resolve once the repair is done.'
          : 'Not a repair, handled by the admin: step 1, start work; step 3, resolve. (For a repair, change the category to Facility.)'}
      </p>

      <div aria-live="polite">
        {result?.ok && !result.warn && <div className="mt-3"><Notice tone="ok" title={result.text} /></div>}
        {result?.ok && result.warn && (
          <div className="mt-3">
            <Notice tone="warn" title={result.text}>
              <p>{result.warn}</p>
            </Notice>
          </div>
        )}
        {result && !result.ok && <div className="mt-3"><ErrorNotice error={result.error} /></div>}
      </div>

      <ol className="actions-grid mt-4">
        {/* ① Triage */}
        <li className={`action action--${s1}`}>
          <StepTitle n={1} state={s1} label="Triage" stateLabel={s1 === 'done' ? 'Work started' : 'To do'} />
          <p className="step-desc">
            Check the category and urgency chosen by the requester (see the suggestion above), correct them if needed, then press "Start work".
            After that the requester can no longer edit the ticket.
          </p>
          {categoriesError ? <ErrorNotice error={categoriesError} /> : null}
          <div className="inline">
            <label className="visually-hidden" htmlFor="triage-priority">Urgency</label>
            <select id="triage-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>Urgency: {PRIORITY_LABEL[p]}</option>
              ))}
            </select>
            <label className="visually-hidden" htmlFor="triage-category">Category</label>
            <select id="triage-category" className="select" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories?.map((c: Category) => (
                <option key={c.id} value={c.id}>Category: {c.name}</option>
              ))}
            </select>
          </div>
          <div className="inline">
            <button
              className="btn btn--secondary"
              disabled={!!busy || triaged}
              onClick={() => run('triage', () => api.updateTicket(ticket.id, { priority, category_id: categoryId }), 'Triage saved')}
            >
              Save triage
            </button>
            {ticket.status === 'open' && !sendNow && (
              <button className="btn" disabled={!!busy} onClick={() => void startWork()}>
                {busy === 'progress' ? 'Saving…' : 'Start work'}
              </button>
            )}
          </div>

          {/* Repairs: start + send to Team 10 in one click. Other categories stay with the admin (no Team 10). */}
          {ticket.status === 'open' && !linked && isRepair && (
            <div className={`handoff__box${sendNow ? ' handoff__box--here' : ''}`}>
              <label className="check">
                <input type="checkbox" checked={sendNow} onChange={(e) => setSendWithStart(e.target.checked)} />
                <span>
                  <strong>Also send to Maintenance (Team 10)</strong>
                  <span className="small muted"> Facility tickets are repairs, so this is ticked for you</span>
                </span>
              </label>
              {sendNow && (
                <>
                  <p className="small">
                    Reference <code>{ticket.ticket_number}</code>
                  </p>
                  <Field id="repair-title" label="Repair title" required>
                    <input id="repair-title" className="input" value={repairTitle} maxLength={150} onChange={(e) => setRepairTitle(e.target.value)} />
                  </Field>
                  <Field
                    id="repair-description"
                    label="Description"
                    required
                    hint="Say where the technician should go (building, room) and remove any names, emails or phone numbers. Team 10 only receives this text and the reference."
                  >
                    <textarea
                      id="repair-description"
                      className="textarea textarea--short"
                      value={repairDescription}
                      maxLength={5000}
                      onChange={(e) => setRepairDescription(e.target.value)}
                    />
                  </Field>
                  <div>
                    <button className="btn" disabled={!!busy || !repairReady} onClick={() => void startWork()}>
                      {busy === 'progress' ? 'Sending…' : 'Start work and send to Team 10'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </li>

        {/* ② Send to Team 10 — repairs (category Facility) only; other categories have no step ② at all. */}
        {showStep2 && (
        <li className={`action action--${s2}`}>
          <StepTitle
            n={2}
            state={s2}
            label="Send to Maintenance"
            stateLabel={s2 === 'done' ? 'Work order linked' : s2 === 'todo' ? 'Sent when work starts' : 'Not sent yet'}
          />
          {linked ? (
            <p className="small">
              Linked to work order <strong>{ticket.maintenance_work_order_id}</strong>
              <br />
              <span className="muted">Latest status: {maintenanceLabel(ticket.maintenance_status)}</span>
            </p>
          ) : s2 === 'todo' ? (
            <p className="step-desc">
              Repairs are sent to Team 10 when you press "Start work" in step 1. The result will show here.
            </p>
          ) : (
            <>
              {/* Not sent yet (the send at "start" failed, or the admin just marked it as a repair): one button, no big form. */}
              <Notice
                tone="warn"
                title={cancelled ? `Work order ${ticket.maintenance_work_order_id} was cancelled by Maintenance` : 'Not sent to Team 10 yet'}
              >
                <p className="small">
                  Press send to create a work order at Team 10 and link it to this ticket. If Team 10 cannot accept it yet, use "Link a work order manually" below.
                </p>
              </Notice>
              <div className="inline">
                <button
                  className="btn"
                  disabled={!!busy || !repairReady}
                  onClick={() =>
                    run(
                      'send',
                      () => api.sendWorkOrder(ticket.id, { title: repairTitle.trim(), description: repairDescription.trim() }),
                      'Sent to Team 10. The work order has been linked to this ticket.',
                    )
                  }
                >
                  {busy === 'send' ? 'Sending…' : 'Send to Team 10'}
                </button>
                <button type="button" className="btn btn--plain btn--small" onClick={() => setEditRepair((v) => !v)}>
                  {editRepair ? 'Hide details' : 'Review or edit before sending'}
                </button>
              </div>
              {editRepair && (
                <div className="handoff__box">
                  <p className="small">
                    Reference <code>{ticket.ticket_number}</code>
                  </p>
                  <Field id="repair-title" label="Repair title" required>
                    <input id="repair-title" className="input" value={repairTitle} maxLength={150} onChange={(e) => setRepairTitle(e.target.value)} />
                  </Field>
                  <Field
                    id="repair-description"
                    label="Description"
                    required
                    hint="Say where the technician should go (building, room) and remove any names, emails or phone numbers. Team 10 only receives this text and the reference."
                  >
                    <textarea
                      id="repair-description"
                      className="textarea textarea--short"
                      value={repairDescription}
                      maxLength={5000}
                      onChange={(e) => setRepairDescription(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {/* Backup way: the admin already has a work order id (e.g. reported in Team 10's own screen). */}
              <details className="fold mt-3">
                <summary className="small">Link a work order manually (already reported in Team 10's system)</summary>
                <div className="fold__body">
                  <p className="small muted">
                    Use this if the repair was reported in Team 10's system (with reference
                    <span className="copy-ref">
                      <code>{ticket.ticket_number}</code>
                      <button type="button" className="btn btn--plain btn--small" onClick={copyRef}>
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </span>
                    ) or if sending from here does not work.
                    {portal && (
                      <>
                        {' '}
                        <a href={portal} target="_blank" rel="noopener noreferrer">
                          Open Team 10 ↗
                        </a>
                      </>
                    )}
                  </p>
                  <Field id="work-order" label="Work order number from Team 10" hint="Paste the work order number (UUID), not our TKT- number. It is checked with Team 10 before saving." error={woProblem ?? undefined}>
                    <div className="inline">
                      <input
                        id="work-order"
                        className="input"
                        placeholder="e.g. 7f3c2a9e-1b4d-4c8e-9a21-5d6e7f8a9b01"
                        value={workOrder}
                        aria-invalid={!!woProblem}
                        onChange={(e) => setWorkOrder(e.target.value)}
                      />
                      <button
                        className="btn btn--secondary"
                        disabled={!!busy || !woText || !!woProblem}
                        onClick={() => run('link', () => api.linkWorkOrder(ticket.id, woText), 'Work order linked. The repair status will update automatically.')}
                      >
                        {busy === 'link' ? 'Checking…' : 'Link work order'}
                      </button>
                    </div>
                  </Field>
                </div>
              </details>
            </>
          )}
        </li>
        )}

        {/* ③ Resolve — summary required, then confirm */}
        <li className={`action action--${s3}`}>
          <StepTitle n={3} state={s3} label="Resolve" stateLabel={s3 === 'todo' ? 'After work starts' : 'To do'} />
          <p className="step-desc">
            When the problem is fixed (for repairs, confirm with the requester in the chat first), write a summary for the requester and confirm.
            The ticket becomes "Resolved". The system never resolves it on its own, even when Team 10 reports the repair as done.
          </p>
          {linked && (repairDone ? (
            <Notice tone="ok" title="Repair done, ready to resolve" />
          ) : (
            <Notice tone="warn" title="Repair not finished yet">
              <p className="small">You can resolve now, but it is better to wait until Team 10 reports the repair as done.</p>
            </Notice>
          ))}
          <Field id="resolution-note" label="Resolution summary" required hint="The requester will see this. At least 5 characters.">
            <textarea
              id="resolution-note"
              className="textarea textarea--short"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setConfirming(false);
              }}
            />
          </Field>
          {!confirming ? (
            <div>
              <button className="btn" disabled={!!busy || !noteReady} onClick={() => setConfirming(true)}>
                Resolve ticket
              </button>
            </div>
          ) : (
            <div className="confirm" role="group" aria-label="Confirm resolution">
              <p className="small">Resolve <strong>{ticket.ticket_number}</strong>? The requester will see this summary and the ticket will become "Resolved".</p>
              <div className="inline">
                <button className="btn" disabled={!!busy} onClick={() => run('resolve', () => api.resolve(ticket.id, note.trim()), 'Ticket resolved')}>
                  {busy === 'resolve' ? 'Resolving…' : 'Confirm and resolve'}
                </button>
                <button className="btn btn--plain" disabled={!!busy} onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
        </li>
      </ol>
    </Panel>
  );
}

/** done = finished · current = what to do now · optional = only sometimes (repairs) · todo = comes later */
type StepState = 'done' | 'current' | 'optional' | 'todo';

function StepTitle({ n, state, label, stateLabel }: { n: number; state: StepState; label: string; stateLabel: string }) {
  return (
    <h3 className="step-title">
      <span className={`step-num step-num--${state}`} aria-hidden="true">{state === 'done' ? '✓' : n}</span>
      {label}
      <span className={`step-state step-state--${state}`}>{stateLabel}</span>
    </h3>
  );
}
