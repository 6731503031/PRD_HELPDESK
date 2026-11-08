/**
 * "ข้อมูลของฉัน" — a guest requester changes the display name / contact email.
 * Self-declared, never verified (Identity stub, PRD §20).
 */
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { isGuest, useIdentity } from '../auth/identity';
import { ErrorNotice, Field, Notice, Panel } from '../components/ui';

export function Profile() {
  const { user, updateProfile } = useIdentity();
  const guest = isGuest(user);
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    setFields({});
    try {
      await updateProfile(name.trim(), email.trim());
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      else setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page__head">
        <h1>ข้อมูลของฉัน</h1>
        <p>ชื่อนี้ผู้ดูแลจะเห็นในคำร้องและในแชท</p>
      </div>
      <Panel>
        {!guest ? (
          <Notice tone="info" title="บัญชีทดสอบ">
            <p className="small">บัญชีนี้เป็นบัญชีตัวอย่างของระบบ แก้ข้อมูลไม่ได้</p>
          </Notice>
        ) : (
          <form className="form form--narrow" onSubmit={save} noValidate>
            <Field id="profile-name" label="ชื่อที่แสดง" required error={fields.name}>
              <input id="profile-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!!fields.name} />
            </Field>
            <Field id="profile-email" label="อีเมลติดต่อ" hint="ไม่บังคับ ใช้เป็นข้อมูลติดต่อเท่านั้น ระบบไม่ได้ใช้เข้าสู่ระบบและไม่ได้ยืนยัน" error={fields.email}>
              <input id="profile-email" className="input" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fields.email} />
            </Field>
            {error ? <ErrorNotice error={error} /> : null}
            {saved && <Notice tone="ok" title="บันทึกแล้ว" />}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving || name.trim().length < 2}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
