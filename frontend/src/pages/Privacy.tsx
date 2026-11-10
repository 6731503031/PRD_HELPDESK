/**
 * PDPA screens.
 *   ConsentScreen → shown instead of every requester page until the current notice is accepted
 *                   (demo accounts, people who signed in before the notice existed, or after the version changed)
 *   PrivacyPage   → #/privacy, the notice to read again at any time (both roles)
 */
import { useState } from 'react';
import { useIdentity } from '../auth/identity';
import { ConsentCheck, PrivacyNotice, usePrivacyLang } from '../components/PrivacyNotice';
import { ErrorNotice, Notice, Panel } from '../components/ui';
import { formatDateTime } from '../lib/format';

export function ConsentScreen() {
  const { consent, acceptConsent, signOut } = useIdentity();
  const [lang, setLang] = usePrivacyLang();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const changed = consent?.last_action === 'accepted'; // accepted an older version

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptConsent();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page--narrow">
      <div className="page__head">
        <h1>{lang === 'th' ? 'ก่อนใช้งานต่อ' : 'Before you continue'}</h1>
        <p>
          {changed
            ? lang === 'th'
              ? 'ประกาศความเป็นส่วนตัวมีการเปลี่ยนแปลง กรุณาอ่านและยอมรับฉบับใหม่'
              : 'The privacy notice has changed. Please read and accept the new version.'
            : lang === 'th'
              ? 'กรุณาอ่านว่าเราใช้ข้อมูลของคุณอย่างไร แล้วยอมรับเพื่อเริ่มแจ้งปัญหา'
              : 'Please read how we use your data, then accept to start reporting issues.'}
        </p>
      </div>
      <Panel>
        <div className="form">
          <PrivacyNotice lang={lang} onLang={setLang} scroll />
          <ConsentCheck id="consent-gate" lang={lang} checked={agreed} onChange={setAgreed} />
          {error ? <ErrorNotice error={error} /> : null}
          <div className="form-actions">
            <button className="btn" onClick={() => void accept()} disabled={!agreed || busy}>
              {busy ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…') : lang === 'th' ? 'ยอมรับและใช้งานต่อ' : 'Accept and continue'}
            </button>
            <button className="btn btn--plain" onClick={signOut} disabled={busy}>
              {lang === 'th' ? 'ไม่ยอมรับ และออกจากระบบ' : 'Decline and sign out'}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function PrivacyPage() {
  const { user, consent } = useIdentity();
  const [lang, setLang] = usePrivacyLang();
  return (
    <div className="page page--narrow">
      <Panel>
        <PrivacyNotice lang={lang} onLang={setLang} />
      </Panel>
      {user?.role === 'customer' && consent?.accepted && (
        <Panel quiet>
          <Notice tone="ok" title={lang === 'th' ? 'คุณยอมรับประกาศนี้แล้ว' : 'You have accepted this notice'}>
            <p className="small">
              {lang === 'th' ? 'ฉบับ' : 'Version'} {consent.notice_version} · {formatDateTime(consent.accepted_at)} ·{' '}
              <a href="#/profile">{lang === 'th' ? 'ถอนความยินยอมได้ที่หน้า My profile' : 'Withdraw on My profile'}</a>
            </p>
          </Notice>
        </Panel>
      )}
    </div>
  );
}
