/**
 * Screen 2 — My Tickets + ticket status (PRD FR-05, FR-06)
 */
import { api } from '../api/client';
import { Icon } from '../components/Icon';
import { TicketDetail } from '../components/TicketDetail';
import { TicketTable } from '../components/TicketTable';
import { ErrorNotice, Loading, Panel } from '../components/ui';
import { useIdentity } from '../auth/identity';
import { useAsync } from '../lib/useAsync';

export function MyTickets({ selectedId }: { selectedId?: number }) {
  const { user } = useIdentity();
  const { data, error, loading, reload } = useAsync(() => api.myTickets(), [user?.id]);

  if (selectedId) {
    return (
      <div className="page">
        <a className="crumb" href="#/my">
          <Icon name="back" size={16} /> คำร้องของฉัน
        </a>
        <TicketDetail id={selectedId} onChanged={reload} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pagebar">
        <div>
          <h1>คำร้องของฉัน</h1>
          <p>คำร้องทั้งหมดที่คุณแจ้งไว้ เลือกรายการเพื่อดูสถานะและความคืบหน้า</p>
        </div>
        <div className="pagebar__actions">
          <a className="btn" href="#/new">
            <Icon name="plus" size={16} /> แจ้งปัญหาใหม่
          </a>
        </div>
      </div>
      <Panel flush>
        {loading && !data ? (
          <div className="panel__body"><Loading variant="table" /></div>
        ) : error ? (
          <div className="panel__body"><ErrorNotice error={error} /></div>
        ) : data && data.length === 0 ? (
          <div className="empty">
            <p>คุณยังไม่มีคำร้อง</p>
            <a className="btn" href="#/new">แจ้งปัญหาใหม่</a>
          </div>
        ) : (
          <TicketTable tickets={data ?? []} mode="requester" hrefFor={(t) => `/my/${t.id}`} caption="คำร้องของฉัน" />
        )}
      </Panel>
    </div>
  );
}
