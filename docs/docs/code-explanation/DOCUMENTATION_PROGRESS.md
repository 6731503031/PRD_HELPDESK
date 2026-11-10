# Documentation Progress

อัปเดตล่าสุด: 2026-11-10

สถานะใช้กับการตรวจ source และการอธิบาย ไม่ใช่จำนวนไฟล์ที่สร้างไว้เท่านั้น:

- `Analyzed + documented`: อ่าน source โดยตรงและมีคำอธิบาย
- `Analyzed, documentation pending`: อ่าน source แล้ว แต่ยังไม่ได้ทำเอกสารเฉพาะ
- `Not analyzed`: พบไฟล์จาก inventory แต่ยังไม่ได้ตรวจ implementation
- `Excluded / deferred`: ไม่อ่านใน source-analysis ปกติ หรือรอความเกี่ยวข้อง/รูปแบบที่เหมาะสม

## สรุป

- Project inventory: สำรวจจาก workspace file listing; รายการด้านล่างเป็น inventory เริ่มต้นและจะขยาย/แก้ไขหากพบไฟล์เพิ่ม
- Analyzed + documented: frontend foundation/shared UI, backend core/authentication, AI triage, ticket lifecycle, D1 schema/migrations, comments/chat, Maintenance, events/escalation, admin/category, Wellbeing, and Worker/reference slices ตามรายการด้านล่าง
- Application source inventory: all discovered frontend/backend source files are reviewed; individual partial scopes are labeled below
- Remaining: selected existing context documents, secret/template artifacts, live integrations, and any files added after the initial inventory
- Unverified: existing prose specifications are not reconciled line-by-line; live integrations/data are not exercised
- Source changes: ไม่มี
- Secret files: ไม่อ่าน `.env`; ห้ามคัดลอก secret values ลงเอกสาร
- Verification so far: `npm run typecheck` passed; full `npm test` passed 67 tests with 5 skipped and 0 failures (6/6 files); all local documentation links resolve

## เอกสารที่สร้างแล้ว

- [`README.md`](README.md) — วิธีอ่านชุดเอกสารและขอบเขตปัจจุบัน
- [`08-file-explanations/frontend/01-frontend-foundation.md`](08-file-explanations/frontend/01-frontend-foundation.md) — HTML/React startup, route, identity/session และ API client
- [`08-file-explanations/frontend/02-shared-ui-profile-and-styles.md`](08-file-explanations/frontend/02-shared-ui-profile-and-styles.md) — Profile, shared UI, icons, format/repair helpers and stylesheet
- [`08-file-explanations/backend/01-core-identity-and-auth.md`](08-file-explanations/backend/01-core-identity-and-auth.md) — Worker types, identity stub, guest profiles, auth middleware/routes และ HTTP helpers
- [`08-file-explanations/backend/02-ai-triage.md`](08-file-explanations/backend/02-ai-triage.md) — triage endpoint, Workers AI adapter, response validation, fallback, frontend use และ persistence
- [`08-file-explanations/backend/03-ticket-lifecycle.md`](08-file-explanations/backend/03-ticket-lifecycle.md) — ticket create/list/detail/edit/resolve/delete, rules, D1 repository และ workflow
- [`08-file-explanations/database/01-schema-and-migrations.md`](08-file-explanations/database/01-schema-and-migrations.md) — D1 ER model, tables/indexes/constraints, migration order and cleanup SQL
- [`08-file-explanations/backend/04-comments-and-chat.md`](08-file-explanations/backend/04-comments-and-chat.md) — comment APIs, user/system messages, frontend conversation loading, polling and sending
- [`08-file-explanations/backend/05-maintenance-integration.md`](08-file-explanations/backend/05-maintenance-integration.md) — Team 10 REST client, work-order flows, signed webhook verification and ticket updates
- [`08-file-explanations/backend/06-events-and-escalation.md`](08-file-explanations/backend/06-events-and-escalation.md) — cron wiring, event envelope, log-only publisher and unimplemented escalation behavior
- [`08-file-explanations/backend/07-admin-and-categories.md`](08-file-explanations/backend/07-admin-and-categories.md) — admin UI, protected route stubs and public category reads
- [`08-file-explanations/backend/08-wellbeing-integration.md`](08-file-explanations/backend/08-wellbeing-integration.md) — catalogue proxy/cache, whole-word matching and current frontend wiring status
- [`08-file-explanations/backend/09-worker-entrypoint-and-reference.md`](08-file-explanations/backend/09-worker-entrypoint-and-reference.md) — Worker routing, middleware, auth boundaries and public reference routes
- [`05-tests-and-coverage.md`](05-tests-and-coverage.md) — full Vitest results, skipped cases and coverage boundaries
- [`06-operational-tooling-and-audit.md`](06-operational-tooling-and-audit.md) — commands, CI, scripts, legacy Postman contract and audit boundaries

