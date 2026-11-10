# Events & Escalation: scheduled checks, event envelopes, and delivery status

โค้ดกลุ่มนี้มี 2 แนวคิด: **domain events** สำหรับแจ้งการเปลี่ยนแปลง ticket ไปยังระบบอื่น และ **escalation** สำหรับตรวจ urgent ticket ที่ยังไม่มีคนเริ่มทำงานตามเวลา. สิ่งสำคัญคือ schema/config/type มีโครงสร้างรองรับไว้ แต่ implementation ของ event publishing และ escalation ยังเป็น TODO; cron trigger ที่ตั้งไว้จึงยังไม่ทำ escalation จริง

## 1. ไฟล์และการเชื่อมต่อ

| ไฟล์ | หน้าที่ |
|---|---|
| [`backend/src/modules/events/publish.ts`](../../../../backend/src/modules/events/publish.ts:14) | event types, envelope builder และ `publishEvent` ปัจจุบันที่ log-only |
| [`backend/src/modules/events/escalation.ts`](../../../../backend/src/modules/events/escalation.ts:14) | `isEscalationDue` และ scheduled `runEscalation`; ทั้ง logic ยัง stub |
| [`backend/src/index.ts`](../../../../backend/src/index.ts:79) | Worker `scheduled()` handler เรียก escalation job |
| [`wrangler.toml`](../../../../wrangler.toml:14) | Cron Trigger ตั้ง `*/15 * * * *` หรือทุก 15 นาที |
| [`database/schema.sql`](../../../../database/schema.sql:52) | `tickets.escalated_at` marker |
| [`database/schema.sql`](../../../../database/schema.sql:123) | `domain_events` outbox-shaped table และ delivery status index |
| [`backend/src/modules/tickets/routes.ts`](../../../../backend/src/modules/tickets/routes.ts:72) | call sites สำหรับ ticket created/status changed/resolved |
| [`backend/src/modules/maintenance/routes.ts`](../../../../backend/src/modules/maintenance/routes.ts:95) | call sites สำหรับ work-order link และ status change |
| [`backend/test/escalation.test.ts`](../../../../backend/test/escalation.test.ts:17) | envelope test ทำงาน; escalation rule tests ถูก skip |

## 2. Intended architecture เทียบกับ code ที่ทำงานจริง

```mermaid
flowchart TD
  Cron[Wrangler cron every 15 min] --> Scheduled[Worker scheduled handler]
  Scheduled --> Run[runEscalation]
  Run --> Query{Intended: urgent + open + not escalated?}
  Query -->|due after 1 hour| Marker[Set escalated_at]
  Marker --> PublishEsc[ticket.escalated]

  Route[Ticket/Maintenance route] --> Pub[publishEvent]
  Pub --> Build[buildEnvelope]
  Build --> IntendedOutbox[TODO: insert domain_events]
  IntendedOutbox --> IntendedHub[TODO: signed POST to Event Hub]

  Run -. current implementation .-> Stub[Returns { escalated: 0 }]
  Pub -. current implementation .-> Log[Logs event envelope subject/type only]
```

เส้นทางทึบในครึ่งบน/กลางคือสิ่งที่ comments/TODO ระบุว่า **ควรมี**; เส้นประระบุสิ่งที่ source ทำจริงในปัจจุบัน. อย่าสรุปจาก cron config หรือมี table `domain_events` เพียงอย่างเดียวว่า escalation/event delivery ใช้งานแล้ว

## 3. Domain event contract

### 3.1 Event types

`DomainEventType` ใน [`publish.ts`](../../../../backend/src/modules/events/publish.ts:14) อนุญาต compile-time values:

- required: `ticket.created`, `ticket.escalated`, `ticket.resolved`
- supporting: `ticket.status_changed`, `ticket.work_order_linked`

ข้อความ/ชื่อ event ไม่ถูก validate runtime ใน `publishEvent`; type safety มาจาก TypeScript callers

### 3.2 `buildEnvelope(type, ticket, extra)`

[`buildEnvelope(...)`](../../../../backend/src/modules/events/publish.ts:36) สร้าง object:

