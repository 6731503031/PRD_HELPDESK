/**
 * Wellbeing (Team 16) on a ticket — contract 2.0 (AI-MIGRATION-BRIEF §7, §8).
 *   - danger words in the ticket → the emergency numbers first, and no appointment is suggested
 *   - a Wellbeing ticket (category, AI route or a matching service) → the suggested service + a link to book
 * Helpdesk sends nothing to Team 16; the student books on Team 16's own site, anonymously.
 * Wording never says the requester "is a Wellbeing client": we only suggest a service.
 */
import { api } from '../api/client';
import type { TicketDetail } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { Notice } from './ui';

export function WellbeingCard({ ticket, staff }: { ticket: TicketDetail; staff: boolean }) {
  const { data: w, loading } = useAsync(() => api.wellbeingSuggestion(ticket.id), [ticket.id, ticket.updated_at]);
  // While loading a Wellbeing ticket, hold the card's place so the page does not jump when it arrives.
  const expected = ticket.category_name?.toLowerCase() === 'wellbeing' || ticket.ai_route === 'wellbeing';
  if (!w) {
    return loading && expected ? (
      <div className="mt-5" aria-busy="true">
        <Notice tone="info" title={staff ? 'Wellbeing service suggested to the requester' : 'Wellbeing support'}>
          <p className="muted small">Loading Wellbeing services…</p>
          <p className="muted small">&nbsp;</p>
        </Notice>
      </div>
    ) : null; // not a Wellbeing ticket, or the check failed: never block the ticket
  }

  const emergency = (
    <p className="small">
      {w.emergency_numbers.map((e, i) => (
        <span key={e.number}>
          {i > 0 && ' · '}
          <a href={`tel:${e.number}`}><strong>{e.number}</strong></a> {e.label}
        </span>
      ))}
    </p>
  );

  if (w.danger) {
    return (
      <div className="mt-5">
        <Notice tone="error" title={staff ? 'This ticket may mention someone in danger. Emergency numbers are shown to the requester.' : 'If you or someone else may be in danger, call now'}>
          {emergency}
          <p className="small">
            Wellbeing appointments are not crisis support. <a href={w.emergency_url} target="_blank" rel="noreferrer">Emergency help ↗</a>
          </p>
        </Notice>
      </div>
    );
  }

  if (!w.wellbeing_ticket) return null; // the backend decides; other tickets never show a service
  const s = w.suggested_service;

  return (
    <div className="mt-5">
      <Notice tone="info" title={staff ? 'Wellbeing service suggested to the requester' : 'Wellbeing support'}>
        {s ? (
          <>
            <p>
              <strong>{s.name}</strong>
              {s.duration_minutes > 0 && <span className="muted"> · {s.duration_minutes}-minute session</span>}
            </p>
            {s.description && <p className="small">{s.description}</p>}
          </>
        ) : (
          <p className="small">
            {w.available
              ? 'University Wellbeing offers counselling for stress, study pressure, low mood and other worries.'
              : 'The Wellbeing service list is unavailable right now. You can still book on their site.'}
          </p>
        )}
        {!staff && (
          <p className="mt-2">
            <a className="btn btn--secondary btn--small" href={w.booking_url} target="_blank" rel="noreferrer">Book with Wellbeing ↗</a>
          </p>
        )}
        <p className="muted small mt-2">
          {staff
            ? 'A suggestion only: Helpdesk shares nothing with Wellbeing and does not know whether the requester books.'
            : 'Booking is anonymous. Helpdesk does not share your ticket with Wellbeing.'}{' '}
          In an emergency, call 1669 or 1323.
        </p>
      </Notice>
    </div>
  );
}