## Frontend source inventory

### Analyzed + documented

- [`frontend/index.html`](../../frontend/index.html)
- [`frontend/vite.config.ts`](../../frontend/vite.config.ts)
- [`frontend/src/main.tsx`](../../frontend/src/main.tsx)
- [`frontend/src/App.tsx`](../../frontend/src/App.tsx)
- [`frontend/src/api/client.ts`](../../frontend/src/api/client.ts)
- [`frontend/src/api/types.ts`](../../frontend/src/api/types.ts)
- [`frontend/src/auth/identity.tsx`](../../frontend/src/auth/identity.tsx)
- [`frontend/src/lib/router.ts`](../../frontend/src/lib/router.ts)
- [`frontend/src/lib/usePersisted.ts`](../../frontend/src/lib/usePersisted.ts)
- [`frontend/src/pages/Login.tsx`](../../frontend/src/pages/Login.tsx)

### Not analyzed or partially analyzed

- [`frontend/src/api/aiService.ts`](../../frontend/src/api/aiService.ts) — analyzed + documented as the AI request wrapper
- [`frontend/src/components/Chat.tsx`](../../frontend/src/components/Chat.tsx) — analyzed + documented
- [`frontend/src/components/Icon.tsx`](../../frontend/src/components/Icon.tsx) — analyzed + documented
- [`frontend/src/components/Logo.tsx`](../../frontend/src/components/Logo.tsx) — analyzed + documented
- [`frontend/src/components/TicketDetail.tsx`](../../frontend/src/components/TicketDetail.tsx) — ticket actions/detail and Maintenance handoff UI analyzed + documented
- [`frontend/src/components/TicketTable.tsx`](../../frontend/src/components/TicketTable.tsx) — analyzed + documented
- [`frontend/src/components/ui.tsx`](../../frontend/src/components/ui.tsx) — analyzed + documented
- [`frontend/src/lib/format.ts`](../../frontend/src/lib/format.ts) — analyzed + documented
- [`frontend/src/lib/repair.ts`](../../frontend/src/lib/repair.ts) — analyzed + documented
- [`frontend/src/lib/useAsync.ts`](../../frontend/src/lib/useAsync.ts) — analyzed + documented for list/detail loading
- [`frontend/src/pages/Admin.tsx`](../../frontend/src/pages/Admin.tsx) — analyzed + documented
- [`frontend/src/pages/CreateTicket.tsx`](../../frontend/src/pages/CreateTicket.tsx) — create + AI workflows analyzed + documented
- [`frontend/src/pages/Dashboard.tsx`](../../frontend/src/pages/Dashboard.tsx) — analyzed + documented for ticket queue
- [`frontend/src/pages/Messages.tsx`](../../frontend/src/pages/Messages.tsx) — analyzed + documented for conversation list/selection
- [`frontend/src/pages/MyTickets.tsx`](../../frontend/src/pages/MyTickets.tsx) — analyzed + documented
- [`frontend/src/pages/Profile.tsx`](../../frontend/src/pages/Profile.tsx) — analyzed + documented
- [`frontend/src/styles/app.css`](../../frontend/src/styles/app.css) — analyzed + documented by section/layout

## Backend source inventory (status per item)

### Entry/core

- [`backend/src/index.ts`](../../backend/src/index.ts) — analyzed + documented
- [`backend/src/core/auth.ts`](../../backend/src/core/auth.ts) — analyzed + documented
- [`backend/src/core/config.ts`](../../backend/src/core/config.ts) — analyzed + documented
- [`backend/src/core/env.ts`](../../backend/src/core/env.ts) — analyzed + documented
- [`backend/src/core/http.ts`](../../backend/src/core/http.ts) — analyzed + documented
- [`backend/src/core/identity.ts`](../../backend/src/core/identity.ts) — analyzed + documented
- [`backend/src/core/profiles.ts`](../../backend/src/core/profiles.ts) — analyzed + documented

