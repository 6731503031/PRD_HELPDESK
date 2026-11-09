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
          <p className="muted small">คำร้องเลขที่ <strong>{t.ticket_number}</strong></p>
          <h1>{t.title}</h1>
        </div>
        <div className="pagebar__actions">
          <a className="btn btn--secondary btn--small" href={`#/chat/${t.id}`}>
            <Icon name="chat" size={16} /> แชท
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

          {staff && <AdminActions ticket={t} onChanged={changed} />}

          {!staff && !closed && (
            <Panel title="ขั้นต่อไป" quiet>
              <p className="small">{nextStepForRequester(t)}</p>
            </Panel>
          )}
        </div>

        {/* Side: properties and history */}
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

/** What the requester can expect next. Questions go through the chat button. */
function nextStepForRequester(t: Detail): string {
  if (t.maintenance_work_order_id) {
    return isRepairDone(t.maintenance_status)
      ? 'ช่างซ่อมเสร็จแล้ว ผู้ดูแลจะตรวจผลกับคุณ (ทางแชท) แล้วปิดคำร้อง คุณจะเห็นสรุปการแก้ไขในหน้านี้'
      : 'ผู้ดูแลส่งเรื่องให้ฝ่ายซ่อมบำรุงแล้ว สถานะงานซ่อมจะอัปเดตในหน้านี้อัตโนมัติ';
  }
  if (t.status === 'open') return 'ผู้ดูแลจะคัดกรองคำร้องนี้ ระหว่างนี้คุณยังแก้หัวเรื่องและรายละเอียดได้ ถ้ามีข้อสงสัยกดปุ่ม "แชท" เพื่อคุยกับผู้ดูแล';
  return 'ผู้ดูแลกำลังดำเนินการ เมื่อแก้ไขเสร็จ คุณจะเห็นสรุปการแก้ไขในหน้านี้ ถ้ามีข้อสงสัยกดปุ่ม "แชท" ได้';
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
  const woProblem = /^tkt-/i.test(woText) ? 'นี่คือเลขคำร้องของเรา ให้วางเลขใบงานที่ Team 10 ออกให้' : null;
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
      setResult({ ok: true, text: 'เริ่มดำเนินการแล้ว ผู้แจ้งจะแก้คำร้องไม่ได้อีก' });
    } else {
      try {
        await api.sendWorkOrder(ticket.id, { title: repairTitle.trim(), description: repairDescription.trim() });
        setResult({ ok: true, text: 'เริ่มดำเนินการ และส่งให้ Team 10 แล้ว ระบบผูกใบงานกับคำร้องนี้ให้แล้ว' });
      } catch (err) {
        setResult({
          ok: true,
          text: 'เริ่มดำเนินการแล้ว',
          warn: `แต่ส่งให้ Team 10 ไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'} ส่งใหม่ได้ที่ขั้นที่ 2`,
        });
      }
    }
    setBusy(null);
    onChanged();
  };
  const s3: StepState = started ? 'current' : 'todo';

  return (
    <Panel title="การดำเนินการ">
      <p className="small muted">
        {showStep2
          ? 'งานซ่อม (หมวด Facility): ขั้นที่ 1 กด "เริ่มดำเนินการ และส่งให้ Team 10" ขั้นที่ 2 ดูผลการส่ง ขั้นที่ 3 ปิดงานเมื่อซ่อมเสร็จ'
          : 'ไม่ใช่งานซ่อม แอดมินแก้เอง: ขั้นที่ 1 เริ่มดำเนินการ แล้วปิดงานในขั้นที่ 3 (ถ้าเป็นงานซ่อม เปลี่ยนหมวดเป็น Facility)'}
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
          <StepTitle n={1} state={s1} label="คัดกรอง" stateLabel={s1 === 'done' ? 'เริ่มดำเนินการแล้ว' : 'ทำขั้นนี้'} />
          <p className="step-desc">
            ตรวจหมวดหมู่และความเร่งด่วนที่ผู้แจ้งเลือก (ดูคำแนะนำของระบบด้านบน) ปรับให้ถูกต้อง แล้วกด "เริ่มดำเนินการ"
            หลังจากนั้นผู้แจ้งจะแก้คำร้องไม่ได้อีก
          </p>
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
            {ticket.status === 'open' && !sendNow && (
              <button className="btn" disabled={!!busy} onClick={() => void startWork()}>
                {busy === 'progress' ? 'กำลังบันทึก…' : 'เริ่มดำเนินการ'}
              </button>
            )}
          </div>

          {/* Repairs: start + send to Team 10 in one click. Other categories stay with the admin (no Team 10). */}
          {ticket.status === 'open' && !linked && isRepair && (
            <div className={`handoff__box${sendNow ? ' handoff__box--here' : ''}`}>
              <label className="check">
                <input type="checkbox" checked={sendNow} onChange={(e) => setSendWithStart(e.target.checked)} />
                <span>
                  <strong>ส่งต่อฝ่ายซ่อมบำรุง (Team 10) ด้วย</strong>
                  <span className="small muted"> หมวด Facility เป็นงานซ่อม ระบบติ๊กไว้ให้</span>
                </span>
              </label>
              {sendNow && (
                <>
                  <p className="small">
                    เลขอ้างอิง <code>{ticket.ticket_number}</code>
                  </p>
                  <Field id="repair-title" label="หัวเรื่องงานซ่อม" required>
                    <input id="repair-title" className="input" value={repairTitle} maxLength={150} onChange={(e) => setRepairTitle(e.target.value)} />
                  </Field>
                  <Field
                    id="repair-description"
                    label="รายละเอียด"
                    required
                    hint="ระบุสถานที่ให้ช่างหาเจอ (เช่น อาคาร ห้อง) และลบชื่อ อีเมล หรือเบอร์โทรออก Team 10 ได้รับแค่ข้อความนี้กับเลขอ้างอิง"
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
                      {busy === 'progress' ? 'กำลังส่ง…' : 'เริ่มดำเนินการ และส่งให้ Team 10'}
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
            label="ส่งต่อฝ่ายซ่อมบำรุง"
            stateLabel={s2 === 'done' ? 'ผูกใบงานแล้ว' : s2 === 'todo' ? 'ส่งพร้อมเริ่มดำเนินการ' : 'ยังไม่ได้ส่ง'}
          />
          {linked ? (
            <p className="small">
              ผูกกับใบงาน <strong>{ticket.maintenance_work_order_id}</strong> แล้ว
              <br />
              <span className="muted">สถานะล่าสุด: {maintenanceLabel(ticket.maintenance_status)}</span>
            </p>
          ) : s2 === 'todo' ? (
            <p className="step-desc">
              งานซ่อมส่งให้ Team 10 พร้อมกด "เริ่มดำเนินการ" ในขั้นที่ 1 ผลการส่งจะแสดงที่นี่
            </p>
          ) : (
            <>
              {/* Not sent yet (the send at "start" failed, or the admin just marked it as a repair): one button, no big form. */}
              <Notice
                tone="warn"
                title={cancelled ? `ใบงาน ${ticket.maintenance_work_order_id} ถูกยกเลิกโดยฝ่ายซ่อมบำรุง` : 'ยังไม่ได้ส่งให้ Team 10'}
              >
                <p className="small">
                  กดส่ง ระบบจะสร้างใบงานที่ Team 10 และผูกกับคำร้องนี้ให้เอง ถ้า Team 10 ยังรับไม่ได้ ใช้ "ผูกเลขใบงานเอง" ด้านล่าง
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
                      'ส่งให้ Team 10 แล้ว ระบบผูกใบงานกับคำร้องนี้ให้แล้ว',
                    )
                  }
                >
                  {busy === 'send' ? 'กำลังส่ง…' : 'ส่งให้ Team 10'}
                </button>
                <button type="button" className="btn btn--plain btn--small" onClick={() => setEditRepair((v) => !v)}>
                  {editRepair ? 'ซ่อนข้อความ' : 'ดู/แก้ข้อความก่อนส่ง'}
                </button>
              </div>
              {editRepair && (
                <div className="handoff__box">
                  <p className="small">
                    เลขอ้างอิง <code>{ticket.ticket_number}</code>
                  </p>
                  <Field id="repair-title" label="หัวเรื่องงานซ่อม" required>
                    <input id="repair-title" className="input" value={repairTitle} maxLength={150} onChange={(e) => setRepairTitle(e.target.value)} />
                  </Field>
                  <Field
                    id="repair-description"
                    label="รายละเอียด"
                    required
                    hint="ระบุสถานที่ให้ช่างหาเจอ (เช่น อาคาร ห้อง) และลบชื่อ อีเมล หรือเบอร์โทรออก Team 10 ได้รับแค่ข้อความนี้กับเลขอ้างอิง"
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
                <summary className="small">ผูกเลขใบงานเอง (แจ้งในระบบของ Team 10 แล้ว)</summary>
                <div className="fold__body">
                  <p className="small muted">
                    ใช้เมื่อแจ้งซ่อมในระบบของ Team 10 ไปแล้ว (ใส่เลขอ้างอิง
                    <span className="copy-ref">
                      <code>{ticket.ticket_number}</code>
                      <button type="button" className="btn btn--plain btn--small" onClick={copyRef}>
                        {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    </span>
                    ) หรือเมื่อส่งจากที่นี่ไม่ได้
                    {portal && (
                      <>
                        {' '}
                        <a href={portal} target="_blank" rel="noopener noreferrer">
                          เปิดระบบ Team 10 ↗
                        </a>
                      </>
                    )}
                  </p>
                  <Field id="work-order" label="เลขใบงานที่ Team 10 ให้มา" hint="วางเลขใบงาน (UUID) ไม่ใช่เลข TKT- ของเรา ระบบจะตรวจกับ Team 10 ก่อนบันทึก" error={woProblem ?? undefined}>
                    <div className="inline">
                      <input
                        id="work-order"
                        className="input"
                        placeholder="เช่น 7f3c2a9e-1b4d-4c8e-9a21-5d6e7f8a9b01"
                        value={workOrder}
                        aria-invalid={!!woProblem}
                        onChange={(e) => setWorkOrder(e.target.value)}
                      />
                      <button
                        className="btn btn--secondary"
                        disabled={!!busy || !woText || !!woProblem}
                        onClick={() => run('link', () => api.linkWorkOrder(ticket.id, woText), 'ผูกใบงานแล้ว สถานะงานซ่อมจะอัปเดตอัตโนมัติ')}
                      >
                        {busy === 'link' ? 'กำลังตรวจ…' : 'ผูกใบงาน'}
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
          <StepTitle n={3} state={s3} label="ปิดงาน" stateLabel={s3 === 'todo' ? 'ทำหลังเริ่มดำเนินการ' : 'ทำขั้นนี้'} />
          <p className="step-desc">
            เมื่อปัญหาหายแล้ว (ถ้าเป็นงานซ่อม ให้ถามผู้แจ้งทางแชทก่อน) เขียนสรุปให้ผู้แจ้งเห็น แล้วยืนยัน
            คำร้องจะเป็น "แก้ไขแล้ว" ระบบไม่ปิดให้เอง แม้ Team 10 แจ้งว่าซ่อมเสร็จ
          </p>
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
