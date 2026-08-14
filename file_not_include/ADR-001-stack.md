# ADR-001: เลือก deployment stack สำหรับ Helpdesk MVP

| Field | Value |
|---|---|
| **Status** | ✅ Accepted |
| **Date** | 2026-08-14 |
| **Deciders** | Team 14 (Helpdesk) |
| **Context doc** | `architecture.md` §1–7, `present_option.md` |
| **Supersedes** | — |
| **Superseded by** | — |

---

## Context

### โปรเจค
Helpdesk platform สำหรับนักศึกษา/บุคลากร MFU — สร้าง ticket, route, track, resolve (ดู `PRD_Helpdesk.md`)

### Constraints (จาก `requirement.md` §5)
- **CON-01** ทีม 3–5 คน (student)
- **CON-02** 1 เทอม (~4 เดือน)
- **CON-03** **0 บาท** — free-tier เท่านั้น
- **CON-04** ไม่มี microservices, ไม่มี K8s, ไม่มี message broker cluster
- **CON-05** External dependencies (Identity, Notification Hub, Maintenance) เป็น contracts — stub ได้
- **CON-06** ไม่มี LLM ใน request path
- **CON-10** Dependencies เป็น MIT/Apache/BSD เท่านั้น

### Data model + permission matrix ที่ขับเลือก stack
- `requirement.md` §4 มี role matrix 3 roles × 15 capabilities — **RLS ใน DB match 1:1**
- `DataModel.md` §11 มี FK, CHECK, enum, partial unique index, queue view ที่ join 3 ตาราง — **Postgres workload โดยธรรมชาติ**
- `DataModel.md` §10 capacity math: 200 tickets/day × ~5 KB × 365 d ≈ 365 MB/year → อยู่ใน 500 MB free tier

### Risk tolerance
- นักศึกษา primary dev → **findable answers ตอน 2 ทุ่มสำคัญกว่า 10 ms cold start**
- 1 เทอม → **time-to-first-screen ต้องเร็ว**
- 0 บาท → **quota กัด ไม่ได้**

---

## Decision

**เลือก Option A — Vercel + Supabase + Next.js**

```
Frontend  = Next.js 14+ (App Router) + TypeScript + Tailwind
Backend   = Next.js Route Handlers (Node runtime)
Database  = Supabase Postgres 15 (managed)
Auth      = Supabase Auth (OIDC client ของ campus Identity ใน prod)
AuthZ     = Postgres RLS (policies keyed off auth.uid() + role claim)
Events    = events outbox table + log fallback (synchronous publish)
Hosting   = Vercel Hobby (free) + Supabase Free
Local dev = `supabase start` + `next dev`
```

รายละเอียดทั้งหมดอยู่ใน `architecture.md` (อ่าน §3 "Option 1 — Vercel + Supabase" เป็นหลัก)

---

## Consequences

### ✅ ดี

1. **Schema fit 1:1**
   - FK, CHECK, enum, partial unique index, `ORDER BY priority, created_at JOIN category JOIN user` — Postgres ทำตรงๆ ใน 3 บรรทัด
   - ไม่ต้อง denormalize, ไม่มี inconsistency bug

2. **RLS = permission matrix ใน SQL**
   - `requirement.md` §4 → `CREATE POLICY` 1:1
   - API bug bypass ไม่ได้ (BR-02 enforcement อยู่ที่ DB)
   - ตรวจ audit ง่าย — อ่าน policy เดียวรู้เลยว่า role ไหนทำอะไรได้

3. **Quota ไม่กัด**
   - 500 MB DB ≈ 1 ปีการศึกษาที่ volume MVP
   - API requests ใจกว้าง (vs Firebase 50k reads/day ที่จะหมดเร็ว)

4. **On-ramp สั้น**
   - ทีม SQL เป็นอยู่แล้ว → 1–2 สัปดาห์ก็คล่อง
   - Next.js + Supabase เป็น stack ที่ AI code-assist + Stack Overflow มีคำตอบเยอะสุด

5. **One-command local dev (NFR-07)**
   - `supabase start` + `next dev` = 2 terminals, จบ
   - ไม่ต้องลง env แยก, ไม่ต้องขอ account

6. **Migration path สะอาด**
   - ถ้าเกิด outgrow Vercel/Supabase → schema เป็น Postgres ล้วน, app เป็น Next.js ล้วน
   - ไม่มี vendor-specific API ใน business logic

7. **Realtime เป็น checkbox**
   - ถ้าวันหลังอยาก live-update agent queue → Supabase Realtime เปิดได้ทันที ไม่ต้องเพิ่ม infra

### ⚠️ แลก

1. **Vercel cold start ~1 s หลัง idle**
   - Acceptable สำหรับ helpdesk (ไม่ใช่ trading app)
   - Mitigation: scheduled ping ก่อน demo (R8 ใน `architecture.md` §13)

2. **2 platforms (Vercel + Supabase) ต้องเรียนรู้**
   - แต่ concept overlap เยอะ + docs ทั้งคู่ดี
   - แลกกับได้ Postgres + RLS + Auth + Storage ในที่เดียว

3. **500 MB DB cap**
   - 1 ปีที่ volume 200/day = 365 MB ≈ 73% ของ quota
   - ไม่ใช่ปัญหาในเทอมนี้ แต่ต้อง monitor → ใส่ใน admin checklist

4. **Vercel Hobby: 10 s function timeout**
   - Fine สำหรับ 7 endpoints ของเรา
   - ห้ามทำอะไร CPU-heavy ใน request path (ก็ไม่ได้ทำ — ไม่มี LLM, ไม่มี PDF gen)