### AI

- [`backend/src/ai/ai.ts`](../../backend/src/ai/ai.ts) — analyzed + documented
- [`backend/src/ai/askAi.ts`](../../backend/src/ai/askAi.ts) — analyzed + documented (compatibility export)
- [`backend/src/ai/fallback.ts`](../../backend/src/ai/fallback.ts) — analyzed + documented
- [`backend/src/ai/pickSuggestion.ts`](../../backend/src/ai/pickSuggestion.ts) — analyzed + documented
- [`backend/src/ai/record.ts`](../../backend/src/ai/record.ts) — analyzed + documented
- [`backend/src/ai/recordSuggestion.ts`](../../backend/src/ai/recordSuggestion.ts) — analyzed + documented (compatibility export)
- [`backend/src/ai/routes.ts`](../../backend/src/ai/routes.ts) — analyzed + documented

### Feature modules

- [`backend/src/modules/admin/routes.ts`](../../backend/src/modules/admin/routes.ts) — analyzed + documented; all three handlers currently return 501
- [`backend/src/modules/auth/routes.ts`](../../backend/src/modules/auth/routes.ts) — analyzed + documented
- [`backend/src/modules/comments/routes.ts`](../../backend/src/modules/comments/routes.ts) — analyzed + documented
- [`backend/src/modules/comments/rules.ts`](../../backend/src/modules/comments/rules.ts) — analyzed + documented
- [`backend/src/modules/comments/templates.ts`](../../backend/src/modules/comments/templates.ts) — ticket, chat and Maintenance system-message behavior analyzed + documented
- [`backend/src/modules/events/escalation.ts`](../../backend/src/modules/events/escalation.ts) — analyzed + documented; logic remains TODO in source
- [`backend/src/modules/events/publish.ts`](../../backend/src/modules/events/publish.ts) — analyzed + documented; currently log-only
- [`backend/src/modules/maintenance/client.ts`](../../backend/src/modules/maintenance/client.ts) — analyzed + documented
- [`backend/src/modules/maintenance/envelope.ts`](../../backend/src/modules/maintenance/envelope.ts) — analyzed + documented
- [`backend/src/modules/maintenance/mapping.ts`](../../backend/src/modules/maintenance/mapping.ts) — analyzed + documented
- [`backend/src/modules/maintenance/routes.ts`](../../backend/src/modules/maintenance/routes.ts) — analyzed + documented
- [`backend/src/modules/maintenance/signature.ts`](../../backend/src/modules/maintenance/signature.ts) — analyzed + documented
- [`backend/src/modules/reference/routes.ts`](../../backend/src/modules/reference/routes.ts) — analyzed + documented
- [`backend/src/modules/tickets/repo.ts`](../../backend/src/modules/tickets/repo.ts) — analyzed + documented
- [`backend/src/modules/tickets/routes.ts`](../../backend/src/modules/tickets/routes.ts) — analyzed + documented
- [`backend/src/modules/tickets/rules.ts`](../../backend/src/modules/tickets/rules.ts) — analyzed + documented
- [`backend/src/modules/wellbeing/routes.ts`](../../backend/src/modules/wellbeing/routes.ts) — analyzed + documented

## Database, tests, tooling และเอกสารเดิม (status per item)

### Database

- [`database/schema.sql`](../../database/schema.sql) — analyzed + documented
- [`database/clean-demo-data.sql`](../../database/clean-demo-data.sql) — analyzed + documented; destructive script, not executed
- [`database/migrations/0001_add_wellbeing_slug.sql`](../../database/migrations/0001_add_wellbeing_slug.sql) — analyzed + documented
- [`database/migrations/0002_final_features.sql`](../../database/migrations/0002_final_features.sql) — analyzed + documented
- [`database/migrations/0003_drop_assigned_status.sql`](../../database/migrations/0003_drop_assigned_status.sql) — analyzed + documented for legacy ticket status conversion
- [`database/migrations/0004_guest_profiles.sql`](../../database/migrations/0004_guest_profiles.sql) — analyzed + documented; deletion not executed

