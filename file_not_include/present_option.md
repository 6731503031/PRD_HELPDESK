# Option Comparison — Helpdesk Platform

> เอกสารสำหรับเสนอทีม: เลือก deployment option ไหนดีสำหรับโปรเจค Helpdesk
> **ทีม:** 3–5 คน · **เวลา:** 1 เทอม · **งบ:** 0 บาท · **โครงสร้าง:** simple, ไม่มี microservices

---

## 1. ตัวเลือกทั้ง 3 ที่อาจารย์ส่งมา

| Option | Frontend | Backend | Database | Auth | Storage | Deploy |
|---|---|---|---|---|---|---|
| **A** | Next.js | Next.js Server/API | Supabase Postgres | Supabase Auth | Supabase Storage | Vercel |
| **B** | React | Cloudflare Worker + Hono | D1 | (ต้องประกอบเอง) | R2 | Cloudflare |
| **C** | React | Firebase SDK / Functions | Firestore | Firebase Auth | Firebase Storage | Firebase Hosting |

---

## 2. Side-by-side comparison

| มิติ | A · Supabase | B · Cloudflare | C · Firebase |
|---|---|---|---|
| **DB model** | Postgres ✅ | SQLite | NoSQL (Firestore) |
| **Schema: FK / enum / CHECK** | Native | บางส่วน | ❌ ทำเอง + denormalize |
| **Join (queue view)** | SQL ง่าย ✅ | ทำได้แต่ไม่สะดวก | ❌ ต้อง denormalize |
| **Permission model** | **RLS ใน DB** ✅ | app-level | security rules |
| **Auth setup** | 5 นาที | ต้องประกอบเอง (Auth.js/Clerk) | **5 นาที** ✅ |
| **Free-tier DB** | 500 MB | 5 GB | 1 GB |
| **Free-tier requests** | ใจกว้าง | 100k req/day | **50k reads + 20k writes/day** ⚠️ |
| **Learning curve (ทีม ม.)** | ต่ำ (SQL รู้จักกันอยู่แล้ว) | ปานกลาง (V8 runtime) | ต่ำ (ถ้าเคยใช้) |
| **Vendor lock-in** | ต่ำ (OSS, self-host ได้) | ต่ำ | **สูง** |
| **Portfolio value** | SQL + Postgres (ใช้ได้ทุกที่) | Edge / Workers | Firebase-only |
| **Local dev** | `supabase start` ✅ | `wrangler dev` | Emulator Suite |
| **Cold start** | เล็กน้อย | น้อยมาก | เล็กน้อย |

---

## 3. 🎯 คำแนะนำ: เลือก **Option A — Supabase**

**ไม่ใช่เพราะ Firebase ไม่ดี แต่เพราะ data model ของโปรเจคนี้ตรงกับ Postgres ไม่ตรงกับ Firestore**

---

## 4. Supabase vs Firebase — เจาะลึก (เพราะทีมมีคนเรียน Firebase มาแล้ว)

### 4.1 จุดที่ Firebase ทำได้ดี (ยอมรับตรงๆ)

- ✅ Auth ง่ายที่สุด — ตั้งค่า 5 นาที
- ✅ Real-time sync — แต่โปรเจคนี้ไม่ได้ใช้
- ✅ Prototype เร็ว — สำหรับ simple data shape
- ✅ มีคนในทีมมี experience แล้ว

### 4.2 จุดที่ Firebase จะ "ติดขัด" สำหรับโปรเจคนี้

#### 🔴 1) Queue view ทำตรงๆ ไม่ได้ใน Firestore

เราต้อง query แบบนี้:

```
ทุก ticket
  เรียงตาม priority (Urgent → Low)
  แล้วตาม created_at (เก่าสุดก่อน)
  join กับ category (เอาชื่อ)
  join กับ user (เอาชื่อ requester + assignee)
```

| ใน Postgres (Supabase) | ใน Firestore |
|---|---|
| 1 SQL query, 3 บรรทัด | ❌ join ไม่ได้ |
| `ORDER BY priority, created_at` | ❌ order หลาย field ต้อง composite index |
| join ได้ตรงๆ | ❌ ต้อง **denormalize** = เก็บ `category_name` + `requester_name` ซ้ำในทุก ticket document |

