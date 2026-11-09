/**
 * Admin dashboard (PRD FR-08 list sorted by priority then age) + ticket workspace (FR-10/13).
 * One staff role (admin) — no assignment, so the views are about status, not people.
 *   #/queue      → numbers at a glance, then the full ticket list
 *   #/queue/:id  → one ticket: conversation + properties + actions
 */
import { useMemo, useState } from 'react';
import { api } from '../api/client';
import type { Priority, Ticket, TicketStatus } from '../api/types';
import { Icon } from '../components/Icon';
import { TicketDetail } from '../components/TicketDetail';
import { TicketTable } from '../components/TicketTable';
import { ErrorNotice, Loading, Panel } from '../components/ui';
import { useIdentity } from '../auth/identity';
import { PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER, isRepairDone, stageOf } from '../lib/format';
import { useAsync } from '../lib/useAsync';

type View = 'active' | 'waiting' | 'urgent' | 'maintenance' | 'repaired' | 'done';

const isActive = (t: Ticket) => t.status === 'open' || t.status === 'in_progress';

/** Cards follow the admin's work: triage (UC-07) → Team 10 (UC-08/11) → resolve (UC-09). */
const VIEWS: Record<View, { label: string; test: (t: Ticket) => boolean }> = {
  active: { label: 'Active', test: isActive },
  waiting: { label: 'Awaiting triage', test: (t) => t.status === 'open' },
  urgent: { label: 'Urgent, not started', test: (t) => t.status === 'open' && t.priority === 'urgent' },
  maintenance: {
    label: 'Under repair',
    test: (t) => isActive(t) && !!t.maintenance_work_order_id && !isRepairDone(t.maintenance_status),
  },
  repaired: { label: 'Repaired, ready to resolve', test: (t) => isActive(t) && isRepairDone(t.maintenance_status) },
  done: { label: 'Resolved', test: (t) => t.status === 'resolved' || t.status === 'closed' },
};
const CARDS: View[] = ['active', 'waiting', 'urgent', 'maintenance', 'repaired', 'done'];
/** Cards that turn red when they are not empty: work someone is waiting on. */
const ALERT: View[] = ['urgent', 'repaired'];

/** Same colours as the progress line on a ticket: blue, amber, green. */
const STATUS_COLOR: Record<TicketStatus, string> = {
  open: 'var(--fill-open)',
  in_progress: 'var(--fill-progress)',
  resolved: 'var(--fill-resolved)',
  closed: 'var(--fill-resolved)',
};

export function Dashboard({ selectedId }: { selectedId?: number }) {
  const { user } = useIdentity();
  const { data, error, loading, reload } = useAsync(() => api.queue(), [user?.id]);
  const [view, setView] = useState<View>('active');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [search, setSearch] = useState('');

  const all = data ?? [];
  const count = (v: View) => all.filter((t) => VIEWS[v].test(t)).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (t) =>
        VIEWS[view].test(t) &&
        (!priority || t.priority === priority) &&
        (!q || [t.ticket_number, t.title, t.customer_name ?? '', t.category_name ?? ''].some((s) => s.toLowerCase().includes(q))),
    );
  }, [all, view, priority, search]);

  if (selectedId) {
    return (
      <div className="page">
        <a className="crumb" href="#/queue">
          <Icon name="back" size={16} /> Back to dashboard
        </a>
        <TicketDetail id={selectedId} onChanged={reload} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pagebar">
        <div>
          <h1>Dashboard</h1>
          <p>Tickets sorted by urgency, then by waiting time. Urgent tickets not started within 1 hour are escalated automatically.</p>
        </div>
        <div className="pagebar__actions">
          <button className="btn btn--secondary" onClick={() => void reload()}>
            <Icon name="refresh" size={16} /> Refresh
          </button>
        </div>
      </div>

      {loading && !data ? (
        <Loading variant="dashboard" />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : (
        <>
          <div className="stats" role="group" aria-label="Summary, select to filter the list">
            {CARDS.map((v) => {
              const n = count(v);
              return (
                <button
                  key={v}
                  className={`stat${ALERT.includes(v) && n > 0 ? ' stat--alert' : ''}`}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  <span className="stat__value">{n}</span>
                  <span className="stat__label">{VIEWS[v].label}</span>
                </button>
              );
            })}
          </div>

          {all.length > 0 && (
            <div className="breakdown" aria-label="All tickets by status">
              <div className="bar">
                {STATUS_ORDER.map((s) => {
                  const n = all.filter((t) => stageOf(t.status) === s).length;
                  // width + colour are data, so they stay inline
                  return n ? <span key={s} className="bar__seg" style={{ width: `${(n / all.length) * 100}%`, background: STATUS_COLOR[s] }} /> : null;
                })}
              </div>
              <div className="legend">
                {STATUS_ORDER.map((s) => (
                  <span key={s} className="legend__item">
                    <span className="legend__dot" style={{ background: STATUS_COLOR[s] }} />
                    {STATUS_LABEL[s]} <strong>{all.filter((t) => stageOf(t.status) === s).length}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Panel flush title={`Tickets: ${VIEWS[view].label}`}>
            <div className="toolbar">
              <label className="search">
                <span className="visually-hidden">Search</span>
                <Icon name="search" size={16} />
                <input className="input" placeholder="Search ticket, subject or requester" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <label className="visually-hidden" htmlFor="f-priority">Urgency</label>
              <select id="f-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
                <option value="">Urgency: All</option>
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>Urgency: {PRIORITY_LABEL[p]}</option>
                ))}
              </select>
              <span className="toolbar__count" aria-live="polite">{rows.length} {rows.length === 1 ? 'ticket' : 'tickets'}</span>
            </div>
            {rows.length === 0 ? (
              <div className="empty"><p>No tickets in this view.</p></div>
            ) : (
              <TicketTable tickets={rows} mode="queue" hrefFor={(t) => `/queue/${t.id}`} caption={`Tickets: ${VIEWS[view].label}`} />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