### Tests

- [`backend/test/ai.test.ts`](../../backend/test/ai.test.ts) — analyzed + documented; full suite: 12 passed
- [`backend/test/comments.test.ts`](../../backend/test/comments.test.ts) — analyzed + documented; full suite: 10 passed
- [`backend/test/config.test.ts`](../../backend/test/config.test.ts) — analyzed + documented; full suite: 2 passed
- [`backend/test/escalation.test.ts`](../../backend/test/escalation.test.ts) — full suite: 1 passed, 3 escalation tests skipped
- [`backend/test/maintenance.test.ts`](../../backend/test/maintenance.test.ts) — analyzed + documented; full suite: 32 passed
- [`backend/test/tickets.rules.test.ts`](../../backend/test/tickets.rules.test.ts) — analyzed + documented; full suite: 10 passed, 2 lifecycle tests skipped

### Runtime, scripts, workflows, and existing docs

- [`package.json`](../../package.json) — scripts/dependencies reviewed and documented
- [`wrangler.toml`](../../wrangler.toml) — Worker bindings, assets, vars, D1, and cron reviewed
- [`backend/tsconfig.json`](../../backend/tsconfig.json) — reviewed
- [`frontend/tsconfig.json`](../../frontend/tsconfig.json) — reviewed
- [`vitest.config.ts`](../../vitest.config.ts) — reviewed and documented
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — reviewed and documented
- [`scripts/send-mock-maintenance-event.mjs`](../../scripts/send-mock-maintenance-event.mjs) — analyzed + documented as webhook test helper
- [`scripts/smoke.sh`](../../scripts/smoke.sh) — reviewed; not executed because it mutates data
- [`scripts/worktree.sh`](../../scripts/worktree.sh) — reviewed; not executed because it changes Git/filesystem state and may copy `.dev.vars`
- [`backend/postman_collection.json`](../../backend/postman_collection.json) — reviewed; legacy examples documented as stale where mismatched
- [`dev.vars.example`](../../dev.vars.example) — deferred/unread secret template; values were not inspected or copied
- [`README.md`](../../README.md) — reviewed for project map/setup context
- [`docs/FEATURES.md`](../FEATURES.md) — inventoried; not reconciled line-by-line
- [`docs/PRD.md`](../PRD.md) — inventoried; not reconciled line-by-line
- [`docs/TEAM_GUIDE.md`](../TEAM_GUIDE.md) — inventoried; not reconciled line-by-line
- [`docs/assignments/A2-codespace-setup.md`](../assignments/A2-codespace-setup.md) — inventoried; not reviewed in final audit
- [`docs/assignments/A2-crud-tutorial.md`](../assignments/A2-crud-tutorial.md) — inventoried; not reviewed in final audit
- [`docs/assignments/A2-postman-test-guide.md`](../assignments/A2-postman-test-guide.md) — inventoried; not reviewed in final audit
- [`docs/assignments/A5-wellbeing-evidence.md`](../assignments/A5-wellbeing-evidence.md) — inventoried; not reviewed in final audit
- [`docs/assignments/A5-wellbeing-demo.html`](../assignments/A5-wellbeing-demo.html) — inventoried; demo artifact not reviewed

## Deferred/excluded/repository metadata files

- [`.env`](../../.env): excluded to prevent secret exposure; not opened.
- [`docs/Helpdesk-Maintenance-Integration-Proposal.docx`](../Helpdesk-Maintenance-Integration-Proposal.docx) and [`docs/Team-Roles.docx`](../Team-Roles.docx): binary office documents, deferred unless relevant; not treated as source code.
- [`.gitignore`](../../.gitignore) — reviewed for secret/build-output exclusions; [`package-lock.json`](../../package-lock.json) remains an unreviewed dependency lock artifact, not application source.

### Analyzed + documented (backend core/auth and supporting excerpts)

