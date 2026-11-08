/**
 * Ticket detail — shared by My Tickets (requester) and Agent Queue (staff).
 * PRD FR-06 (detail, status, history, comments, resolution), §6 maintenance status.
 */
import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Category, Comment, Priority, TicketDetail as Detail, User, Visibility } from '../api/types';
import { isStaff, useIdentity } from '../auth/identity';
import { PRIORITY_LABEL, ROUTE_LABEL, STATUS_LABEL, formatDateTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { ErrorNotice, Field, Loading, Notice, Panel, PriorityText, StatusBadge, StatusTrack } from './ui';

export function TicketDetail({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const { user } = useIdentity();
  const { data: t, error, loading, reload } = useAsync(() => api.ticket(id), [id, user?.id]);

  if (loading && !t) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  if (!t) return null;

  const changed = () => {
    void reload();
    onChanged?.();
  };

  return (
    <div>
      <Panel
        title={t.title}
        action={<StatusBadge status={t.status} />}
      >
        <p className="muted small" style={{ marginBottom: 16 }}>
          คำร้องเลขที่ <strong>{t.ticket_number}</strong>
        </p>
        <StatusTrack status={t.status} />

        <dl className="meta" style={{ marginTop: 24 }}>
          <dt>หมวดหมู่</dt>
          <dd>{t.category_name ?? '–'}</dd>
          <dt>ความเร่งด่วน</dt>
          <dd><PriorityText priority={t.priority} /></dd>
          <dt>ผู้แจ้ง</dt>
          <dd>{t.customer_name ?? `#${t.customer_id}`}</dd>
          <dt>ผู้รับผิดชอบ</dt>
          <dd>{t.agent_name ?? 'ยังไม่มีผู้รับเรื่อง'}</dd>
          <dt>แจ้งเมื่อ</dt>
          <dd>{formatDateTime(t.created_at)}</dd>
          <dt>อัปเดตล่าสุด</dt>
          <dd>{formatDateTime(t.updated_at)}</dd>
        </dl>

        <h3 style={{ marginTop: 24 }}>รายละเอียด</h3>
        <p className="description" style={{ marginTop: 8 }}>{t.description}</p>

        {isStaff(user) && <SystemSuggestion ticket={t} />}

        {t.maintenance_work_order_id && (
          <div style={{ marginTop: 24 }}>
            <Notice tone="info" title={`ส่งต่อฝ่ายซ่อมบำรุงแล้ว ใบงาน ${t.maintenance_work_order_id}`}>
              <p>
                สถานะงานซ่อม: {t.maintenance_status ?? 'รอการตอบรับจากฝ่ายซ่อมบำรุง'}
                {t.maintenance_status_at && <span className="muted"> (อัปเดต {formatDateTime(t.maintenance_status_at)})</span>}
              </p>
            </Notice>
          </div>
        )}

        {t.status === 'resolved' || t.status === 'closed' ? (
          <div style={{ marginTop: 24 }}>
            <Notice tone="ok" title={`แก้ไขแล้วเมื่อ ${formatDateTime(t.resolved_at)}`}>
              {t.resolution_note && <p>{t.resolution_note}</p>}
            </Notice>
          </div>
        ) : null}
      </Panel>

      {isStaff(user) && <AgentActions ticket={t} onChanged={changed} />}

      <Comments ticketId={t.id} />

      <Panel title="ประวัติสถานะ">
        {t.history.length === 0 ? (
          <p className="muted">ยังไม่มีการเปลี่ยนสถานะ</p>
        ) : (
          <ol className="history">
            {t.history.map((h, i) => (
              <li key={i}>
                <strong>{STATUS_LABEL[h.to_status as keyof typeof STATUS_LABEL] ?? h.to_status}</strong>
                {h.note && <span> — {h.note}</span>}
                <time>
                  {formatDateTime(h.created_at)}
                  {h.source === 'maintenance' ? ' โดยฝ่ายซ่อมบำรุง' : h.changed_by_name ? ` โดย ${h.changed_by_name}` : ''}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Comments (P2 backend) — FR-11 public, FR-12 internal
   --------------------------------------------------------------------------- */
function Comments({ ticketId }: { ticketId: number }) {
  const { user } = useIdentity();
  const staff = isStaff(user);
  const { data, error, loading, reload } = useAsync(() => api.comments(ticketId), [ticketId, user?.id]);
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    try {
      await api.addComment(ticketId, text, visibility);
      setText('');
      void reload();
    } catch (err) {
      setSendError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel title="การสนทนา">
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : data && data.length === 0 ? (
        <p className="muted">ยังไม่มีข้อความ</p>
      ) : (
        <div className="thread">
          {data?.map((c: Comment) => (
            <article key={c.id} className={`comment${c.visibility === 'internal' ? ' comment--internal' : ''}`}>
              <span className="comment__by">{c.author_name ?? `#${c.author_id}`}</span>
              {c.visibility === 'internal' && <span className="comment__tag">บันทึกภายใน ผู้แจ้งมองไม่เห็น</span>}
              <span className="comment__when">{formatDateTime(c.created_at)}</span>
              <p>{c.content}</p>
            </article>
          ))}
        </div>
      )}

      <form className="form" onSubmit={submit} style={{ marginTop: 24 }}>
        <Field id={`comment-${ticketId}`} label="เขียนข้อความ">
          <textarea
            id={`comment-${ticketId}`}
            className="textarea"
            style={{ minHeight: 90 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
        </Field>
        {staff && (
          <fieldset className="field">
            <legend>ใครเห็นข้อความนี้</legend>
            <div className="choice-row">
              <label className="choice">
                <input type="radio" name={`vis-${ticketId}`} checked={visibility === 'public'} onChange={() => setVisibility('public')} />
                ผู้แจ้งและเจ้าหน้าที่
              </label>
              <label className="choice">
                <input type="radio" name={`vis-${ticketId}`} checked={visibility === 'internal'} onChange={() => setVisibility('internal')} />
                เฉพาะเจ้าหน้าที่ (บันทึกภายใน)
              </label>
            </div>
          </fieldset>
        )}
        {sendError ? <ErrorNotice error={sendError} /> : null}
        <div className="form-actions">
          <button className="btn" type="submit" disabled={sending || !text.trim()}>
            {sending ? 'กำลังส่ง…' : 'ส่งข้อความ'}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/* ---------------------------------------------------------------------------
   Staff actions — FR-09 assign, FR-10 triage, §6 link work order, FR-13 resolve
   --------------------------------------------------------------------------- */
/**
 * PRD §8.1 / FR-10: the agent sees what the system suggested and whether the requester chose differently.
 * Advisory only — the agent's own triage decision is what counts. Data filled by recordSuggestion (F31, P4).
 */
function SystemSuggestion({ ticket: t }: { ticket: Detail }) {
  if (!t.ai_source || !t.ai_route) {
    return <p className="muted small" style={{ marginTop: 24 }}>ยังไม่มีคำแนะนำจากระบบสำหรับคำร้องนี้</p>;
  }
  const categoryDiffers = t.ai_category_id != null && t.ai_category_id !== t.category_id;
  const priorityDiffers = t.ai_priority != null && t.ai_priority !== t.priority;
  const needsWorkOrder = t.ai_route === 'maintenance' && !t.maintenance_work_order_id;

  return (
    <div style={{ marginTop: 24 }}>
      <Notice tone={categoryDiffers || priorityDiffers || needsWorkOrder ? 'warn' : 'info'} title={`ระบบแนะนำ: ${ROUTE_LABEL[t.ai_route] ?? t.ai_route}`}>
        <p className="small">
          หมวด {t.ai_category_name ?? '–'}, ความเร่งด่วน {t.ai_priority ? PRIORITY_LABEL[t.ai_priority] : '–'}
          <span className="muted"> ({t.ai_source === 'ai' ? 'แนะนำโดย AI' : 'แนะนำตามกฎของระบบ'})</span>
        </p>
        {(categoryDiffers || priorityDiffers) && (
          <p className="small">
            ผู้แจ้งเลือก{categoryDiffers ? ` หมวด ${t.category_name ?? '–'}` : ''}
            {priorityDiffers ? ` ความเร่งด่วน ${PRIORITY_LABEL[t.priority]}` : ''} ซึ่งต่างจากที่ระบบแนะนำ ตรวจสอบก่อนบันทึกการคัดกรอง
          </p>
        )}
        {needsWorkOrder && <p className="small">เป็นงานซ่อม: ส่งต่อฝ่ายซ่อมบำรุงแล้วผูกเลขใบงานด้านล่าง</p>}
      </Notice>
    </div>
  );
}

function AgentActions({ ticket, onChanged }: { ticket: Detail; onChanged: () => void }) {
  const { user, users } = useIdentity();
  const { data: categories } = useAsync(() => api.categories(), []);
  const agents = users.filter((u: User) => u.role !== 'customer');
  const closed = ticket.status === 'resolved' || ticket.status === 'closed';

  const [agentId, setAgentId] = useState<number>(ticket.assigned_agent_id ?? user?.id ?? 0);
  const [priority, setPriority] = useState<Priority>(ticket.priority);
  const [categoryId, setCategoryId] = useState<number>(ticket.category_id);
  const [workOrder, setWorkOrder] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text?: string; error?: unknown } | null>(null);

  const run = async (name: string, action: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setResult(null);
    try {
      await action();
      setResult({ ok: true, text: done });
      onChanged();
    } catch (err) {
      setResult({ ok: false, error: err });
    } finally {
      setBusy(null);
    }
  };

  if (closed) {
    return (
      <Panel title="การดำเนินการของเจ้าหน้าที่" quiet>
        <p className="muted">คำร้องนี้ปิดแล้ว ไม่มีการดำเนินการเพิ่มเติม</p>
      </Panel>
    );
  }

  return (
    <Panel title="การดำเนินการของเจ้าหน้าที่">
      <div aria-live="polite">
        {result?.ok && <Notice tone="ok" title={result.text} />}
        {result && !result.ok && <ErrorNotice error={result.error} />}
      </div>

      <div className="actions-grid" style={{ marginTop: result ? 16 : 0 }}>
        <div className="action">
          <h3>มอบหมายงาน</h3>
          <div className="inline">
            <label className="visually-hidden" htmlFor="assign-agent">ผู้รับผิดชอบ</label>
            <select id="assign-agent" className="select" value={agentId} onChange={(e) => setAgentId(Number(e.target.value))}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}{a.id === user?.id ? ' (ฉัน)' : ''}
                </option>
              ))}
            </select>
            <button className="btn" disabled={!!busy} onClick={() => run('assign', () => api.assign(ticket.id, agentId), 'มอบหมายงานแล้ว')}>
              มอบหมาย
            </button>
          </div>
        </div>

        <div className="action">
          <h3>คัดกรอง</h3>
          <div className="inline">
            <label className="visually-hidden" htmlFor="triage-priority">ความเร่งด่วน</label>
            <select id="triage-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>ความเร่งด่วน: {PRIORITY_LABEL[p]}</option>
              ))}
            </select>
            <label className="visually-hidden" htmlFor="triage-category">หมวดหมู่</label>
            <select id="triage-category" className="select" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories?.map((c: Category) => (
                <option key={c.id} value={c.id}>หมวด: {c.name}</option>
              ))}
            </select>
          </div>
          <div className="inline">
            <button
              className="btn btn--secondary"
              disabled={!!busy || (priority === ticket.priority && categoryId === ticket.category_id)}
              onClick={() => run('triage', () => api.updateTicket(ticket.id, { priority, category_id: categoryId }), 'บันทึกการคัดกรองแล้ว')}
            >
              บันทึกการคัดกรอง
            </button>
            {ticket.status !== 'in_progress' && (
              <button
                className="btn btn--secondary"
                disabled={!!busy}
                onClick={() => run('progress', () => api.updateTicket(ticket.id, { status: 'in_progress' }), 'เริ่มดำเนินการแล้ว')}
              >
                เริ่มดำเนินการ
              </button>
            )}
          </div>
        </div>

        <div className="action">
          <h3>ส่งต่อฝ่ายซ่อมบำรุง</h3>
          {ticket.maintenance_work_order_id ? (
            <p className="muted">ผูกกับใบงาน {ticket.maintenance_work_order_id} แล้ว</p>
          ) : (
            <>
              <p className="muted small">ใส่เลขใบงานจากระบบซ่อมบำรุง (Team 10) สถานะงานซ่อมจะแสดงบนคำร้องนี้อัตโนมัติ</p>
              <div className="inline">
                <label className="visually-hidden" htmlFor="work-order">เลขใบงาน</label>
                <input id="work-order" className="input" placeholder="เช่น WO-0045" value={workOrder} onChange={(e) => setWorkOrder(e.target.value)} />
                <button
                  className="btn btn--secondary"
                  disabled={!!busy || !workOrder.trim()}
                  onClick={() => run('link', () => api.linkWorkOrder(ticket.id, workOrder.trim()), 'ผูกใบงานแล้ว')}
                >
                  ผูกใบงาน
                </button>
              </div>
            </>
          )}
        </div>

        <div className="action">
          <h3>ปิดงาน</h3>
          <Field id="resolution-note" label="สรุปการแก้ไข" hint="ผู้แจ้งจะเห็นข้อความนี้">
            <textarea id="resolution-note" className="textarea" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div>
            <button className="btn" disabled={!!busy} onClick={() => run('resolve', () => api.resolve(ticket.id, note), 'ปิดงานแล้ว')}>
              ปิดงานเป็นแก้ไขแล้ว
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
