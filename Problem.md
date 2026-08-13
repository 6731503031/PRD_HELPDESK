# Problem Analysis — Helpdesk

**Role:** Product Analyst
**Source:** `PRD_Helpdesk.md`
**Constraint:** Realistic for a 1-semester university student project.

---

## 1. Main Problem

Students and staff have **no single, structured, trackable channel** to report issues and follow them through to resolution. Requests currently scatter across email, LINE groups, in-person visits, and ad-hoc DMs. The result:

- Requests get lost or forgotten.
- Nobody owns the issue end-to-end.
- There is no shared status, no SLA, and no audit trail.
- Cross-team coordination (e.g., Helpdesk ↔ Maintenance) is manual and error-prone.

The Helpdesk platform fixes this by giving every request a **ticket identity, an owner, a status, and an event stream** that other systems can subscribe to.

---

## 2. Target Users

| Role | Who | What they need |
|---|---|---|
| **Requester** (primary) | Students, faculty, staff | One place to report; a ticket ID; visibility into status. |
| **Agent** (primary) | Helpdesk staff / front-line support | A queue, prioritization, the ability to triage, assign, comment, resolve. |
| **Admin / Supervisor** (secondary) | Helpdesk lead | Oversight: backlog, recurring issues, basic counts. |
| **Integrator** (not a user, but a stakeholder) | Maintenance, Notification, Identity, Analytics teams | Clean events to subscribe to and APIs to call. |

Persona sketch (MVP):
- **"New-ish student Nok"** — wants to report a broken projector in Room 204 without learning a complex tool.
- **"Agent Anan"** — handles 20–40 tickets/day; needs the urgent stuff on top.

---

## 3. Current Workflow (As-Is)

```
Student   ──►  Email / LINE / Walk-in / DM
                        │
                        ▼
            Admin inbox (messy, mixed channels)
                        │
                        ▼
            Manual triage by gut feel
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
   Sometimes routed to        Often forgotten
   Maintenance team           or stuck
   (info re-typed)            (no follow-up)
```

- No ticket ID → hard to reference.
- No priority field → urgency is implicit and inconsistent.
- Handoff to Maintenance = copy-paste into another system.
- Student has no way to know "is anyone looking at this?"

---

## 4. Pain Points

| # | Pain point | Who feels it |
|---|---|---|
| P1 | Lost / dropped requests | Students, staff |
| P2 | No visibility into status | Students |
| P3 | No prioritization signal | Agents |
| P4 | Manual cross-team coordination | Agents, Maintenance |
| P5 | No historical data for recurring issues | Admin, institution |
| P6 | No audit trail for compliance / security review | Compliance |
| P7 | Duplicate reports of the same issue | Everyone |
| P8 | Channel fragmentation forces students to "know the right inbox" | Students |

---

## 5. Core User Journey

### 5.1 Requester flow

1. Log in (campus Identity).
2. Click **Create Ticket** → fill subject, description, category, urgency.
3. (Optional) Accept the suggested category/priority from the AI/rules.
4. Submit → receive **Ticket ID**.
5. Receive notifications on `ticket.assigned` and `ticket.resolved`.
6. Open **My Tickets** to see status, add a clarifying comment.

### 5.2 Agent flow

1. Log in as staff.
2. Open **Queue** → sorted by priority + age.
3. Open a ticket → triage: assign self, change priority, link a Maintenance work-order ID, comment internally.
4. Mark **Resolved** → publishes `ticket.resolved` event.

### 5.3 Cross-team flow

- When Maintenance changes a linked work order, `maintenance.status_changed` is consumed → ticket status auto-updates. No copy-paste.
- Notification Hub, Security & Compliance, and Analytics subscribe to `ticket.*` events.

---

## 6. Expected Value

| Stakeholder | Value |
|---|---|
| Students / staff | One place, one ID, no need to chase. |
| Agents | Triage queue, AI-assisted routing, fewer dropped tickets. |
| Helpdesk lead | Basic counts to spot patterns. |
| Maintenance team | Linked work-order ID instead of re-typing repair records. |
| Compliance / Security | Event log for audit. |
| Analytics team | `ticket.*` event stream, no scraping. |

---

## 7. Assumptions That Need Validation

These should be checked with real users (or at least 3–5 student/staff interviews) **before** building:

| # | Assumption | Why it matters |
|---|---|---|
| A1 | Students will use a web form instead of LINE / email. | Adoption risk is the #1 killer of internal tools. |
| A2 | Category + priority rules are enough for v1; no LLM needed. | Determines build cost. |
| A3 | Identity service is available, stable, and documented by the team providing it. | Hard blocker if not. |
| A4 | `maintenance.status_changed` is a real, documented webhook. | Determines whether the cross-team flow is real or simulated. |
| A5 | Agents will adopt a new tool (vs. keep using personal channels). | Workflow change is harder than code. |
| A6 | Volume is small enough (tens to low hundreds/day) for a single-node MVP. | Capacity planning. |
| A7 | English-only UI is acceptable for v1. | May need Thai later, but defer. |
| A8 | Notifications go through the existing Notification Hub, not our own SMTP/SMS code. | Avoids reinventing delivery. |

---

## 8. NOT Necessary for MVP (Cut List)

To fit a 1-semester timeline (≈ 4 months, 1 small team), drop these from MVP and put them in a "Later" backlog:

### Inbox / intake
- ❌ Email-to-ticket parser
- ❌ LINE bot / social-channel ingestion
- ❌ Voice / phone call logging

### Triage / routing
- ❌ LLM-based suggestions (use **keyword + rules only**)
- ❌ SLA timers with auto-escalation
- ❌ Custom workflows per category
- ❌ Round-robin / load balancing assignment

### UX
- ❌ Mobile native app (responsive web is enough)
- ❌ Multi-language (English only)
- ❌ File attachments (or limit to **one image**, optional)
- ❌ Rich-text editor (plain text + newlines)
- ❌ Real-time chat (async comments only)

### Reporting / analytics
- ❌ Dashboards (defer to Analytics team; we only publish events)
- ❌ CSAT / satisfaction surveys
- ❌ Agent performance metrics

### Permissions / admin
- ❌ Complex RBAC matrix (just: `Requester`, `Agent`, `Admin`)
- ❌ Bulk operations, ticket templates
- ❌ Public knowledge base / FAQ

### Quality / compliance
- ❌ Fine-grained audit log UI (log is enough)
- ❌ Data retention policies (use defaults)

---

## 9. MVP Recommendation (one paragraph)

Build a **web app** with **three screens** (Create Ticket, My Tickets, Agent Queue), **one simple rules engine** to suggest category + priority, **one event publisher** that emits `ticket.created / escalated / resolved`, and **two thin integrations**: read `maintenance.status_changed` to mirror status, and consume Identity for login. Defer everything in §8.

This keeps the surface small enough for one team in one semester, while still delivering the core promise: **every request has an ID, an owner, and a trail.**
