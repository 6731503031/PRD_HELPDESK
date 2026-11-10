/**
 * PDPA privacy notice + the "I agree" tick box. Text: lib/privacy.ts.
 * Thai is the default (PDPA is Thai law and most requesters read Thai); English is one click away.
 */
import { useState } from 'react';
import { PRIVACY_NOTICE, type PrivacyLang } from '../lib/privacy';

const LANG_KEY = 'helpdesk.privacyLang';

/** Remembered in this browser; works without storage too (private mode). */
export function usePrivacyLang(): [PrivacyLang, (l: PrivacyLang) => void] {
  const [lang, setLang] = useState<PrivacyLang>(() => {
    try {
      return window.localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'th';
    } catch {
      return 'th';
    }
  });
  const set = (l: PrivacyLang) => {
    setLang(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* private mode — fine */
    }
  };
  return [lang, set];
}

export function PrivacyNotice({
  lang,
  onLang,
  scroll = false,
  headingLevel = 2,
}: {
  lang: PrivacyLang;
  onLang: (l: PrivacyLang) => void;
  /** true = fixed-height box that scrolls (inside a form) */
  scroll?: boolean;
  headingLevel?: 2 | 3;
}) {
  const t = PRIVACY_NOTICE[lang];
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const S = headingLevel === 2 ? 'h3' : 'h4';
  return (
    <div className="privacy" lang={lang}>
      <div className="privacy__head">
        <div>
          <H className="privacy__title">{t.title}</H>
          <p className="muted small">{t.updated}</p>
        </div>
        <div className="privacy__lang" role="group" aria-label="Language / ภาษา">
          <button type="button" className={`chip-btn${lang === 'th' ? ' is-on' : ''}`} aria-pressed={lang === 'th'} onClick={() => onLang('th')}>
            ไทย
          </button>
          <button type="button" className={`chip-btn${lang === 'en' ? ' is-on' : ''}`} aria-pressed={lang === 'en'} onClick={() => onLang('en')}>
            English
          </button>
        </div>
      </div>

      <div className="privacy__summary">
        <p><strong>{t.summaryTitle}</strong></p>
        <ul>
          {t.summary.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>

      <div className={`privacy__body${scroll ? ' privacy__body--scroll' : ''}`} tabIndex={scroll ? 0 : undefined} aria-label={scroll ? t.title : undefined}>
        {t.sections.map((sec) => (
          <section key={sec.id} className="privacy__section">
            <S>{sec.title}</S>
            {sec.blocks.map((b, i) =>
              Array.isArray(b) ? (
                <ul key={i}>{b.map((li) => <li key={li}>{li}</li>)}</ul>
              ) : (
                <p key={i}>{b}</p>
              ),
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/** The consent tick box. Separate from the notice text and never ticked in advance (PDPA s.19). */
export function ConsentCheck({
  id,
  lang,
  checked,
  onChange,
  error,
}: {
  id: string;
  lang: PrivacyLang;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div className="field">
      <label className="check consent-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        <span lang={lang}>{PRIVACY_NOTICE[lang].consent}</span>
      </label>
      {error && <span className="error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
