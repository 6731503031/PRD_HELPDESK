/**
 * Small, PURE helpers for values that come from wrangler [vars].
 * Owner: P1 (Core & Tickets)
 */

/**
 * The link to Team 10's "report a repair" page, shown to the admin as a button (step 2 of a ticket).
 * Only http(s) links are accepted. `{ticketRef}` in it is replaced by the page with the ticket number,
 * e.g. https://maintenance.example/report?ref={ticketRef} — useful if Team 10 can open the form pre-filled.
 * Empty or anything else -> null (the page then says the link is still to come).
 */
export function portalUrl(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  return /^https?:\/\/\S+$/i.test(value) ? value : null;
}
