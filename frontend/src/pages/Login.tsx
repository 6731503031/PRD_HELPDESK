/**
 * Sign-in (PRD FR-01). Helpdesk never handles credentials and verifies nothing (Identity stub, PRD §20).
 *   Requester: one button. First time only, a short form asks for a display name (+ optional contact email).
 *   Admin:     the separate link /#/staff, one click. It is not shown on the requester page.
 */
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useIdentity } from '../auth/identity';
import { Logo } from '../components/Logo';
import { ErrorNotice, Field, Notice } from '../components/ui';
import { usePath } from '../lib/router';

export function Login() {
  const staffMode = usePath() === '/staff';
  const { savedGuest, signInGuest, continueAsSavedGuest, signInStaff } = useIdentity();
  const [step, setStep] = useState<'start' | 'form'>('start');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      if (savedGuest && (await continueAsSavedGuest())) return;
      setStep('form'); // first visit, or the saved profile is gone: ask for a name
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => signInGuest(name.trim(), email.trim()));
  };

  return (
    <div className="login">
      <section className="login__intro" aria-labelledby="login-title">
        <Logo size={72} />
        <p className="login__platform">University Digital Campus</p>
        <h1 id="login-title">Helpdesk</h1>
        <p className="login__lead">แจ้งปัญหาการใช้งาน อุปกรณ์ อาคาร และบัญชีผู้ใช้ ได้ในที่เดียว และติดตามได้ว่าคำร้องอยู่ขั้นไหน</p>
        <ul className="login__points">
          <li>ได้เลขคำร้องทันทีหลังแจ้ง</li>
          <li>เห็นสถานะ และคุยกับผู้ดูแลได้ในคำร้องเดียวกัน</li>
          <li>งานซ่อมถูกส่งต่อฝ่ายซ่อมบำรุงและแสดงความคืบหน้าให้</li>
        </ul>
      </section>

      <section className="login__box panel" aria-labelledby="signin-title">
        <div className="panel__body">
          {staffMode ? (
            <>
              <h2 id="signin-title">สำหรับผู้ดูแลระบบ</h2>
              <p className="muted mt-2">เข้าเพื่อดูแลคำร้อง ส่งต่อฝ่ายซ่อมบำรุง และตอบแชทผู้แจ้ง</p>
              {error ? <div className="mt-4"><ErrorNotice error={error} /></div> : null}
              <button className="btn btn--block mt-5" onClick={() => void run(signInStaff)} disabled={busy}>
                {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบผู้ดูแล'}
              </button>
              <a className="btn btn--plain mt-4" href="#/">กลับหน้าผู้แจ้ง</a>
            </>
          ) : step === 'start' ? (
            <>
              <h2 id="signin-title">เข้าสู่ระบบ</h2>
              {savedGuest ? (
                <p className="muted mt-2">ยินดีต้อนรับกลับ <strong>{savedGuest.full_name}</strong></p>
              ) : (
                <p className="muted mt-2">ไม่ต้องใช้รหัสผ่าน กดเข้าสู่ระบบแล้วบอกชื่อของคุณ</p>
              )}
              {error ? <div className="mt-4"><ErrorNotice error={error} /></div> : null}
              <button className="btn btn--block mt-5" onClick={() => void start()} disabled={busy}>
                {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
              {savedGuest && (
                <button className="btn btn--plain mt-4" onClick={() => setStep('form')} disabled={busy}>ไม่ใช่คุณ? ใช้ชื่ออื่น</button>
              )}
              <p className="muted small mt-4">
                ข้อมูลที่คุณบอกเก็บไว้ในเบราว์เซอร์นี้ หากล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง จะเข้าคำร้องเดิมไม่ได้
              </p>
            </>
          ) : (
            <form className="form" onSubmit={submit} noValidate>
              <div>
                <h2 id="signin-title">บอกชื่อของคุณ</h2>
                <p className="muted small mt-2">ผู้ดูแลจะเห็นชื่อนี้ในคำร้องและในแชท</p>
              </div>
              <Field id="guest-name" label="ชื่อที่แสดง" required error={fields.name}>
                <input id="guest-name" className="input" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} aria-invalid={!!fields.name} />
              </Field>
              <Field id="guest-email" label="อีเมลติดต่อ" hint="ไม่บังคับ ใช้เป็นข้อมูลติดต่อเท่านั้น ไม่ได้ยืนยัน" error={fields.email}>
                <input id="guest-email" className="input" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fields.email} />
              </Field>
              {error ? <ErrorNotice error={error} /> : null}
              <Notice tone="warn" title="โหมดทดสอบ">
                <p className="small">ระบบนี้ไม่ได้ยืนยันตัวตน (Identity stub ตาม PRD §20)</p>
              </Notice>
              <div className="form-actions">
                <button className="btn" type="submit" disabled={busy || name.trim().length < 2}>{busy ? 'กำลังเข้า…' : 'เริ่มใช้งาน'}</button>
                <button className="btn btn--plain" type="button" onClick={() => setStep('start')} disabled={busy}>ย้อนกลับ</button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
