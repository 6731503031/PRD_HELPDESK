import type { Ticket } from '../api/types';
import { age, formatDateTime } from '../lib/format';
import { Avatar, Icon } from './Icon';
import { PriorityText, StatusBadge } from './ui';

/**
 * Full-width ticket list. Each row opens the ticket; the title is the keyboard link.
 * mode 'queue' → staff dashboard columns ; 'requester' → My Tickets columns.
 */
export function TicketTable({
  tickets,
  mode,
  hrefFor,
  caption,
}: {
  tickets: Ticket[];
  mode: 'requester' | 'queue';
  hrefFor: (t: Ticket) => string;
  caption: string;
}) {
  const queue = mode === 'queue';
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">เลขที่</th>
            <th scope="col">เรื่อง</th>
            <th scope="col">หมวดหมู่</th>
            <th scope="col">ความเร่งด่วน</th>
            <th scope="col">สถานะ</th>
            {queue && <th scope="col">ผู้แจ้ง</th>}
            <th scope="col">ผู้รับผิดชอบ</th>
            <th scope="col">{queue ? 'รอมาแล้ว' : 'อัปเดตล่าสุด'}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} onClick={() => (window.location.hash = hrefFor(t))}>
              <td className="num">{t.ticket_number}</td>
              <td className="title-cell">
                <a className="title" href={`#${hrefFor(t)}`} title={t.title}>{t.title}</a>
                {t.maintenance_work_order_id && (
                  <span className="sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="wrench" size={13} /> ใบงานซ่อม {t.maintenance_work_order_id}
                  </span>
                )}
              </td>
              <td><span className="chip">{t.category_name ?? '–'}</span></td>
              <td><PriorityText priority={t.priority} /></td>
              <td><StatusBadge status={t.status} /></td>
              {queue && (
                <td>
                  <span className="person">
                    <Avatar name={t.customer_name} size={24} />
                    {t.customer_name ?? `#${t.customer_id}`}
                  </span>
                </td>
              )}
              <td>
                {t.agent_name ? (
                  <span className="person">
                    <Avatar name={t.agent_name} size={24} />
                    {t.agent_name}
                  </span>
                ) : (
                  <span className="muted small">ยังไม่มีผู้รับ</span>
                )}
              </td>
              <td className="nowrap">{queue ? age(t.created_at) : formatDateTime(t.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