- [`backend/src/core/auth.ts`](../../backend/src/core/auth.ts)
- [`backend/src/core/config.ts`](../../backend/src/core/config.ts)
- [`backend/src/core/env.ts`](../../backend/src/core/env.ts)
- [`backend/src/core/http.ts`](../../backend/src/core/http.ts)
- [`backend/src/core/identity.ts`](../../backend/src/core/identity.ts)
- [`backend/src/core/profiles.ts`](../../backend/src/core/profiles.ts)
- [`backend/src/modules/auth/routes.ts`](../../backend/src/modules/auth/routes.ts)
- [`backend/src/modules/reference/routes.ts`](../../backend/src/modules/reference/routes.ts) — public auth/category/config/tags/health behavior documented in the core/admin/Worker guides
- [`backend/test/comments.test.ts`](../../backend/test/comments.test.ts) — profile/identity test section
- [`backend/test/config.test.ts`](../../backend/test/config.test.ts)

### Analyzed + documented (AI triage)

- [`backend/src/ai/ai.ts`](../../backend/src/ai/ai.ts)
- [`backend/src/ai/askAi.ts`](../../backend/src/ai/askAi.ts)
- [`backend/src/ai/fallback.ts`](../../backend/src/ai/fallback.ts)
- [`backend/src/ai/pickSuggestion.ts`](../../backend/src/ai/pickSuggestion.ts)
- [`backend/src/ai/record.ts`](../../backend/src/ai/record.ts)
- [`backend/src/ai/recordSuggestion.ts`](../../backend/src/ai/recordSuggestion.ts)
- [`backend/src/ai/routes.ts`](../../backend/src/ai/routes.ts)
- [`frontend/src/api/aiService.ts`](../../frontend/src/api/aiService.ts)
- [`frontend/src/pages/CreateTicket.tsx`](../../frontend/src/pages/CreateTicket.tsx) — AI flow only
- [`backend/test/ai.test.ts`](../../backend/test/ai.test.ts)

### Analyzed + documented (ticket lifecycle slice)

- [`frontend/src/components/TicketDetail.tsx`](../../frontend/src/components/TicketDetail.tsx) — ticket detail/actions and Maintenance handoff UI
- [`frontend/src/components/TicketTable.tsx`](../../frontend/src/components/TicketTable.tsx)
- [`frontend/src/lib/useAsync.ts`](../../frontend/src/lib/useAsync.ts) — list/detail loading behavior
- [`frontend/src/pages/CreateTicket.tsx`](../../frontend/src/pages/CreateTicket.tsx) — ticket creation flow
- [`frontend/src/pages/Dashboard.tsx`](../../frontend/src/pages/Dashboard.tsx) — queue filtering/search
- [`frontend/src/pages/MyTickets.tsx`](../../frontend/src/pages/MyTickets.tsx)
- [`backend/src/modules/tickets/repo.ts`](../../backend/src/modules/tickets/repo.ts)
- [`backend/src/modules/tickets/routes.ts`](../../backend/src/modules/tickets/routes.ts)
- [`backend/src/modules/tickets/rules.ts`](../../backend/src/modules/tickets/rules.ts)
- [`backend/src/modules/events/publish.ts`](../../backend/src/modules/events/publish.ts) — current ticket event call behavior
- [`backend/src/modules/comments/templates.ts`](../../backend/src/modules/comments/templates.ts) — system messages for ticket and Maintenance transitions
- [`database/migrations/0003_drop_assigned_status.sql`](../../database/migrations/0003_drop_assigned_status.sql)
- [`backend/test/tickets.rules.test.ts`](../../backend/test/tickets.rules.test.ts)

### Analyzed + documented (database)

- [`database/schema.sql`](../../database/schema.sql)
- [`database/clean-demo-data.sql`](../../database/clean-demo-data.sql) — read only; not executed
- [`database/migrations/0001_add_wellbeing_slug.sql`](../../database/migrations/0001_add_wellbeing_slug.sql)
- [`database/migrations/0002_final_features.sql`](../../database/migrations/0002_final_features.sql)
- [`database/migrations/0003_drop_assigned_status.sql`](../../database/migrations/0003_drop_assigned_status.sql)
- [`database/migrations/0004_guest_profiles.sql`](../../database/migrations/0004_guest_profiles.sql) — read only; not executed

### Analyzed + documented (comments/chat)

