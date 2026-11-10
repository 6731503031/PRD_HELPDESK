# คู่มือเรียนรู้โค้ด Helpdesk Platform

เอกสารชุดนี้อธิบายโค้ดจาก implementation จริง โดยเรียงจากภาพรวมไปสู่โมดูลและ workflow แต่ละส่วน ใช้ภาษาไทยเป็นหลัก และคงชื่อไฟล์ ฟังก์ชัน type และคำศัพท์เทคนิคเป็นภาษาอังกฤษเพื่อให้ค้นใน codebase ได้ตรงกัน

> สถานะปัจจุบัน: บันทึกความคืบหน้าอยู่ที่ [`DOCUMENTATION_PROGRESS.md`](DOCUMENTATION_PROGRESS.md) เอกสารที่มีอยู่ยังเป็นเพียงบางส่วนของ frontend/backend/database ไม่ใช่การอธิบายครบทั้งระบบ

## อ่านตามลำดับ

1. [`08-file-explanations/frontend/01-frontend-foundation.md`](08-file-explanations/frontend/01-frontend-foundation.md) — จุดเริ่มต้นของเว็บ, route แบบ hash, demo identity, API client และตัวอย่างการ sign in
2. [`08-file-explanations/frontend/02-shared-ui-profile-and-styles.md`](08-file-explanations/frontend/02-shared-ui-profile-and-styles.md) — Profile, shared UI, icons/avatar, formatting, repair helpers and design tokens
3. [`08-file-explanations/backend/01-core-identity-and-auth.md`](08-file-explanations/backend/01-core-identity-and-auth.md) — shared Worker types, demo identity, guest profiles, auth middleware, auth routes และ HTTP error helpers
4. [`08-file-explanations/backend/02-ai-triage.md`](08-file-explanations/backend/02-ai-triage.md) — AI prompt, response validation, keyword fallback, UI handoff และ background persistence
5. [`08-file-explanations/backend/03-ticket-lifecycle.md`](08-file-explanations/backend/03-ticket-lifecycle.md) — ticket creation/list/detail/edit/resolve/delete, permission/rule gaps, D1 access และ frontend/admin flow
6. [`08-file-explanations/database/01-schema-and-migrations.md`](08-file-explanations/database/01-schema-and-migrations.md) — ER model, table purpose, migration history, safe-vs-destructive operations
7. [`08-file-explanations/backend/04-comments-and-chat.md`](08-file-explanations/backend/04-comments-and-chat.md) — comment routes, visibility/validation, system messages, frontend polling and sending
8. [`08-file-explanations/backend/05-maintenance-integration.md`](08-file-explanations/backend/05-maintenance-integration.md) — work-order REST calls, admin link flow, HMAC webhook security, status mapping and D1 effects
9. [`08-file-explanations/backend/06-events-and-escalation.md`](08-file-explanations/backend/06-events-and-escalation.md) — cron wiring, event envelope, log-only publisher and unimplemented escalation behavior
10. [`08-file-explanations/backend/07-admin-and-categories.md`](08-file-explanations/backend/07-admin-and-categories.md) — admin stats/category UI, protected routes, and current 501 stubs
11. [`08-file-explanations/backend/08-wellbeing-integration.md`](08-file-explanations/backend/08-wellbeing-integration.md) — catalogue proxy/cache, keyword suggestion, access rules, and current frontend wiring status
12. [`08-file-explanations/backend/09-worker-entrypoint-and-reference.md`](08-file-explanations/backend/09-worker-entrypoint-and-reference.md) — Worker middleware/routes, auth boundaries, public reference endpoints, config and health
13. [`05-tests-and-coverage.md`](05-tests-and-coverage.md) — full Vitest results, skipped cases, and coverage boundaries
14. [`06-operational-tooling-and-audit.md`](06-operational-tooling-and-audit.md) — commands, CI, scripts, legacy Postman contract and completeness boundaries
15. เอกสารส่วนอื่น ๆ จะเพิ่มหลังตรวจ source ของแต่ละโมดูล และจะบันทึกสถานะไว้ใน progress file

## หลักการและขอบเขต

- คำอธิบายของพฤติกรรมจะอ้างอิง source ที่อ่านแล้ว ไม่อนุมานจากชื่อไฟล์หรือเอกสาร requirement เพียงอย่างเดียว
- ตัวอย่างโค้ดที่ยกมาเป็น excerpt จาก source จริง และย่อเฉพาะส่วนที่ไม่จำเป็นต่อประเด็น
- เอกสารจะระบุส่วนที่ยังไม่ได้ตรวจ แทนการสรุปว่าครอบคลุมครบถ้วน
- ไฟล์ secret เช่น [`.env`](../../.env) จะไม่ถูกอ่านหรือคัดลอกลงเอกสาร
- ไม่มีการเปลี่ยนแปลง source code ในรอบนี้
