import type { Ticket } from '../api/types';
import { age, formatDateTime, maintenanceLabel } from '../lib/format';
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
            <th scope="col">Ticket</th>
            <th scope="col">Subject</th>
            <th scope="col">Category</th>
            <th scope="col">Urgency</th>
            <th scope="col">Status</th>
            {queue && <th scope="col">Requester</th>}
            <th scope="col">{queue ? 'Waiting' : 'Last updated'}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} onClick={() => (window.location.hash = hrefFor(t))}>
              <td className="num">{t.ticket_number}</td>
              <td className="title-cell">
                <a className="title" href={`#${hrefFor(t)}`} title={t.title}>{t.title}</a>
                {t.maintenance_work_order_id && (
                  <span className="sub sub--icon">
                    <Icon name="wrench" size={13} /> Work order {t.maintenance_work_order_id}
                    {queue && t.maintenance_status ? ` · ${maintenanceLabel(t.maintenance_status)}` : ''}
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
              <td className="nowrap">{queue ? age(t.created_at) : formatDateTime(t.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
