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

export function Loading({ label = 'กำลังโหลด…' }: { label?: string }) {
  return (
    <p className="muted" role="status" aria-live="polite">
      {label}
    </p>
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

export function Panel({ title, action, quiet, children }: { title?: string; action?: ReactNode; quiet?: boolean; children: ReactNode }) {
  return (
    <section className={`panel${quiet ? ' panel--quiet' : ''}`} aria-label={title}>
      {title && (
        <div className="panel__head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}
