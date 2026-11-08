/**
 * Screen 3 — Agent Queue (PRD FR-08 sort by priority then age, FR-09/10/13 actions)
 * Split view: queue on the left, the selected ticket on the right.
 */
import { useState } from 'react';
import { api } from '../api/client';
import type { Priority, TicketStatus } from '../api/types';
import { TicketDetail } from '../components/TicketDetail';
import { TicketTable } from '../components/TicketTable';
import { ErrorNotice, Loading, Panel } from '../components/ui';
import { useIdentity } from '../auth/identity';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const ACTIVE: TicketStatus[] = ['open', 'assigned', 'in_progress'];

export function AgentQueue({ selectedId }: { selectedId?: number }) {
  const { user } = useIdentity();
  const [status, setStatus] = useState<string>('active');
  const [priority, setPriority] = useState<string>('');
  const [unassigned, setUnassigned] = useState(false);

  const { data, error, loading, reload } = useAsync(
    () => api.queue({ status: status === 'active' ? undefined : status, priority, unassigned }),
    [status, priority, unassigned, user?.id],
  );
  const rows = (data ?? []).filter((t) => status !== 'active' || ACTIVE.includes(t.status));
  const urgentWaiting = rows.filter((t) => t.priority === 'urgent' && !t.assigned_agent_id).length;

  return (
    <div className="page">
      <div className="page__head">
        <h1>คิวงานเจ้าหน้าที่</h1>
        <p>เรียงตามความเร่งด่วน แล้วตามเวลาที่รอ งานด่วนมากที่ยังไม่มีผู้รับเรื่องเกิน 1 ชั่วโมงจะถูกยกระดับอัตโนมัติ</p>
      </div>

      <div className="layout-split">
        <Panel title="รายการคำร้อง" action={<button className="btn btn--plain btn--small" onClick={() => void reload()}>รีเฟรช</button>}>
          <div className="counts" aria-live="polite">
            <span><strong>{rows.length}</strong>รายการ</span>
            <span><strong>{rows.filter((t) => !t.assigned_agent_id).length}</strong>ยังไม่มีผู้รับเรื่อง</span>
            <span><strong style={{ color: urgentWaiting ? 'var(--urgent)' : undefined }}>{urgentWaiting}</strong>ด่วนมากและรออยู่</span>
          </div>

          <div className="filters">
            <div className="field">
              <label htmlFor="f-status">สถานะ</label>
              <select id="f-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">ยังไม่ปิด</option>
                {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-priority">ความเร่งด่วน</label>
              <select id="f-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">ทั้งหมด</option>
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <label className="choice" style={{ alignSelf: 'end' }}>
              <input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} />
              เฉพาะที่ยังไม่มีผู้รับเรื่อง
            </label>
          </div>

          {loading && !data ? (
            <Loading />
          ) : error ? (
            <ErrorNotice error={error} />
          ) : rows.length === 0 ? (
            <div className="empty"><p>ไม่มีคำร้องตามเงื่อนไขนี้</p></div>
          ) : (
            <TicketTable tickets={rows} mode="queue" selectedId={selectedId} hrefFor={(t) => `/queue/${t.id}`} caption="คิวงาน" />
          )}
        </Panel>

        <div>
          {selectedId ? (
            <TicketDetail id={selectedId} onChanged={reload} />
          ) : (
            <Panel quiet>
              <p className="muted">เลือกคำร้องจากรายการเพื่อดูรายละเอียด มอบหมาย คัดกรอง หรือปิดงาน</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
