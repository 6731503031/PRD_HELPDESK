# A5 — Team14 Integration Evidence

**Pairing:** Team 14 (Helpdesk, Consumer) × Team 16 (Wellbeing, Provider)
**Contract:** `Team14-Integration-Contract-2.md` v1.2 (2026-09-21) — API unchanged since v1.0;
v1.1 added §2.1 (PRD fit), v1.2 added the correlation-ID labeling scheme below and clarified that
`405`/`404` never reach Wellbeing's application code. **No code change needed for the contract bump
itself** — only this evidence plan changes.

**Base URLs**
| Side | Base URL |
| --- | --- |
| Wellbeing (Team16) — Provider | `https://wellbeing-intake.vercel.app/api/v1` |
| Helpdesk (Team14) — Consumer, our deployed API | `https://helpdesk-api.team-helpdesk.workers.dev` |

**Correlation ID labels (v1.2 §6) — three labels, each used exactly once:**

| Label | Use for | Required? |
| --- | --- | --- |
| `team14-a5-0001` | Test 1 — valid request. **This is the official Consumer/Provider proof pair.** | **Required** |
| `team14-a5-0002` | Health check (`GET /health`) | Suggested |
| `team14-a5-0003` | Test 8 — the first successful call after simulated outage (recovery) | Suggested |

> ⚠️ Reusing a label across two requests gives two log lines on Team16's side with no way to tell
> which screenshot matches which — **fire each label once**. `405` (Test 2) and `404` (Test 4) never
> reach Wellbeing's application code at all: no echoed header, no log line. Evidence those two from
> our own request/response screenshot only — do not expect or ask Team16 for a matching log line.

> ⚠️ **Important:** the correlation-ID hand-shake with Team16 (A1/A4/A6 below) must be fired
> **directly at Wellbeing**, not through our `/wellbeing/services` proxy. Our proxy generates a
> random correlation ID per call internally (for our own caching/tracing) — it will not match
> whatever label we're using with Team16. Use Postman pointed straight at the Wellbeing base
> URL for the evidence hand-shake; use the Helpdesk URLs to prove our own integration code works.

---

## Which URLs to fire, and why

### A. Direct to Wellbeing (Team16) — proves the raw contract

| # | Method + URL | Headers | Expected | Evidence item |
| --- | --- | --- | --- | --- |
| A1 | `GET /services` → `https://wellbeing-intake.vercel.app/api/v1/services` | `X-Correlation-Id: team14-a5-0001` | `200`, 4 seeded services | **#1 Consumer Proof**, Test 1 — **the required one** |
| A2 | `POST /services` → same URL | — (no ID — never reaches their log) | `405`, empty body | Test 2 (invalid method) — evidence from our screenshot only |
| A3 | `GET /services/dentistry` → `https://wellbeing-intake.vercel.app/api/v1/services/dentistry` | — (no ID — never reaches their log) | `404`, generic not-found page | Test 4 (unknown resource) — evidence from our screenshot only |
| A4 | `GET /health` → `https://wellbeing-intake.vercel.app/api/v1/health` | `X-Correlation-Id: team14-a5-0002` | `200`, `{"status":"ok","service":"wellbeing","database":"up"}` | Health check — optional but Team16 can match it in their log |
| A5 | Repeat **A1**'s request, but with a throwaway ID, e.g. `X-Correlation-Id: team14-a5-idem-check` | same header | `200`, byte-identical `services` array both calls | **#5 Idempotency Proof** — do **not** reuse `0001`/`0002`/`0003` here, they're one-shot labels |
| A6 | After simulating the outage (see Degradation section), the first working `GET /services` again | `X-Correlation-Id: team14-a5-0003` | `200`, 4 services | Test 8 recovery — Team16 can match this one in their log too |

### B. Through Helpdesk (Team14) — proves *our* integration code, live

