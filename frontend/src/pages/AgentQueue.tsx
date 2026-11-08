/**
 * Staff dashboard (PRD FR-08 queue sorted by priority then age) + ticket workspace (FR-09/10/13).
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
import { PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER } from '../lib/format';
import { useAsync } from '../lib/useAsync';

type View = 'active' | 'unassigned' | 'urgent' | 'mine' | 'maintenance' | 'done';

const isActive = (t: Ticket) => t.status === 'open' || t.status === 'assigned' || t.status === 'in_progress';

const VIEWS: Record<View, { label: string; test: (t: Ticket, me?: number) => boolean }> = {
  active: { label: 'ยังไม่ปิด', test: isActive },
  unassigned: { label: 'ยังไม่มีผู้รับ', test: (t) => isActive(t) && !t.assigned_agent_id },
  urgent: { label: 'ด่วนมาก รอผู้รับ', test: (t) => isActive(t) && t.priority === 'urgent' && !t.assigned_agent_id },
  mine: { label: 'งานของฉัน', test: (t, me) => isActive(t) && t.assigned_agent_id === me },
  maintenance: { label: 'ส่งต่อซ่อมบำรุง', test: (t) => isActive(t) && !!t.maintenance_work_order_id },
  done: { label: 'แก้ไขแล้ว', test: (t) => t.status === 'resolved' || t.status === 'closed' },
};

const STATUS_COLOR: Record<TicketStatus, string> = {
  open: 'var(--st-open)',
  assigned: 'var(--st-assigned)',
  in_progress: 'var(--st-progress)',
  resolved: 'var(--st-resolved)',
  closed: 'var(--st-closed)',
};

export function AgentQueue({ selectedId }: { selectedId?: number }) {
  const { user } = useIdentity();
  const { data, error, loading, reload } = useAsync(() => api.queue(), [user?.id]);
  const [view, setView] = useState<View>('active');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [search, setSearch] = useState('');

  const all = data ?? [];
  const cards: View[] = user?.role === 'agent'
    ? ['active', 'unassigned', 'urgent', 'mine', 'maintenance', 'done']
    : ['active', 'unassigned', 'urgent', 'maintenance', 'done'];
  const count = (v: View) => all.filter((t) => VIEWS[v].test(t, user?.id)).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (t) =>
        VIEWS[view].test(t, user?.id) &&
        (!priority || t.priority === priority) &&
        (!q || [t.ticket_number, t.title, t.customer_name ?? '', t.category_name ?? ''].some((s) => s.toLowerCase().includes(q))),
    );
  }, [all, view, priority, search, user?.id]);

  if (selectedId) {
    return (
      <div className="page">
        <a className="crumb" href="#/queue">
          <Icon name="back" size={16} /> กลับไปแดชบอร์ด
        </a>
        <TicketDetail id={selectedId} onChanged={reload} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pagebar">
        <div>
          <h1>แดชบอร์ด</h1>
          <p>คำร้องเรียงตามความเร่งด่วน แล้วตามเวลาที่รอ งานด่วนมากที่ไม่มีผู้รับเกิน 1 ชั่วโมงจะถูกยกระดับอัตโนมัติ</p>
        </div>
        <div className="pagebar__actions">
          <button className="btn btn--secondary" onClick={() => void reload()}>
            <Icon name="refresh" size={16} /> รีเฟรช
          </button>
        </div>
      </div>

      {loading && !data ? (
        <Loading variant="dashboard" />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : (
        <>
          <div className="stats" role="group" aria-label="ตัวเลขสรุป เลือกเพื่อกรองรายการ">
            {cards.map((v) => {
              const n = count(v);
              return (
                <button
                  key={v}
                  className={`stat${v === 'urgent' && n > 0 ? ' stat--alert' : ''}`}
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
            <div className="breakdown" aria-label="คำร้องทั้งหมดแยกตามสถานะ">
              <div className="bar">
                {STATUS_ORDER.map((s) => {
                  const n = all.filter((t) => t.status === s).length;
                  return n ? <span key={s} className="bar__seg" style={{ width: `${(n / all.length) * 100}%`, background: STATUS_COLOR[s] }} /> : null;
                })}
              </div>
              <div className="legend">
                {STATUS_ORDER.map((s) => (
                  <span key={s} className="legend__item">
                    <span className="legend__dot" style={{ background: STATUS_COLOR[s] }} />
                    {STATUS_LABEL[s]} <strong>{all.filter((t) => t.status === s).length}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Panel flush title={`คำร้อง: ${VIEWS[view].label}`}>
            <div className="toolbar">
              <label className="search">
                <span className="visually-hidden">ค้นหา</span>
                <Icon name="search" size={16} />
                <input className="input" placeholder="ค้นหาเลขที่ เรื่อง ผู้แจ้ง" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <label className="visually-hidden" htmlFor="f-priority">ความเร่งด่วน</label>
              <select id="f-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
                <option value="">ความเร่งด่วน: ทั้งหมด</option>
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>ความเร่งด่วน: {PRIORITY_LABEL[p]}</option>
                ))}
              </select>
              <span className="toolbar__count" aria-live="polite">{rows.length} รายการ</span>
            </div>
            {rows.length === 0 ? (
              <div className="empty"><p>ไม่มีคำร้องในมุมมองนี้</p></div>
            ) : (
              <TicketTable tickets={rows} mode="queue" hrefFor={(t) => `/queue/${t.id}`} caption={`คำร้อง: ${VIEWS[view].label}`} />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