- `eventId`: `crypto.randomUUID()`
- `type`: event type ที่ caller ส่ง
- `occurredAt`: ISO timestamp ปัจจุบัน
- `source`: คงที่ `helpdesk`
- `subject`: `ticket:<ticket_number>`
- `data`: `ticketId`, `ticketNumber`, `status`, `priority`, `categoryId`, `requesterId`, แล้ว merge `extra`

Envelope ไม่ใส่ ticket description, requester name หรือ email; แต่ `requesterId` ยังคงเป็น identifier ที่ส่งออก ไม่ใช่ anonymous record. `extra` ถูก spread หลัง fields พื้นฐาน จึงสามารถ override key ที่ชื่อชนกันได้ถ้ามี caller ส่ง key ซ้ำ; current call sites ส่ง metadata อย่าง `from`, `source`, `workOrderId`

### 3.3 `publishEvent(...)`: actual behavior

[`publishEvent(env, type, ticket, extra)`](../../../../backend/src/modules/events/publish.ts:69) ปัจจุบัน:

1. เรียก `buildEnvelope`.
2. ไม่ได้ใช้ `env` (`void env`).
3. `console.log` JSON ที่มี `level`, message `event (not yet delivered — TODO P2)`, `type`, `subject`.
4. catch synchronous/build error แล้ว `console.error`; ไม่ rethrow.

ดังนั้นตอนนี้ไม่มีการ `INSERT` `domain_events`, ไม่ POST ไป Event Hub, ไม่สร้าง signature, ไม่อัปเดต `delivery_status` และไม่มี retry counter. ค่า `EVENT_HUB_URL`/`EVENT_SIGNING_SECRET` ใน bindings ยังไม่ได้ถูกใช้งานใน publisher implementation ที่อ่าน

`domain_events` มี fields ที่เตรียมไว้สำหรับ pending/delivered/failed/skipped, attempts และ timestamps; ความพร้อมของ schema ไม่เท่ากับความพร้อมของ publisher

## 4. `isEscalationDue` และ `runEscalation`

### Intended rule

Comment ใน [`escalation.ts`](../../../../backend/src/modules/events/escalation.ts:1) กำหนดเงื่อนไขที่ต้องครบ:

1. `priority === 'urgent'`
2. `status === 'open'` (admin ยังไม่เริ่มงาน)
3. รอนานกว่า 1 ชั่วโมง (`ESCALATION_WAIT_MS = 60 * 60 * 1000`)
4. ยังไม่เคย escalate (`escalated_at == null`)

TODO ระบุว่า D1 `created_at` รูปแบบ `YYYY-MM-DD HH:MM:SS` เป็น UTC และควร parse โดยเติม `T`/`Z` ก่อนคำนวณเวลา

### Actual implementation

- [`isEscalationDue(ticket, now)`](../../../../backend/src/modules/events/escalation.ts:23) รับ ticket fields และ `Date`, แต่ปัจจุบัน `void ticket; void now; return false`.
- [`runEscalation(env)`](../../../../backend/src/modules/events/escalation.ts:38) ปัจจุบันไม่ query D1, ไม่ update `escalated_at`, ไม่เรียก `publishEvent` และคืน `{ escalated: 0 }` เสมอ.
- `ESCALATION_WAIT_MS` มีค่าคงที่ตาม requirement แต่ยังไม่ถูกใช้โดย implementation ปัจจุบัน.

### Scheduler wiring

ใน [`wrangler.toml`](../../../../wrangler.toml:14) ตั้ง cron `*/15 * * * *`. Worker export ใน [`index.ts`](../../../../backend/src/index.ts:79) มี `scheduled` handler ซึ่งเรียก `ctx.waitUntil(runEscalation(env).then(...console.log...))`. Cron จึง trigger stub ทุก 15 นาที; สิ่งที่ runtime log ได้คือ escalation run with `escalated: 0`. หน้า dashboard มีข้อความแจ้งว่าจะ escalate urgent ticket ที่ยังไม่เริ่มภายในหนึ่งชั่วโมง แต่เป็น UI description ของ intended feature ไม่ใช่หลักฐานว่า job ทำงานแล้ว