5. **Supabase Auth ไม่รู้จัก `role` column**
   - ต้อง promote role ผ่าน `scripts/promote.sql` หรือ custom JWT claim
   - Workaround: ใช้ Auth Hook ดึง role จาก `users` table ใส่ JWT

6. **Team ต้องเรียน RLS concept**
   - Day-1 task: port permission matrix → `CREATE POLICY` (R5 ใน `architecture.md` §13)
   - ใช้เวลาครึ่งวัน — เป็นทักษะ senior-level ที่ติดตัวไปอีก 10 ปี

---

## Alternatives Considered

### Option B — Cloudflare Workers + D1

**ปฏิเสธ** เพราะ:

| เหตุผล | น้ำหนัก |
|---|---|
| D1 = SQLite, ไม่ใช่ Postgres — ไม่มี native enum, JSONB, partial unique index ต้อง hack | 🔴 |
| V8 runtime (ไม่ใช่ Node) — npm library ที่ใช้ `fs`, `crypto.scrypt`, native binding ใช้ไม่ได้ | 🔴 |
| CPU time cap ~10 ms บน free Workers — ทำอะไรหนักๆ ไม่ได้ | 🔴 |
| Auth เป็นจุดอ่อนสุด — Cloudflare Access enterprise, Auth.js/Clerk = dependency เพิ่ม | 🟡 |
| Ecosystem เล็กกว่า — student dev หาคำตอบยากกว่า | 🟡 |

ถ้าโปรเจคเป็น stateless edge API ที่ไม่สน joins — Cloudflare จะแนะนำ. แต่โปรเจคนี้ **join 3 ตาราง** ใน queue view เป็น core path → Postgres ชนะ

### Option C — Firebase

**ปฏิเสธ** เพราะ:

| เหตุผล | น้ำหนัก |
|---|---|
| Queue view (sort by priority + age, join category + user) — **Firestore ทำตรงๆ ไม่ได้** ต้อง denormalize | 🔴 |
| Denormalization = `category_name`, `requester_name` ซ้ำในทุก ticket → rename = background job + inconsistency bug | 🔴 |
| Permission matrix ใน security rules: recursive rule ordering + ownership check = ฝันร้ายตอน debug (vs RLS 1 policy = 1 SQL) | 🔴 |
| Quota: 50k reads + 20k writes/day — agent 5 คน × 50 tickets/วัน ≈ 25k reads ของ queue/detail อย่างเดียว | 🔴 |
| Vendor lock-in สูง — Firestore-specific API = ย้ายไม่ได้ | 🟡 |
| Schema migration ลำบาก (เพิ่ม field = doc เก่าไม่มี → defensive code ทุกจุด) | 🟡 |

Rebut: "ทีมเรียน Firebase มาแล้ว"
- NoSQL mental model, Auth pattern, Firebase CLI → **skill เหล่านี้ใช้ได้ทุกที่ ไม่ได้หาย**
- ใหม่ที่จะได้: **SQL + Postgres + RLS** = ใช้ได้ทุก startup/enterprise ไม่ใช่ Firebase-only
- On-ramp 1–2 สัปดาห์ (ดู `present_option.md` §6)

---

## Compliance Check

ตรวจกับ constraints ใน `requirement.md` §5:

| Constraint | Pass? | Note |
|---|---|---|
| CON-01 (team size) | ✅ | Stack ที่ team หาคำตอบได้ทันที |
| CON-02 (timeline) | ✅ | One-command dev, AI assist แข็งแรง |
| CON-03 (0 THB) | ✅ | Vercel Hobby + Supabase Free ครอบคลุมทั้งเทอม |
| CON-04 (no microservices) | ✅ | 1 web app + 1 managed DB |
| CON-05 (external = contracts) | ✅ | Supabase Auth OIDC client, webhook stub-friendly |
| CON-06 (no LLM) | ✅ | Rules engine เป็น pure function |
| CON-10 (license) | ✅ | Next.js, Supabase, Postgres = MIT/Apache |
| NFR-01 (cost) | ✅ | รายละเอียดใน `architecture.md` §3 |
| NFR-07 (one-command dev) | ✅ | `supabase start` + `next dev` |
| NFR-13 (≥7 tests) | ✅ | 7 test cases ใน `acceptance_criteria.md` |

---

## Follow-ups

- [ ] **REF-1** เขียน `api_contract.md` (REST endpoints + event payloads) — owns: backend
- [ ] **REF-2** เขียน `acceptance_criteria.md` (Given/When/Then) — owns: QA + backend
- [ ] **REF-3** Day-1 task: port `requirement.md` §4 permission matrix → `CREATE POLICY` ใน migration แรก
- [ ] **REF-4** สร้าง project skeleton + commit แรกก่อนทำอย่างอื่น
- [ ] **REF-5** ตั้ง Supabase project (free tier) + link Vercel — owns: DevOps

---

## References

- `PRD_Helpdesk.md` — business PRD
- `Problem.md` — problem analysis, user journeys
- `requirement.md` — FR/NFR/BR/permission matrix
- `DataModel.md` — schema, constraints, capacity
- `architecture.md` — full architecture (Option 1 §3)
- `present_option.md` — option comparison, team-facing pitch
- [Postgres RLS docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth + RLS guide](https://supabase.com/docs/guides/auth/row-level-security)

---

*ห้าม override เอกสารนี้โดยไม่เขียน ADR-002 ใหม่ — ถ้าจะเปลี่ยน stack ต้องมีเหตุผลที่ทับเหตุผลใน Alternatives Considered ข้างบนได้*
