/** Small shared UI pieces. */
import type { ReactNode } from 'react';
import { ApiError, NotReadyError } from '../api/client';
import type { Priority, TicketStatus } from '../api/types';
import { PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER } from '../lib/format';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityText({ priority }: { priority: Priority }) {
  return <span className={`priority priority--${priority}`}>{PRIORITY_LABEL[priority]}</span>;
}

/** Parcel-style progress line: Open → Assigned → In progress → Resolved → Closed (PRD §14). */
export function StatusTrack({ status }: { status: TicketStatus }) {
  const current = STATUS_ORDER.indexOf(status);
  return (
    <ol className="track" aria-label={`สถานะปัจจุบัน: ${STATUS_LABEL[status]}`}>
      {STATUS_ORDER.map((s, i) => (
        <li
          key={s}
          data-step={i < current ? '✓' : String(i + 1)}
          className={i < current ? 'is-done' : i === current ? 'is-current' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ol>
  );
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'ok' | 'warn' | 'error'; title?: string; children?: ReactNode }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <p><strong>{title}</strong></p>}
      {children}
    </div>
  );
}

/** Shows any API error the right way — 501 becomes a calm "not yet available" note. */
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof NotReadyError) {
    return (
      <Notice tone="warn" title="ส่วนนี้ยังไม่เปิดใช้งาน">
        <p className="small">
          {error.feature} อยู่ระหว่างพัฒนา{error.owner ? ` (ผู้รับผิดชอบ ${error.owner})` : ''}
        </p>
      </Notice>
    );
  }
  const message = error instanceof ApiError || error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
  return (
    <Notice tone="error" title="ทำรายการไม่สำเร็จ">
      <p>{message}</p>
    </Notice>
  );
}

/**
 * Loading placeholder. Skeleton shapes match what is coming, so the screen never looks empty.
 *   text      → a few lines (default)
 *   table     → list rows
 *   dashboard → number cards + list rows
 *   detail    → ticket workspace (main + side column)
 */
export function Loading({ label = 'กำลังโหลด…', variant = 'text' }: { label?: string; variant?: 'text' | 'table' | 'dashboard' | 'detail' }) {
  const lines = (n: number) =>
    Array.from({ length: n }, (_, i) => <span key={i} className="sk sk--line" style={{ width: `${92 - ((i * 17) % 40)}%` }} />);
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} className="sk-row">
        <span className="sk sk--chip" />
        <span className="sk sk--line" style={{ width: `${70 - ((i * 13) % 30)}%` }} />
        <span className="sk sk--chip" />
      </div>
    ));
  return (
    <div className={`skeleton skeleton--${variant}`} role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {variant === 'text' && <div className="sk-stack">{lines(3)}</div>}
      {variant === 'table' && <div className="sk-stack">{rows(6)}</div>}
      {variant === 'dashboard' && (
        <>
          <div className="stats">{Array.from({ length: 5 }, (_, i) => <span key={i} className="sk sk--card" />)}</div>
          <div className="panel"><div className="panel__body sk-stack">{rows(7)}</div></div>
        </>
      )}
      {variant === 'detail' && (
        <>
          <div className="sk-stack" style={{ marginBottom: 24 }}>
            <span className="sk sk--line" style={{ width: 120 }} />
            <span className="sk sk--title" />
          </div>
          <div className="layout-ticket">
            <div className="panel"><div className="panel__body sk-stack">{lines(5)}</div></div>
            <div className="panel"><div className="panel__body sk-stack">{lines(6)}</div></div>
          </div>
        </>
      )}
    </div>
  );
}

export function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {hint && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {children}
      {error && <span className="error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

export function Panel({
  title,
  action,
  quiet,
  flush,
  children,
}: {
  title?: string;
  action?: ReactNode;
  quiet?: boolean;
  /** true = children draw their own padding (chat, full-bleed lists) */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`panel${quiet ? ' panel--quiet' : ''}`} aria-label={title}>
      {title && (
        <div className="panel__head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {flush ? children : <div className="panel__body">{children}</div>}
    </section>
  );
}