**ผลกระทบของ denormalization:**
- Category เปลี่ยนชื่อ → ต้องวน update ทุก ticket (background job)
- User เปลี่ยนชื่อ → ต้องวน update ทุก ticket ที่เขาเคยสร้าง/เคยรับ
- ถ้าพลาด = **inconsistency bug** = ticket แสดงชื่อเก่า

#### 🔴 2) Permission matrix ยากกว่าที่คิด

ใน `requirement.md` §4 มี 3 roles × ~15 capabilities:

- **Supabase RLS:** เขียน `CREATE POLICY` ใน SQL ตรงจากตาราง role matrix — DB บังคับใช้เอง, **API bug bypass ไม่ได้**
- **Firestore rules:** เขียนได้ แต่พอ rule ซับซ้อน (เช็ค role + เช็ค ownership พร้อมกัน) test ยาก, debug ยาก

ตัวอย่างที่ทีมจะเจอ:

> "Requester เห็นแค่ ticket ตัวเอง, ยกเว้น ticket ที่ถูก assign ให้ตัวเอง, ยกเว้น ticket ที่ตัวเองเคย comment, ยกเว้น ..."

ใน RLS: 1 policy เขียนตรงๆ ใน SQL
ใน Firestore rules: ต้องคิดเรื่อง rule ordering + recursive checks = ฝันร้ายตอน debug

#### 🔴 3) Quota จะกัดเร็วกว่าที่คิด

| | Supabase Free | Firebase Free (Spark) |
|---|---|---|
| DB / storage | 500 MB | 1 GB |
| API requests | ใจกว้าง (ภายในเหตุผลสม) | **50k reads/day + 20k writes/day** |

ลองคำนวณ agent ใช้งานจริง:

```
Agent เปิด queue       → 1 read (100 tickets metadata)
เปิด ticket detail    → 1 read
โหลด comments         → 1 read
...
= ~103 reads ต่อการคลิก 1 ticket

Agent 5 คน × 50 tickets/วัน = ~25,750 reads/วัน (จาก queue + detail อย่างเดียว)
+ Requester เปิดหน้า my-tickets + create ticket + add comment
+ Real-time listener (ถ้าเปิด)
```

**50k reads/day หมดก่อนจบเทอม** ถ้ามีคนใช้จริง

#### 🟡 4) Migrations / schema evolution ลำบาก

- Postgres: เปลี่ยน schema ครั้งเดียว, `ALTER TABLE`, migration file, จบ
- Firestore: เพิ่ม field ใหม่ = เอกสารเก่าไม่มี field นั้น = ต้องเขียน defensive code ทุกจุดที่อ่าน + บางทีต้อง backfill script

---

## 5. Cloudflare (Option B) — ทำไมไม่แนะนำ

- ⚠️ **D1 = SQLite** ไม่ใช่ Postgres — ไม่มี enum, ไม่มี JSONB, partial unique index ต้อง hack
- ⚠️ **V8 runtime** — หลาย npm library ใช้ไม่ได้ (พวก `fs`, `crypto.scrypt`, native binding)
- ⚠️ **CPU time cap ~10ms** บน free Workers — ทำอะไรหนักๆ ไม่ได้
- ⚠️ **Auth ต้องประกอบเอง** — Cloudflare Access เป็น enterprise, ต้องใช้ Auth.js/Clerk เพิ่ม
- ⚠️ D1 FK enforcement เพิ่ง mature เมื่อไม่นานมานี้ — ecosystem ยังไม่แน่น

**ถ้าทีมอยากลอง Cloudflare:** ใช้ได้ แต่จะเจียร์ friction เล็กๆ หลายจุด ไม่คุ้มกับเวลาที่เหลือในเทอม

---

## 6. "แต่เราเรียน Firebase มาแล้ว" — แล้วยังคุ้มไหมที่จะเปลี่ยน?

### ✅ คุณไม่ได้เสียอะไร — skill ที่ได้จาก Firebase ยังอยู่

- NoSQL mental model ✅
- Auth pattern ✅
- Firebase CLI / Emulator ✅
- ประสบการณ์ auth + deploy flow ✅

