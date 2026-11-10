/**
 * Sign-in (PRD FR-01). Helpdesk never handles credentials and verifies nothing (Identity stub, PRD §20).
 *   Requester: one button. First time only, a short form asks for a display name (+ optional contact email).
 *   Admin:     the separate link /#/staff, one click. It is not shown on the requester page.
 * PDPA: the name form shows the privacy notice, and nothing is sent until "I agree" is ticked
 * (consent before collection). The server refuses a profile without it.
 */
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useIdentity } from '../auth/identity';
import { Logo } from '../components/Logo';
import { ConsentCheck, PrivacyNotice, usePrivacyLang } from '../components/PrivacyNotice';
import { ErrorNotice, Field, Notice } from '../components/ui';
import { usePath } from '../lib/router';

export function Login() {
  const staffMode = usePath() === '/staff';
  const { savedGuest, signInGuest, continueAsSavedGuest, signInStaff } = useIdentity();
  const [step, setStep] = useState<'start' | 'form'>('start');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [lang, setLang] = usePrivacyLang();
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
        <p className="login__lead">Report problems with equipment, buildings and user accounts in one place, and follow each ticket from start to finish.</p>
        <ul className="login__points">
          <li>Get a ticket number as soon as you report</li>
          <li>See the status and chat with the Helpdesk team on the same ticket</li>
          <li>Repairs are passed to Maintenance, and their progress is shown to you</li>
        </ul>
      </section>

      <section className="login__box panel" aria-labelledby="signin-title">
        <div className="panel__body">
          {staffMode ? (
            <>
              <h2 id="signin-title">Administrator sign-in</h2>
              <p className="muted mt-2">Manage tickets, send repairs to Maintenance and reply to requesters.</p>
              {error ? <div className="mt-4"><ErrorNotice error={error} /></div> : null}
              <button className="btn btn--block mt-5" onClick={() => void run(signInStaff)} disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in as administrator'}
              </button>
              <a className="btn btn--plain mt-4" href="#/">Back to requester sign-in</a>
            </>
          ) : step === 'start' ? (
            <>
              <h2 id="signin-title">Sign in</h2>
              {savedGuest ? (
                <p className="muted mt-2">Welcome back, <strong>{savedGuest.full_name}</strong></p>
              ) : (
                <p className="muted mt-2">No password needed. Sign in and tell us your name.</p>
              )}
              {error ? <div className="mt-4"><ErrorNotice error={error} /></div> : null}
              <button className="btn btn--block mt-5" onClick={() => void start()} disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              {savedGuest && (
                <button className="btn btn--plain mt-4" onClick={() => setStep('form')} disabled={busy}>Not you? Use another name</button>
              )}
              <p className="muted small mt-4">
                Your details are kept in this browser. If you clear your browser data or use another device, you will not be able to open your earlier tickets.
              </p>
            </>
          ) : (
            <form className="form" onSubmit={submit} noValidate>
              <div>
                <h2 id="signin-title">Tell us your name</h2>
                <p className="muted small mt-2">The Helpdesk team will see this name on your tickets and in the chat.</p>
              </div>
              <Field id="guest-name" label="Display name" required error={fields.name}>
                <input id="guest-name" className="input" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} aria-invalid={!!fields.name} />
              </Field>
              <Field id="guest-email" label="Contact email" hint="Optional. Used for contact only and not verified." error={fields.email}>
                <input id="guest-email" className="input" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fields.email} />
              </Field>
              <PrivacyNotice lang={lang} onLang={setLang} scroll headingLevel={3} />
              <ConsentCheck id="guest-consent" lang={lang} checked={agreed} onChange={setAgreed} error={fields.privacy} />
              {error ? <ErrorNotice error={error} /> : null}
              <Notice tone="warn" title="Test mode">
                <p className="small">This system does not verify identity (Identity stub, PRD §20).</p>
              </Notice>
              <div className="form-actions">
                <button className="btn" type="submit" disabled={busy || name.trim().length < 2 || !agreed}>{busy ? 'Signing in…' : 'Agree and continue'}</button>
                <button className="btn btn--plain" type="button" onClick={() => setStep('start')} disabled={busy}>Back</button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
