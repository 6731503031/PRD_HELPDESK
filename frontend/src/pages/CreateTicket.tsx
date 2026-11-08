/**
 * Screen 1 — Create Ticket (PRD FR-03, §8 AI suggestion with human override)
 */
import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import type { Priority, Suggestion, Ticket } from '../api/types';
import { ErrorNotice, Field, Notice, Panel } from '../components/ui';
import { PRIORITY_HINT, PRIORITY_LABEL, ROUTE_LABEL } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export function CreateTicket() {
  const { data: categories } = useAsync(() => api.categories(), []);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [urgency, setUrgency] = useState<Priority | ''>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Ticket | null>(null);

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState<unknown>(null);
  const [suggesting, setSuggesting] = useState(false);

  const askSuggestion = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      setSuggestion(await api.suggest({ subject, description, urgency: urgency || undefined }));
    } catch (err) {
      setSuggestion(null);
      setSuggestError(err);
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setCategoryId(suggestion.category_id);
    setUrgency(suggestion.priority);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      const ticket = await api.createTicket({
        subject,
        description,
        category_id: Number(categoryId),
        urgency: urgency as Priority,
      });
      setCreated(ticket);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setSubject('');
    setDescription('');
    setCategoryId('');
    setUrgency('');
    setSuggestion(null);
  };

  if (created) {
    return (
      <div className="page">
        <div className="page__head">
          <h1>ส่งคำร้องแล้ว</h1>
          <p>เก็บเลขคำร้องไว้เพื่อติดตามหรืออ้างอิงกับผู้ดูแล</p>
        </div>
        <Panel>
          <p className="muted">เลขที่คำร้อง</p>
          <p style={{ fontFamily: 'var(--display)', fontSize: '2.2rem', color: 'var(--brand)', fontWeight: 600 }}>{created.ticket_number}</p>
          <p style={{ marginTop: 8 }}>{created.title}</p>
          <div className="form-actions" style={{ marginTop: 24 }}>
            <a className="btn" href={`#/my/${created.id}`}>ดูสถานะคำร้องนี้</a>
            <button className="btn btn--secondary" onClick={reset}>แจ้งปัญหาเรื่องอื่น</button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1>แจ้งปัญหาใหม่</h1>
        <p>อธิบายปัญหาให้ชัดเจน ผู้ดูแลจะคัดกรองและตอบกลับผ่านแชทในคำร้องนี้</p>
      </div>

      <div className="layout-aside">
        <Panel title="รายละเอียดปัญหา">
          <form className="form" onSubmit={submit} noValidate>
            <Field id="subject" label="หัวเรื่อง" required hint="สั้น ๆ ว่าเกิดอะไร ที่ไหน เช่น แอร์ห้อง B-204 ไม่เย็น" error={fieldErrors.subject}>
              <input
                id="subject"
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                aria-invalid={!!fieldErrors.subject}
                aria-describedby="subject-hint"
                required
              />
            </Field>

            <Field id="description" label="รายละเอียด" required hint="เกิดตั้งแต่เมื่อไร ลองทำอะไรไปแล้ว กระทบการเรียนหรือทำงานอย่างไร" error={fieldErrors.description}>
              <textarea
                id="description"
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                aria-invalid={!!fieldErrors.description}
                aria-describedby="description-hint"
                required
              />
            </Field>

            <Field id="category" label="หมวดหมู่" required error={fieldErrors.category_id}>
              <select
                id="category"
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                aria-invalid={!!fieldErrors.category_id}
                required
              >
                <option value="">เลือกหมวดหมู่</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.description ? ` — ${c.description}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset className="field" aria-invalid={!!fieldErrors.urgency}>
              <legend>
                ความเร่งด่วน<span className="req" aria-hidden="true">*</span>
              </legend>
              <div className="choice-row">
                {PRIORITIES.map((p) => (
                  <label key={p} className="choice" title={PRIORITY_HINT[p]}>
                    <input type="radio" name="urgency" value={p} checked={urgency === p} onChange={() => setUrgency(p)} />
                    {PRIORITY_LABEL[p]}
                  </label>
                ))}
              </div>
              <span className="hint">{urgency ? PRIORITY_HINT[urgency] : 'เลือกตามผลกระทบที่เกิดขึ้นจริง'}</span>
              {fieldErrors.urgency && <span className="error">{fieldErrors.urgency}</span>}
            </fieldset>

            {submitError && !Object.keys(fieldErrors).length ? <ErrorNotice error={submitError} /> : null}
            {Object.keys(fieldErrors).length > 0 && (
              <Notice tone="error" title="กรุณาแก้ไขช่องที่ทำเครื่องหมายไว้" />
            )}

            <div className="form-actions">
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? 'กำลังส่ง…' : 'ส่งคำร้อง'}
              </button>
            </div>
          </form>
        </Panel>

        <div>
          <Panel title="ให้ระบบช่วยจัดหมวด" quiet>
            <p className="small">
              ระบบอ่านหัวเรื่องและรายละเอียด แล้วเสนอหมวดหมู่และความเร่งด่วน คุณแก้ไขได้ทุกช่องก่อนส่ง
            </p>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={askSuggestion}
                disabled={suggesting || subject.trim().length < 5 || description.trim().length < 10}
              >
                {suggesting ? 'กำลังวิเคราะห์…' : 'ขอคำแนะนำ'}
              </button>
            </div>
            {suggestError ? <div style={{ marginTop: 12 }}><ErrorNotice error={suggestError} /></div> : null}
            {suggestion && (
              <div className="suggestion" aria-live="polite">
                <dl className="meta">
                  <dt>หมวดหมู่</dt>
                  <dd>{suggestion.category_name}</dd>
                  <dt>ความเร่งด่วน</dt>
                  <dd>{PRIORITY_LABEL[suggestion.priority]}</dd>
                  <dt>ส่งต่อไปยัง</dt>
                  <dd>{ROUTE_LABEL[suggestion.route] ?? suggestion.route}</dd>
                </dl>
                <p className="muted small" style={{ marginTop: 8 }}>
                  {suggestion.source === 'ai' ? 'แนะนำโดย AI' : 'แนะนำตามกฎของระบบ (AI ไม่พร้อมใช้งาน)'}
                  {suggestion.reason ? `: ${suggestion.reason}` : ''}
                </p>
                <button className="btn btn--plain" type="button" onClick={applySuggestion} style={{ marginTop: 8 }}>
                  ใช้ค่าที่แนะนำ
                </button>
              </div>
            )}
          </Panel>

          <Panel title="หลังจากส่งคำร้อง" quiet>
            <ol className="steps small">
              <li>ระบบออกเลขคำร้องให้ทันที</li>
              <li>ผู้ดูแลคัดกรองและเริ่มดำเนินการ</li>
              <li>คุณติดตามสถานะและตอบข้อความได้ที่ "คำร้องของฉัน"</li>
              <li>ถ้าเป็นงานซ่อม ผู้ดูแลจะส่งต่อฝ่ายซ่อมบำรุง และคุณจะเห็นความคืบหน้าในคำร้องนี้</li>
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
