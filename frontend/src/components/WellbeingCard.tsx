/**
 * Wellbeing (Team 16) on a ticket — contract 2.0 (AI-MIGRATION-BRIEF §7, §8).
 *   - danger words in the ticket → the emergency numbers first, and no appointment is suggested
 *   - a Wellbeing ticket (category, AI route or a matching service) → the suggested service + a link to book
 *   - referral (only when switched on): the requester may send a referral with a separate consent; the status
 *     comes back from Team 16, and "accepted" resolves the ticket
 * Without a referral Helpdesk sends nothing to Team 16; the student books on Team 16's own site, anonymously.
 * Wording never says the requester "is a Wellbeing client": we only suggest a service.
 */
import { useState } from 'react';
import { api } from '../api/client';
import type { ReferralStatus, TicketDetail, WellbeingSuggestion } from '../api/types';
import { formatDateTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { ErrorNotice, Notice } from './ui';

export function WellbeingCard({ ticket, staff, onChanged }: { ticket: TicketDetail; staff: boolean; onChanged?: () => void }) {
  const { data: w, loading, reload } = useAsync(() => api.wellbeingSuggestion(ticket.id), [ticket.id, ticket.updated_at]);
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
  const referred = !!w.referral && (w.referral.status === 'sent' || w.referral.status === 'approved');

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

        {w.referrals_enabled && (
          <Referral w={w} ticket={ticket} staff={staff} onChanged={() => { void reload(); onChanged?.(); }} />
        )}

        {!staff && !referred && (
          <p className="mt-2">
            <a className="btn btn--secondary btn--small" href={w.booking_url} target="_blank" rel="noreferrer">Book with Wellbeing ↗</a>
          </p>
        )}
        <p className="muted small mt-2">
          {staff
            ? w.referrals_enabled
              ? 'A suggestion only, unless the requester sends a referral: then Wellbeing gets a random reference and the service only, never the ticket.'
              : 'A suggestion only: Helpdesk shares nothing with Wellbeing and does not know whether the requester books.'
            : 'Booking is anonymous. Helpdesk does not share your ticket with Wellbeing.'}{' '}
          In an emergency, call 1669 or 1323.
        </p>
      </Notice>
    </div>
  );
}

const STATUS_TEXT: Record<ReferralStatus, string> = {
  sent: 'Sent to Wellbeing, waiting for them to accept.',
  approved: 'Accepted by Wellbeing. Your booking details are on the Wellbeing site.',
  declined: 'Wellbeing could not take this referral.',
  withdrawn: 'You withdrew the referral.',
};
const STAFF_TEXT: Record<ReferralStatus, string> = {
  sent: 'Referral sent, waiting for Wellbeing.',
  approved: 'Wellbeing accepted the referral.',
  declined: 'Wellbeing could not take the referral.',
  withdrawn: 'The requester withdrew the referral.',
};

/** The referral part of the card. The requester acts; the admin only sees the status (they are told so). */
function Referral({ w, ticket, staff, onChanged }: { w: WellbeingSuggestion; ticket: TicketDetail; staff: boolean; onChanged: () => void }) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const r = w.referral;
  const finished = ticket.status === 'resolved' || ticket.status === 'closed';

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setAgree(false);
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (staff) {
    return r ? (
      <p className="small mt-2">
        <strong>Referral:</strong> {STAFF_TEXT[r.status]}
        {r.status_at && <span className="muted"> ({formatDateTime(r.status_at)})</span>}
      </p>
    ) : null;
  }

  const active = r && (r.status === 'sent' || r.status === 'approved');
  return (
    <div className="mt-2">
      {r && (
        <p className="small">
          <strong>Referral:</strong> {STATUS_TEXT[r.status]}
          {r.status_at && <span className="muted"> ({formatDateTime(r.status_at)})</span>}
        </p>
      )}

      {r?.status === 'sent' && (
        <p>
          <button type="button" className="btn btn--plain btn--small" disabled={busy} onClick={() => act(() => api.withdrawWellbeingReferral(ticket.id))}>
            {busy ? 'Withdrawing…' : 'Withdraw referral'}
          </button>
        </p>
      )}

      {!active && !finished && (
        <fieldset className="mt-2">
          <legend className="small"><strong>Send this to Wellbeing for you</strong> (optional)</legend>
          <p className="small muted">
            Wellbeing receives a random reference and the suggested service only. They do not receive your name, email
            or what you wrote. When they accept, this ticket is resolved. Each step appears in this ticket's chat and
            history, which the Helpdesk admin can also see.
          </p>
          <label className="small">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to send this referral to
            Wellbeing and to receive its status here.
          </label>
          <p className="mt-2">
            <button type="button" className="btn btn--small" disabled={!agree || busy} onClick={() => act(() => api.sendWellbeingReferral(ticket.id))}>
              {busy ? 'Sending…' : 'Send to Wellbeing'}
            </button>
          </p>
        </fieldset>
      )}

      {error ? <ErrorNotice error={error} /> : null}
    </div>
  );
}