| # | Method + URL | Headers | Expected | Evidence item |
| --- | --- | --- | --- | --- |
| B1 | `GET /wellbeing/services` → `https://helpdesk-api.team-helpdesk.workers.dev/wellbeing/services` | — | `200`, `{"services":[4 items],"degraded":false}` | Proof our backend proxy reaches Wellbeing |
| B2 | `GET /tickets/:id/wellbeing-suggestion` → `https://helpdesk-api.team-helpdesk.workers.dev/tickets/4/wellbeing-suggestion` | `x-user-id: 3`, `x-user-role: agent` | `200`, `{"ticket_id":4,"suggested_service":null,"degraded":false}` (or a matched service for a stress/health-worded ticket) | Proof of matching logic on a real ticket |
| B3 | Degradation: see note below | — | `{"services":[],"degraded":true}`, still `200` | **#6 Degradation Proof** |

### A note on §2.1 (new in v1.1/v1.2) — already compliant, no code change

The updated contract adds two boundaries and a suggested "Route: Wellbeing" framing that mirrors
the PRD's AI-triage pattern (`PRD.final(1).md` §8.2–§8.6, the same `Route: Maintenance` idea):

- **"Do not forward the ticket's subject or description to us."** Confirmed compliant: our
  `GET /tickets/:id/wellbeing-suggestion` matches keywords **locally** in the Helpdesk worker and
  only ever calls `GET /services` (no ticket content in the request) — see `src/index.ts`,
  `matchWellbeingService()`.
- **"A stored slug means 'we suggested this', not 'this student is a client'."** Confirmed
  compliant: the demo UI and API responses only ever say "Wellbeing suggestion", never imply
  Wellbeing usage.
- The full `Route: Maintenance`-style AI triage pipeline (§8) isn't built in this Assignment 2 CRUD
  scope — our `wellbeing_service_slug` column + keyword-matching endpoint is the deterministic
  fallback (§8.5) equivalent, without the AI layer on top. Worth noting in the submission as the
  MVP slice of that pattern, not a gap.

### C. Not applicable for this pairing (document as N/A, don't skip silently)

| # | Item | Why N/A |
| --- | --- | --- |
| C1 | **#3 Webhook Receiver** | See full justification below. |
| C2 | **#4 Webhook Sender** | See full justification below. |
| C3 | Authentication test | Contract §3 item 13: both endpoints are public, no auth mechanism exists to test. Do not invent one. |

#### C1 — Webhook Receiver: N/A

Wellbeing (Team16) does not send Helpdesk any event for this integration, so there is no receiver
to build, no payload shape to define, no secret to verify, and no test to run.

This isn't a missing feature — it's a deliberate design boundary stated in the contract (§8):
Wellbeing's only outbound events, `appointment.reminder` and `appointment.cancelled`, go to the
platform Notification Hub addressed to the individual student, never to Helpdesk. The reason is
privacy, not convenience: per §2, *"the fact that a student contacted a wellbeing service is itself
private."* Any per-student event reaching Helpdesk — even just a timestamp with an opaque ID — would
by itself disclose that the student is using Wellbeing, which is exactly what this integration is
designed never to reveal. So Team14 has no webhook receiver endpoint, and Test 5 (webhook) and
Test 6 (duplicate event) from our own A5 test plan are N/A for the same reason: there is no event to
receive in the first place, so there is nothing that could arrive twice.

#### C2 — Webhook Sender: N/A

Helpdesk (Team14) does not send Wellbeing any webhook or event either. The integration is
deliberately one-way and read-only: Helpdesk is a Consumer that calls `GET /services` to read the
public service catalogue and display it to students — it never needs to notify Wellbeing of
anything happening on the Helpdesk side (a ticket being created, resolved, etc. is Helpdesk-internal
and irrelevant to Wellbeing). In the other direction, Wellbeing's catalogue is static seed data with
no "service changed" event to subscribe to, so there is nothing for Helpdesk to react to either. With
no event needed in either direction, there is no sender to build and no delivery/retry/duplicate
behavior to test.

---

## #2 Provider Proof — the one item that isn't "a URL we fire"

Team14 has **no provider role** in this pairing (we are Consumer-only). So "Provider Proof" here
means: **Team16's own server log screenshot**, showing `team14-a5-0001` on their side, proving our
request in A1 actually arrived. We cannot produce this ourselves — it comes from Teerapat (Team16)
right after we run A1.

