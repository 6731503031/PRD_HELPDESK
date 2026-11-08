import type { Ticket } from '../api/types';
import { age, formatDateTime } from '../lib/format';
import { PriorityText, StatusBadge } from './ui';

/**
 * Dense, keyboard-accessible ticket list.
 * mode 'requester' → My Tickets columns ; 'queue' → Agent Queue columns.
 */
export function TicketTable({
  tickets,
  mode,
  selectedId,
  hrefFor,
  caption,
}: {
  tickets: Ticket[];
  mode: 'requester' | 'queue';
  selectedId?: number;
  hrefFor: (t: Ticket) => string;
  caption: string;
}) {
  const open = (t: Ticket) => {
    window.location.hash = hrefFor(t);
  };
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">เลขที่</th>
            <th scope="col">เรื่อง</th>
            <th scope="col">ความเร่งด่วน</th>
            <th scope="col">สถานะ</th>
            {mode === 'queue' ? <th scope="col">รอมาแล้ว</th> : <th scope="col">อัปเดตล่าสุด</th>}
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr
              key={t.id}
              aria-selected={t.id === selectedId}
              onClick={() => open(t)}
            >
              <td className="num">
                <a href={`#${hrefFor(t)}`}>{t.ticket_number}</a>
              </td>
              <td className="title-cell">
                {t.title}
                <div className="sub">
                  {t.category_name ?? '–'}
                  {mode === 'queue' && <>, แจ้งโดย {t.customer_name ?? `#${t.customer_id}`}</>}
                </div>
              </td>
              <td><PriorityText priority={t.priority} /></td>
              <td>
                <StatusBadge status={t.status} />
                {mode === 'queue' && <div className="sub">{t.agent_name ?? 'ยังไม่มีผู้รับ'}</div>}
              </td>
              {mode === 'queue' ? <td>{age(t.created_at)}</td> : <td>{formatDateTime(t.updated_at)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