## 5. Event call sites ที่ค้นพบ

จาก route/source search:

- `ticket.created`: หลัง insert ticket + status history ใน ticket create route.
- `ticket.resolved`: route resolve และ PATCH เมื่อ status เปลี่ยนเป็น resolved.
- `ticket.status_changed`: PATCH status changes อื่น และ Maintenance webhook เมื่อ Helpdesk status เปลี่ยน.
- `ticket.work_order_linked`: Maintenance send/link routes.
- `ticket.escalated`: ปรากฏใน type/TODO เท่านั้น; escalation stub ยังไม่ publish.
- `ticket.commented`: มี TODO ใน comments route, แต่ไม่มี event type ใน current `DomainEventType` union.

เนื่องจาก `publishEvent` log-only, call site เหล่านี้ไม่ได้สร้าง durable outbound event ในปัจจุบัน

## 6. Tests

[`backend/test/escalation.test.ts`](../../../../backend/test/escalation.test.ts:17) มี:

- Active event envelope test: type/source/subject/event id และไม่มี description/email.
- `describe.skip` สำหรับ escalation tests: should escalate urgent open ticket > 1 hour; should not escalate before threshold; should not escalate started/non-urgent/already-escalated ticket.
- File header ระบุเอา `.skip` ออกเมื่อ `isEscalationDue` implementation เสร็จ.

Expected outcomes ใน skipped tests เป็น test specification เท่านั้น ไม่ใช่ behavior ที่ currently passes. Maintenance event publishing หรือ outbox delivery ก็ไม่ได้มี integration test ที่ทำให้ TODO กลายเป็น implemented behavior

## 7. ผลต่อระบบและสิ่งที่ต้องระวัง

1. **Escalation feature is not implemented:** urgent ticket จะไม่ถูกตั้ง `escalated_at` และไม่มี `ticket.escalated` event จาก cron.
2. **Outbound events are not delivered:** callers อาจดูเหมือน publish สำเร็จเพราะฟังก์ชันไม่ throw แต่ปัจจุบันเพียง log.
3. **Outbox table unused by this publisher:** monitoring `domain_events.delivery_status` จะไม่พบ rows จาก current `publishEvent`.
4. **Cron cadence vs threshold:** หาก implement ตาม TODO, cron 15 นาทีทำให้ตรวจพบหลัง crossing 1-hour threshold ได้ช้าสุดเกือบหนึ่งรอบ cron (implementation ยังไม่ทำ จึงไม่ควรบอก SLA ว่าทำงานแล้ว).
5. **Privacy envelope:** description/email/name ไม่ถูกใส่; `requesterId` และ ticket/category IDs ยังเป็น identifiers และควรคุมตาม outbound contract.
6. **Type union vs future consumers:** เพิ่ม event type ต้องตรวจ callers, envelope, downstream contract และ tests; `ticket.commented` ยังไม่อยู่ใน union.

## 8. ตัวอย่าง execution ปัจจุบัน

สมมติ Worker ได้ cron event:

1. Wrangler trigger ตามทุก 15 นาที.
2. `scheduled(_event, env, ctx)` เรียก `runEscalation(env)` ผ่าน `ctx.waitUntil`.
3. `runEscalation` ไม่อ่าน database และคืน `{ escalated: 0 }`.
4. `.then(...)` log JSON `msg: 'escalation run'` พร้อม `escalated: 0`.

แม้มี ticket ที่ urgent/open/เกิน 1 ชั่วโมงใน D1 ผล runtime ปัจจุบันยังเป็น 0 เพราะ condition/query loop ยังเป็น TODO

## 9. ขอบเขตที่ยัง pending

บทนี้ครอบคลุม event/escalation code ที่ตรวจแล้ว แต่ยังไม่ได้วิเคราะห์ admin UI, wellbeing/reference features, full entrypoint/config, CI และ operational deployment. Progress รายไฟล์อยู่ใน [`DOCUMENTATION_PROGRESS.md`](../../DOCUMENTATION_PROGRESS.md)
