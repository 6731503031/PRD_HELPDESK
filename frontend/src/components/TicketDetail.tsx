/**
 * Ticket detail — shared by My Tickets (requester) and Agent Queue (staff).
 * PRD FR-06 (detail, status, history, comments, resolution), §6 maintenance status.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NotReadyError, api } from '../api/client';
import type { Category, Comment, Priority, TicketDetail as Detail, User, Visibility } from '../api/types';
import { isStaff, useIdentity } from '../auth/identity';
import { PRIORITY_LABEL, ROUTE_LABEL, STATUS_LABEL, formatDateTime } from '../lib/format';
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
  const changed = () => {
    void reload();
    onChanged?.();
  };

  return (
    <>
      <div className="pagebar">
        <div>
          <p className="muted small">คำร้องเลขที่ <strong>{t.ticket_number}</strong></p>
          <h1>{t.title}</h1>
        </div>
        <div className="pagebar__actions">
          <PriorityText priority={t.priority} />
          <StatusBadge status={t.status} />
        </div>
      </div>

      <div className="layout-ticket">
        {/* Main: progress, problem, system hints, conversation */}
        <div>
          <Panel>
            <StatusTrack status={t.status} />
            <h3 style={{ marginTop: 24 }}>รายละเอียดปัญหา</h3>
            <p className="description" style={{ marginTop: 8 }}>{t.description}</p>

            {staff && <SystemSuggestion ticket={t} />}

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

          <Chat ticketId={t.id} />
        </div>

        {/* Side: properties, staff actions, history */}
        <div>
          <Panel title="ข้อมูลคำร้อง">
            <dl className="meta">
              <dt>หมวดหมู่</dt>
              <dd><span className="chip">{t.category_name ?? '–'}</span></dd>
              <dt>ความเร่งด่วน</dt>
              <dd><PriorityText priority={t.priority} /></dd>
              <dt>ผู้แจ้ง</dt>
              <dd className="person"><Avatar name={t.customer_name} size={22} /> {t.customer_name ?? `#${t.customer_id}`}</dd>
              <dt>ผู้รับผิดชอบ</dt>
              <dd className="person">
                {t.agent_name ? <><Avatar name={t.agent_name} size={22} /> {t.agent_name}</> : <span className="muted">ยังไม่มีผู้รับเรื่อง</span>}
              </dd>
              <dt>แจ้งเมื่อ</dt>
              <dd>{formatDateTime(t.created_at)}</dd>
              <dt>อัปเดตล่าสุด</dt>
              <dd>{formatDateTime(t.updated_at)}</dd>
            </dl>
          </Panel>

          {staff && <AgentActions ticket={t} onChanged={changed} />}

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
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Chat (P2 backend) — FR-11 public messages, FR-12 internal notes (staff only).
   Required by the PRD, so it stays; shown as a chat window instead of a form.
   --------------------------------------------------------------------------- */
function Chat({ ticketId }: { ticketId: number }) {
  const { user } = useIdentity();
  const staff = isStaff(user);
  const { data, error, loading, refresh, setData } = useAsync(() => api.comments(ticketId), [ticketId, user?.id]);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const notReady = error instanceof NotReadyError;

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [data?.length]);

  // Quiet polling while the tab is visible, so replies show up without a page reload.
  // TODO(P2): swap for push (WebSocket / Durable Object) if you have time — not required by the PRD.
  useEffect(() => {
    if (notReady || error) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [notReady, error, refresh]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const added = await api.addComment(ticketId, text.trim(), (internal ? 'internal' : 'public') as Visibility);
      setText('');
      setData((prev) => [...(prev ?? []), added]); // show it at once, then poll keeps it in sync
    } catch (err) {
      setSendError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel flush title={staff ? 'แชทกับผู้แจ้ง' : 'แชทกับเจ้าหน้าที่'} action={<Icon name="chat" />}>
      <div className="chat">
        <div className="chat__log" ref={logRef} aria-live="polite">
          {loading && !data ? (
            <Loading variant="text" label="กำลังโหลดข้อความ…" />
          ) : notReady ? (
            <p className="chat__empty">แชทยังไม่เปิดใช้งาน กำลังพัฒนาโดย P2</p>
          ) : error ? (
            <ErrorNotice error={error} />
          ) : !data?.length ? (
            <p className="chat__empty">ยังไม่มีข้อความ เริ่มพิมพ์ด้านล่างได้เลย</p>
          ) : (
            data.map((c: Comment) => {
              const mine = c.author_id === user?.id;
              const isInternal = c.visibility === 'internal';
              return (
                <div key={c.id} className={`msg${mine ? ' msg--mine' : ''}${isInternal ? ' msg--internal' : ''}`}>
                  <span className="msg__meta">
                    {mine ? 'คุณ' : c.author_name ?? `#${c.author_id}`}, {formatDateTime(c.created_at)}
                    {isInternal && <span className="msg__tag"> บันทึกภายใน</span>}
                  </span>
                  <div className="msg__bubble">{c.content}</div>
                </div>
              );
            })
          )}
        </div>

        {sendError ? <div className="chat__note"><ErrorNotice error={sendError} /></div> : null}

        <form className="chat__composer" onSubmit={send}>
          <label className="visually-hidden" htmlFor={`chat-${ticketId}`}>พิมพ์ข้อความ</label>
          <textarea
            id={`chat-${ticketId}`}
            className="textarea chat__input"
            rows={1}
            placeholder={notReady ? 'แชทยังไม่เปิดใช้งาน' : 'พิมพ์ข้อความ… (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)'}
            value={text}
            disabled={notReady}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn" type="submit" disabled={notReady || sending || !text.trim()} aria-label="ส่งข้อความ">
            <Icon name="send" size={16} />
          </button>
        </form>
        {staff && !notReady && (
          <div className="chat__options">
            <label>
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              บันทึกภายใน (ผู้แจ้งมองไม่เห็น)
            </label>
          </div>
        )}
      </div>
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
  if (t.status === 'resolved' || t.status === 'closed') return null; // nothing left to triage
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
  // FR-09: tickets go to Helpdesk agents only — admins manage the system, they don't take tickets.
  const agents = users.filter((u: User) => u.role === 'agent');
  const closed = ticket.status === 'resolved' || ticket.status === 'closed';

  const [agentId, setAgentId] = useState<number>(
    ticket.assigned_agent_id ?? (user?.role === 'agent' ? user.id : agents[0]?.id ?? 0),
  );
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
            <button className="btn" disabled={!!busy || !agentId} onClick={() => run('assign', () => api.assign(ticket.id, agentId), 'มอบหมายงานแล้ว')}>
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