Hand-off sequence:
1. Message Teerapat: "we're about to send `X-Correlation-Id: team14-a5-0001` now" (their log window is ~1 hour). Mention `0002`/`0003` too if doing the health check and recovery labels in the same session.
2. Fire **A1** (and optionally A4, A6) in Postman, screenshot request + response + timestamp immediately → this is **our #1 Consumer Proof**.
3. Teerapat screenshots their server log line(s) containing the same label(s) → sends them to us → this is **#2 Provider Proof**.
4. Both screenshots side by side, same ID visible in both → **#3 in our own earlier plan, "Matching Correlation ID"** evidence.

---

## #6 Degradation Proof — two ways to get it, pick one

**Option 1 — local (safe, no impact on the live deployment):**
```bash
cd crud_assign2
# temporarily point at an unreachable host
sed -i '' 's#https://wellbeing-intake.vercel.app/api/v1#https://wellbeing-intake.invalid/api/v1#' wrangler.toml
npx wrangler dev --local
# in another terminal / Postman:
curl -s -w '\nHTTP_STATUS:%{http_code}\n' http://127.0.0.1:8787/wellbeing/services
# expect: {"services":[],"degraded":true}  HTTP_STATUS:200
git checkout wrangler.toml   # restore the real URL
```
Screenshot the terminal/Postman output — timestamp the break, the fallback JSON, and then re-run
after `git checkout` to show recovery (next call succeeds with real data, no manual repair beyond
restoring config).

**Option 2 — on the live deployment (more "real", brief production impact):**
Temporarily edit `WELLBEING_API_URL` in `wrangler.toml` to a bad host, `wrangler deploy`, hit
`https://helpdesk-api.team-helpdesk.workers.dev/wellbeing/services` from Postman, screenshot the
`degraded:true` response, then restore the URL and `wrangler deploy` again, screenshot a healthy
call as recovery. This briefly disables the Wellbeing suggestion feature in production for anyone
using it during that window — fine for a demo-only Cloudflare deployment, but confirm you're okay
with that window before doing it this way.

Recommendation: **Option 1** — same evidentiary value, zero risk to the live deployment.

Either option proves *our* fallback works (B3). If you also want Team16's log to confirm the
recovery moment (**A6**), fire one direct `GET /services` at Wellbeing with
`X-Correlation-Id: team14-a5-0003` right after restoring the config — that's the request Teerapat
can match in their log as "the first successful call after the outage."

---

## Postman collection notes

`crud_assign2/postman_collection.json` already exists for Ticket CRUD (Assignment 2). Add a new
folder **"A5 — Wellbeing Integration"** to it with requests A1–A6 and B1–B3 above, using a Postman
environment variable `{{wellbeing_base}}` = `https://wellbeing-intake.vercel.app/api/v1` and
`{{helpdesk_base}}` = `https://helpdesk-api.team-helpdesk.workers.dev`, so switching between local
and prod for B1–B3 is a one-variable change.

---

## Evidence checklist (fill in as you capture)

- [ ] A1 — Consumer Proof screenshot (request + `200` response + `team14-a5-0001` + timestamp)
- [ ] A2 — `405` screenshot (no correlation ID expected)
- [ ] A3 — `404` screenshot (no correlation ID expected)
- [ ] A4 — health check screenshot with `team14-a5-0002` (optional)
- [ ] A5 — two identical `services` payloads side by side (idempotency, use a throwaway ID)
- [ ] A6 — recovery call screenshot with `team14-a5-0003` (optional, pairs with B3)
- [ ] B1 — proxy working screenshot
- [ ] B2 — matching logic screenshot (ideally one `null` case + one matched case)
- [ ] B3 — degraded:true screenshot + recovery screenshot
- [ ] Team16 server log screenshot(s) for `team14-a5-0001` (required) and `0002`/`0003` (optional) — Provider Proof, from Teerapat
- [ ] Team14 contact name + date added to contract sign-off table

---

## Sign-off

| Team | Name | Agreed on |
| --- | --- | --- |
| Team 16 — Wellbeing | Teerapat Sukkasem | 2026-09-21 |
| Team 14 — Helpdesk | `TODO` | `TODO` |
