/**
 * Screen 2 — My Tickets + ticket status (PRD FR-05, FR-06)
 */
import { api } from '../api/client';
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
        <p className="crumb"><a href="#/my">คำร้องของฉัน</a></p>
        <TicketDetail id={selectedId} onChanged={reload} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1>คำร้องของฉัน</h1>
        <p>คำร้องทั้งหมดที่คุณแจ้งไว้ เรียงจากที่อัปเดตล่าสุด เลือกรายการเพื่อดูสถานะและข้อความจากเจ้าหน้าที่</p>
      </div>
      <Panel>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorNotice error={error} />
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
