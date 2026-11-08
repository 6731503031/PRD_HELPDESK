/**
 * Ticket detail — shared by My Tickets (requester) and the admin dashboard.
 * Follows the Use Case doc v1.1 (no chat):
 *   Requester: UC-04 follow status + repair progress · UC-05 edit while still open
 *   Admin:     ① UC-07 triage → ② UC-08 send to Team 10 → ③ UC-09 resolve
 */
import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Category, Priority, TicketDetail as Detail } from '../api/types';
import { isStaff, useIdentity } from '../auth/identity';
import { PRIORITY_LABEL, ROUTE_LABEL, formatDateTime, isRepairDone, maintenanceLabel, statusLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Avatar } from './Icon';
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
          <p className="muted small">คำร้องเลขที่ <strong>{t.ticket_number}</strong></p>
          <h1>{t.title}</h1>
        </div>
        <div className="pagebar__actions">
          <PriorityText priority={t.priority} />
          <StatusBadge status={t.status} />
        </div>
      </div>

      <div className="layout-ticket">
        {/* Main: where the ticket is, what the problem is, repair progress, outcome */}
        <div>
          <Panel>
            <StatusTrack status={t.status} />

            {!staff && t.status === 'open' ? (
              <RequesterEdit ticket={t} onSaved={changed} />
            ) : (
              <>
                <h3 className="mt-5">รายละเอียดปัญหา</h3>
                <p className="description mt-2">{t.description}</p>
              </>
            )}

            {staff && !closed && <SystemSuggestion ticket={t} />}

            {t.maintenance_work_order_id && (
              <div className="mt-5">
                <Notice
                  tone={isRepairDone(t.maintenance_status) ? 'ok' : 'info'}
                  title={`ส่งต่อฝ่ายซ่อมบำรุงแล้ว ใบงาน ${t.maintenance_work_order_id}`}
                >
                  <p>
                    สถานะงานซ่อม: <strong>{maintenanceLabel(t.maintenance_status)}</strong>
                    {t.maintenance_status_at && <span className="muted"> (อัปเดต {formatDateTime(t.maintenance_status_at)})</span>}
                  </p>
                </Notice>
              </div>
            )}

            {closed && (
              <div className="mt-5">
                <Notice tone="ok" title={`แก้ไขแล้วเมื่อ ${formatDateTime(t.resolved_at)}`}>
                  {t.resolution_note && <p>{t.resolution_note}</p>}
                </Notice>
              </div>
            )}
          </Panel>

          {!staff && !closed && (
            <Panel title="ขั้นต่อไป" quiet>
              <p className="small">{nextStepForRequester(t)}</p>
            </Panel>
          )}
        </div>

        {/* Side: properties, admin steps, history */}
        <div>
          <Panel title="ข้อมูลคำร้อง">
            <dl className="meta">
              <dt>หมวดหมู่</dt>
              <dd><span className="chip">{t.category_name ?? '–'}</span></dd>
              <dt>ความเร่งด่วน</dt>
              <dd><PriorityText priority={t.priority} /></dd>
              <dt>ผู้แจ้ง</dt>
              <dd className="person"><Avatar name={t.customer_name} size={22} /> {t.customer_name ?? `#${t.customer_id}`}</dd>
              <dt>แจ้งเมื่อ</dt>
              <dd>{formatDateTime(t.created_at)}</dd>
              <dt>อัปเดตล่าสุด</dt>
              <dd>{formatDateTime(t.updated_at)}</dd>
            </dl>
          </Panel>

          {staff && <AdminActions ticket={t} onChanged={changed} />}

          <Panel title="ประวัติสถานะ">
            {t.history.length === 0 ? (
              <p className="muted">ยังไม่มีการเปลี่ยนสถานะ</p>
            ) : (
              <ol className="history">
                {t.history.map((h, i) => (
                  <li key={i}>
                    <strong>{statusLabel(h.to_status)}</strong>
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

/** What the requester can expect next — there is no chat, so the page says it plainly. */
function nextStepForRequester(t: Detail): string {
  if (t.maintenance_work_order_id) {
    return isRepairDone(t.maintenance_status)
      ? 'ช่างซ่อมเสร็จแล้ว ผู้ดูแลจะตรวจผลและปิดคำร้อง คุณจะเห็นสรุปการแก้ไขในหน้านี้'
      : 'ผู้ดูแลส่งเรื่องให้ฝ่ายซ่อมบำรุงแล้ว สถานะงานซ่อมจะอัปเดตในหน้านี้อัตโนมัติ';
  }
  if (t.status === 'open') return 'ผู้ดูแลจะคัดกรองคำร้องนี้ ระหว่างนี้คุณยังแก้หัวเรื่องและรายละเอียดได้';
  return 'ผู้ดูแลกำลังดำเนินการ เมื่อแก้ไขเสร็จ คุณจะเห็นสรุปการแก้ไขในหน้านี้';
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
          <h3>รายละเอียดปัญหา</h3>
          <button className="btn btn--secondary btn--small" onClick={() => setEditing(true)}>แก้ไขคำร้อง</button>
        </div>
        <p className="description mt-2">{ticket.description}</p>
      </>
    );
  }

  return (
    <form className="form mt-5" onSubmit={save}>
      <h3>แก้ไขคำร้อง</h3>
      <p className="muted small">แก้ได้จนกว่าผู้ดูแลจะเริ่มดำเนินการ หมวดหมู่และความเร่งด่วนผู้ดูแลเป็นคนปรับ</p>
      <Field id="edit-title" label="หัวเรื่อง" required>
        <input id="edit-title" className="input" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="edit-description" label="รายละเอียด" required>
        <textarea id="edit-description" className="textarea" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {error ? <ErrorNotice error={error} /> : null}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={saving || unchanged || tooShort}>
          {saving ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
        </button>
        <button className="btn btn--plain" type="button" onClick={cancel} disabled={saving}>ยกเลิก</button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------
   Admin — PRD §8.1 / FR-10: what the system suggested, advisory only (F31, P4)
   --------------------------------------------------------------------------- */
function SystemSuggestion({ ticket: t }: { ticket: Detail }) {
  if (!t.ai_source || !t.ai_route) {
    return <p className="muted small mt-5">ยังไม่มีคำแนะนำจากระบบสำหรับคำร้องนี้</p>;
  }
  const categoryDiffers = t.ai_category_id != null && t.ai_category_id !== t.category_id;
  const priorityDiffers = t.ai_priority != null && t.ai_priority !== t.priority;
  const needsWorkOrder = t.ai_route === 'maintenance' && !t.maintenance_work_order_id;

  return (
    <div className="mt-5">
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
        {needsWorkOrder && <p className="small">เป็นงานซ่อม: ทำขั้น ② ส่งต่อฝ่ายซ่อมบำรุง</p>}
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
  const closed = ticket.status === 'resolved' || ticket.status === 'closed';
  const linked = !!ticket.maintenance_work_order_id;
  const repairDone = isRepairDone(ticket.maintenance_status);

  const [priority, setPriority] = useState<Priority>(ticket.priority);
  const [categoryId, setCategoryId] = useState<number>(ticket.category_id);
  const [workOrder, setWorkOrder] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text?: string; error?: unknown } | null>(null);

  const run = async (name: string, action: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setResult(null);
    try {
      await action();
      setResult({ ok: true, text: done });
      setConfirming(false);
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

  if (closed) {
    return (
      <Panel title="การดำเนินการ" quiet>
        <p className="muted">คำร้องนี้ปิดแล้ว ไม่มีการดำเนินการเพิ่มเติม</p>
      </Panel>
    );
  }

  const triaged = priority === ticket.priority && categoryId === ticket.category_id;
  const noteReady = note.trim().length >= 5;

  return (
    <Panel title="การดำเนินการ">
      <div aria-live="polite">
        {result?.ok && <Notice tone="ok" title={result.text} />}
        {result && !result.ok && <ErrorNotice error={result.error} />}
      </div>

      <ol className={`actions-grid${result ? ' mt-4' : ''}`}>
        {/* ① Triage */}
        <li className="action">
          <h3 className="step-title"><span className="step-num" aria-hidden="true">1</span>คัดกรอง</h3>
          {categoriesError ? <ErrorNotice error={categoriesError} /> : null}
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
              disabled={!!busy || triaged}
              onClick={() => run('triage', () => api.updateTicket(ticket.id, { priority, category_id: categoryId }), 'บันทึกการคัดกรองแล้ว')}
            >
              บันทึกการคัดกรอง
            </button>
            {ticket.status === 'open' && (
              <button
                className="btn"
                disabled={!!busy}
                onClick={() => run('progress', () => api.updateTicket(ticket.id, { status: 'in_progress' }), 'เริ่มดำเนินการแล้ว ผู้แจ้งจะแก้คำร้องไม่ได้อีก')}
              >
                เริ่มดำเนินการ
              </button>
            )}
          </div>
        </li>

        {/* ② Send to Team 10 — only for repairs */}
        <li className="action">
          <h3 className="step-title">
            <span className="step-num" aria-hidden="true">2</span>ส่งต่อฝ่ายซ่อมบำรุง
            <span className="muted small"> (เฉพาะงานซ่อม)</span>
          </h3>
          {linked ? (
            <p className="small">
              ผูกกับใบงาน <strong>{ticket.maintenance_work_order_id}</strong> แล้ว
              <br />
              <span className="muted">สถานะล่าสุด: {maintenanceLabel(ticket.maintenance_status)}</span>
            </p>
          ) : (
            <ol className="substeps small">
              <li>
                แจ้งซ่อมในระบบของ Team 10 และใส่เลขอ้างอิง
                <span className="copy-ref">
                  <code>{ticket.ticket_number}</code>
                  <button type="button" className="btn btn--plain btn--small" onClick={copyRef}>
                    {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </span>
              </li>
              <li>
                ใส่เลขใบงานที่ Team 10 ออกให้ ระบบจะตรวจว่ามีใบงานนี้จริงก่อนบันทึก
                <div className="inline mt-2">
                  <label className="visually-hidden" htmlFor="work-order">เลขใบงาน</label>
                  <input id="work-order" className="input" placeholder="เช่น WO-0045" value={workOrder} onChange={(e) => setWorkOrder(e.target.value)} />
                  <button
                    className="btn btn--secondary"
                    disabled={!!busy || !workOrder.trim()}
                    onClick={() =>
                      run('link', () => api.linkWorkOrder(ticket.id, workOrder.trim()), 'ผูกใบงานแล้ว สถานะงานซ่อมจะอัปเดตอัตโนมัติ')
                    }
                  >
                    {busy === 'link' ? 'กำลังตรวจ…' : 'ผูกใบงาน'}
                  </button>
                </div>
              </li>
            </ol>
          )}
        </li>

        {/* ③ Resolve — summary required, then confirm */}
        <li className="action">
          <h3 className="step-title"><span className="step-num" aria-hidden="true">3</span>ปิดงาน</h3>
          {linked && (repairDone ? (
            <Notice tone="ok" title="ซ่อมเสร็จแล้ว พร้อมปิดงาน" />
          ) : (
            <Notice tone="warn" title="งานซ่อมยังไม่เสร็จ">
              <p className="small">ปิดงานได้ แต่ควรรอให้ Team 10 แจ้งว่าซ่อมเสร็จก่อน</p>
            </Notice>
          ))}
          <Field id="resolution-note" label="สรุปการแก้ไข" required hint="ผู้แจ้งจะเห็นข้อความนี้ อย่างน้อย 5 ตัวอักษร">
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
                ปิดงานเป็นแก้ไขแล้ว
              </button>
            </div>
          ) : (
            <div className="confirm" role="group" aria-label="ยืนยันการปิดงาน">
              <p className="small">ปิดคำร้อง <strong>{ticket.ticket_number}</strong>? ผู้แจ้งจะเห็นสรุปนี้ และคำร้องจะเปลี่ยนเป็น "แก้ไขแล้ว"</p>
              <div className="inline">
                <button className="btn" disabled={!!busy} onClick={() => run('resolve', () => api.resolve(ticket.id, note.trim()), 'ปิดงานแล้ว')}>
                  {busy === 'resolve' ? 'กำลังปิดงาน…' : 'ยืนยันปิดงาน'}
                </button>
                <button className="btn btn--plain" disabled={!!busy} onClick={() => setConfirming(false)}>ยกเลิก</button>
              </div>
            </div>
          )}
        </li>
      </ol>
    </Panel>
  );
}
