/**
 * "ข้อมูลของฉัน" — a guest requester changes the display name / contact email.
 * Self-declared, never verified (Identity stub, PRD §20).
 * PDPA: shows which privacy notice the person accepted and lets them withdraw (as easy as giving it, s.19).
 */
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { isGuest, useIdentity } from '../auth/identity';
import { ErrorNotice, Field, Notice, Panel } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { PRIVACY_CONTACT } from '../lib/privacy';

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
        <h1>My profile</h1>
        <p>The Helpdesk team sees this name on your tickets and in the chat.</p>
      </div>
      <Panel>
        {!guest ? (
          <Notice tone="info" title="Demo account">
            <p className="small">This is a built-in demo account and cannot be edited.</p>
          </Notice>
        ) : (
          <form className="form form--narrow" onSubmit={save} noValidate>
            <Field id="profile-name" label="Display name" required error={fields.name}>
              <input id="profile-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!!fields.name} />
            </Field>
            <Field id="profile-email" label="Contact email" hint="Optional. Used for contact only; it is not used to sign in and is not verified." error={fields.email}>
              <input id="profile-email" className="input" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fields.email} />
            </Field>
            {error ? <ErrorNotice error={error} /> : null}
            {saved && <Notice tone="ok" title="Saved" />}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving || name.trim().length < 2}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        )}
      </Panel>
      <PrivacyConsentPanel />
    </div>
  );
}

function PrivacyConsentPanel() {
  const { consent, withdrawConsent } = useIdentity();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const withdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await withdrawConsent(); // signs out on success
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <Panel title="Privacy and consent (PDPA)">
      <div className="form form--narrow">
        {consent?.accepted && (
          <p>
            You accepted privacy notice version <strong>{consent.notice_version}</strong> on {formatDateTime(consent.accepted_at)}.{' '}
            <a href="#/privacy">Read the notice</a>
          </p>
        )}
        <p className="muted small">
          You can see, correct or delete your data, or ask us to stop using it, by writing to <strong>{PRIVACY_CONTACT}</strong>. We reply within 30 days.
        </p>
        {error ? <ErrorNotice error={error} /> : null}
        {!confirming ? (
          <div className="form-actions">
            <button className="btn btn--secondary" onClick={() => setConfirming(true)}>Withdraw consent</button>
          </div>
        ) : (
          <div className="confirm" role="group" aria-labelledby="withdraw-title">
            <p id="withdraw-title"><strong>Withdraw your consent?</strong></p>
            <p className="small">
              You will be signed out and cannot report issues until you accept the notice again. Your earlier tickets are kept;
              to have them deleted, write to {PRIVACY_CONTACT}.
            </p>
            <div className="form-actions">
              <button className="btn btn--danger" onClick={() => void withdraw()} disabled={busy}>{busy ? 'Withdrawing…' : 'Withdraw and sign out'}</button>
              <button className="btn btn--plain" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