- [`backend/src/modules/comments/routes.ts`](../../backend/src/modules/comments/routes.ts)
- [`backend/src/modules/comments/rules.ts`](../../backend/src/modules/comments/rules.ts)
- [`backend/src/modules/comments/templates.ts`](../../backend/src/modules/comments/templates.ts)
- [`frontend/src/components/Chat.tsx`](../../frontend/src/components/Chat.tsx)
- [`frontend/src/pages/Messages.tsx`](../../frontend/src/pages/Messages.tsx)
- [`backend/test/comments.test.ts`](../../backend/test/comments.test.ts) — analyzed + documented; targeted run passed (10 tests)

### Analyzed + documented (Maintenance integration)

- [`backend/src/modules/maintenance/client.ts`](../../backend/src/modules/maintenance/client.ts)
- [`backend/src/modules/maintenance/envelope.ts`](../../backend/src/modules/maintenance/envelope.ts)
- [`backend/src/modules/maintenance/mapping.ts`](../../backend/src/modules/maintenance/mapping.ts)
- [`backend/src/modules/maintenance/routes.ts`](../../backend/src/modules/maintenance/routes.ts)
- [`backend/src/modules/maintenance/signature.ts`](../../backend/src/modules/maintenance/signature.ts)
- [`frontend/src/components/TicketDetail.tsx`](../../frontend/src/components/TicketDetail.tsx) — Maintenance UI flow
- [`backend/src/modules/comments/templates.ts`](../../backend/src/modules/comments/templates.ts) — repair-message caller
- [`scripts/send-mock-maintenance-event.mjs`](../../scripts/send-mock-maintenance-event.mjs)
- [`backend/test/maintenance.test.ts`](../../backend/test/maintenance.test.ts) — targeted run passed (32 tests)

### Analyzed + documented (events/escalation)

- [`backend/src/modules/events/escalation.ts`](../../backend/src/modules/events/escalation.ts) — implementation is currently a stub
- [`backend/src/modules/events/publish.ts`](../../backend/src/modules/events/publish.ts) — envelope builder and log-only publisher
- [`backend/src/index.ts`](../../backend/src/index.ts) — Worker entrypoint documented; scheduled handler also covered
- [`wrangler.toml`](../../wrangler.toml) — Worker bindings, static assets, vars, D1, and cron sections documented
- [`backend/test/escalation.test.ts`](../../backend/test/escalation.test.ts) — envelope test passed; 3 escalation tests skipped

### Analyzed + documented (admin/category slice)

- [`frontend/src/pages/Admin.tsx`](../../frontend/src/pages/Admin.tsx)
- [`backend/src/modules/admin/routes.ts`](../../backend/src/modules/admin/routes.ts) — documented as 501 stubs
- [`backend/src/modules/reference/routes.ts`](../../backend/src/modules/reference/routes.ts) — all five public endpoints documented
- Admin route guard in [`backend/src/index.ts`](../../backend/src/index.ts)
- No direct admin route tests found in the current `backend/test/` search

### Analyzed + documented (Wellbeing integration)

- [`backend/src/modules/wellbeing/routes.ts`](../../backend/src/modules/wellbeing/routes.ts)
- [`backend/src/modules/tickets/rules.ts`](../../backend/src/modules/tickets/rules.ts) — Wellbeing slug allowlist
- [`backend/src/modules/tickets/routes.ts`](../../backend/src/modules/tickets/routes.ts) — admin PATCH slug validation
- [`database/schema.sql`](../../database/schema.sql) and [`database/migrations/0001_add_wellbeing_slug.sql`](../../database/migrations/0001_add_wellbeing_slug.sql) — slug field
- [`backend/test/ai.test.ts`](../../backend/test/ai.test.ts) — matcher regression cases
- Frontend search: no caller for Wellbeing endpoints found; AI route label only

### Analyzed + documented (Worker/reference wiring)

- [`backend/src/index.ts`](../../backend/src/index.ts)
- [`backend/src/modules/reference/routes.ts`](../../backend/src/modules/reference/routes.ts)
- [`backend/src/core/config.ts`](../../backend/src/core/config.ts)
- [`backend/src/core/env.ts`](../../backend/src/core/env.ts)
- [`backend/src/core/auth.ts`](../../backend/src/core/auth.ts) — path-scoped guards
- [`backend/src/core/http.ts`](../../backend/src/core/http.ts) — middleware/error handler wiring
- [`wrangler.toml`](../../wrangler.toml) — runtime wiring sections
- [`backend/test/config.test.ts`](../../backend/test/config.test.ts) — `portalUrl` tests, 2 passed