### 🆕 สิ่งที่จะได้เพิ่มจาก Supabase

- **SQL + Postgres** — ใช้ได้ทุกที่ตลอดอาชีพ (ทุก startup / enterprise มี Postgres)
- **Row Level Security** — concept ที่ไม่มีใน Firebase, เป็นทักษะ senior-level
- **Migration workflow** — เรื่อง schema ที่ scale ได้
- **Supabase Realtime** — ถ้าวันหลังอยากได้ real-time ก็มีให้ใช้

### ⏱️ On-ramp ไม่นาน

ถ้าเพื่อนในทีมเรียน database ผ่าน (เรียน SQL มาเกือบทุกคน) → ช่วง on-ramp **1–2 สัปดาห์** ก็คล่อง

ส่วน Firebase ถ้าทีมไม่มีใครเคยใช้จริงในโปรเจค production — queue view + permission rules ที่ผมว่าไปข้างบน จะกินเวลามากกว่า

---

## 7. 📊 One-line pitch ให้เพื่อน

> "Schema มี FK + queue view ที่ต้อง join = เหมาะ SQL ไม่เหมาะ NoSQL.
> Supabase = Postgres + Auth + RLS ที่ map permission matrix ตรงตาม requirement.md ได้แบบ 1:1,
> quota ไม่กัด, SQL เป็น skill ใช้ได้ทุกที่ ไม่ใช่ Firebase-only."

---

## 8. ⚖️ ถ้าทีมตัดสินใจเลือก option อื่น ทำได้ไหม?

**ได้ครับ** — `architecture.md` เป็น "ตัวเลือกที่แนะนำ" ไม่ใช่ "ข้อสรุปสุดท้าย"

| ทีมเลือก | สถานะ |
|---|---|
| **A · Supabase** | ✅ **เลือกแล้ว (2026-08-14)** — ใช้ `architecture.md` ที่มีอยู่ได้เลย ไม่ต้องแก้ |
| **C · Firebase** | ❌ ผมเขียน architecture ใหม่ทั้งหมด: denormalization plan, security rules, quota budgeting, queue view แบบ Firestore |
| **B · Cloudflare** | ❌ แก้ได้เหมือนกัน แต่เตือนไว้ก่อนว่า D1 + V8 runtime จะมี friction |

> **บันทึกการตัดสินใจ:** ดูรายละเอียดใน `ADR-001-stack.md` (Context, Decision, Consequences, Alternatives considered)

---

## 9. 📝 ข้อแนะนำเพิ่ม

ไม่ว่าจะเลือกอะไร — **เขียน ADR (Architecture Decision Record) สั้นๆ 1 หน้าเก็บไว้**

รูปแบบ:

```markdown
# ADR-001: เลือก deployment stack

## Context
โปรเจค Helpdesk, ทีม 3-5 คน, 1 เทอม, งบ 0 บาท

## Decision
เลือก Option A: Vercel + Supabase

## Consequences
### ดี
- Postgres ตรงกับ data model
- RLS = permission enforcement ที่ DB

### แลก
- Cold start เล็กน้อยบน Vercel
- เรียนรู้ Supabase Auth + RLS ใหม่ (แต่ SQL ใช้เดิม)

## Alternatives considered
- Option B (Cloudflare): ปฏิเสธเพราะ D1 + V8 runtime friction
- Option C (Firebase): ปฏิเสธเพราะ queue view ต้อง denormalize + quota กัด
```

ADR นี้ช่วย 2 อย่าง:
1. อาจารย์เห็นเหตุผลชัดเจน
2. กันทีมเถียงกันตอนกลางเทอม ("ทำไมเลือก Supabase วะ")

---

## 10. 🎬 Next steps หลังตัดสินใจ

1. ✅ ทีมโหวตเลือก option (15 นาที)
2. 📝 เขียน ADR-001 (30 นาที)
3. 🔌 `api_contract.md` — REST endpoints + event payloads
4. ✅ `acceptance_criteria.md` — แปลง NFR-13 + BR เป็น Given/When/Then
5. 🧱 สร้าง skeleton โปรเจค — `create-next-app` + `supabase init` + migrations แรก