### Analyzed + documented (remaining frontend shared UI/profile/styles)

- [`frontend/src/pages/Profile.tsx`](../../frontend/src/pages/Profile.tsx)
- [`frontend/src/components/ui.tsx`](../../frontend/src/components/ui.tsx)
- [`frontend/src/components/Icon.tsx`](../../frontend/src/components/Icon.tsx)
- [`frontend/src/components/Logo.tsx`](../../frontend/src/components/Logo.tsx)
- [`frontend/src/lib/format.ts`](../../frontend/src/lib/format.ts)
- [`frontend/src/lib/repair.ts`](../../frontend/src/lib/repair.ts)
- [`frontend/src/styles/app.css`](../../frontend/src/styles/app.css)

### Functions/modules explained so far

Detailed frontend items covered in `01-frontend-foundation.md`:

- Startup: `createRoot` composition and provider placement in `main.tsx`
- Routing: `subscribe`, `getPath`, `usePath`, `navigate`, `match`
- Application shell: `App`, role redirects, route selection, loading/login/error branches
- Identity: `read`, `write`, `sessionFromUrl`, `IdentityProvider`, `enter`, `signInGuest`, `continueAsSavedGuest`, `signInStaff`, `updateProfile`, `signOut`, `useIdentity`, `isStaff`, `isGuest`
- Login: `run`, `start`, `submit`
- Persisted UI state: `usePersisted`
- API client: `setApiUser`, `ApiError`, `NotReadyError`, `request`, `fix`, `post`, `patch`, and API method groups
- Backend core/auth: `verify`, `isGuestId`, `isAdmin`, `validateProfile`, `findIdentity`, `displayNames`, `createGuest`, `updateGuest`, `requireAuth`, `requireRole`, auth route `shape`, `readJson`, `parseId`, `portalUrl`, `correlationId`, `handleError`
- AI triage: `askAi`, `getResponseText`, `suggestFallback`, `validateAiOutput`, `pickSuggestion`, `recordSuggestion`, `getAiSuggestion`, `askSuggestion`, `applySuggestion`
- Ticket lifecycle: `validateCreate`, `ticketNumber`, `canViewTicket`, `editableFields`, `canResolve`, `canTransition`, `listTickets`, `insertTicket`, `updateTicket`, `recordStatus`, `getHistory`, `categoryIsActive`, `attachNames`, `patchTicket`, `loadVisible`, `nextStepForRequester`, `RequesterEdit`, `SystemSuggestion`, `AdminActions`
- Maintenance: `validateRepairRequest`, `validateWorkOrderId`, `parseWebhookEvent`, `fetchWorkOrder`, `createWorkOrder`, `errorMessage`, `mapWorkOrderStatus`, `nextTicketStatus`, `hmacHex`, `safeEqual`, `verifyWebhook`, `hasActiveWorkOrder`, `assertReadyForRepair`, `repairMessage`
- Events/escalation: `buildEnvelope`, `publishEvent`, `isEscalationDue`, `runEscalation`
- Admin/category: `Admin`, `add`, `toggle`, `notImplemented`, category listing with `all=true`
- Wellbeing: `getCatalogue`, `matchWellbeingSlug`, ticket-specific suggestion route
- Worker/reference: `api`/`app` composition, route mounts, auth guards, `scheduled`, `portalUrl`, category/user/config/tag/health endpoints
- Frontend shared UI/profile: `Profile`, `save`, `StatusBadge`, `PriorityText`, `StatusTrack`, `Notice`, `ErrorNotice`, `Loading`, `Field`, `Panel`, `Icon`, `Avatar`, `Logo`, `normalizeStatus`, `stageOf`, date/time helpers, `age`, `guessRepairCategory`

Pending deeper analysis: existing prose specifications/assignment guides are not reconciled line-by-line; binary docs, lockfile internals and secret templates remain deferred. No live D1 database, external Maintenance/Wellbeing service, or event hub was queried.
