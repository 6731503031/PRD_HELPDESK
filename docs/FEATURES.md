# Helpdesk Platform (Team 14): ฟีเจอร์และผู้ใช้ทั้งหมด

อ้างอิง **PRD v1.0 Final** ของทีม และ PRD กลางของรายวิชา (University Digital Campus)
อัปเดตล่าสุด: 8 พ.ย. 2026 (branch `feat/final-scaffold`)

> สัญลักษณ์: ✅ ใช้งานได้แล้ว · 🖥️ หน้าจอพร้อม รอ backend · ⏳ ยังไม่ได้ทำ (มี TODO ในโค้ด) · 🔸 ไม่บังคับ

---

## 1. ระบบนี้ทำอะไร (สรุป 3 บรรทัด)

1. นักศึกษาและบุคลากร **แจ้งปัญหา** แล้วได้เลขคำร้อง (เช่น `TKT-00012`) ไว้ติดตาม
2. ผู้ดูแลระบบ (admin) **คัดกรอง คุยกับผู้แจ้ง ผูกใบงานซ่อม และปิดงาน** จากแดชบอร์ดเดียว (ระบบมี 2 role: ผู้แจ้ง + admin ไม่มีเจ้าหน้าที่/การมอบหมายงาน ตาม PRD 1.1)
3. ถ้าเป็นงานซ่อม จะ **ผูกกับใบงานของฝ่ายซ่อมบำรุง (Team 10)** และสถานะงานซ่อมจะส่งกลับมาแสดงบนคำร้องอัตโนมัติ

> หลักสำคัญ: **Helpdesk เป็นเจ้าของ Ticket เท่านั้น** ข้อมูลผู้ใช้เป็นของ Identity ใบงานซ่อมเป็นของ Maintenance เราเก็บแค่เลขอ้างอิง

---

## 2. ผู้ใช้มีกี่ประเภท

ระบบมี **ผู้ใช้ (คน) 3 ประเภท** และ **ระบบภายนอก 5 ระบบ** ที่ Helpdesk เชื่อมด้วย

### 2.1 ผู้ใช้ 3 ประเภท (role)

| Role ในระบบ | ชื่อในหน้าเว็บ | คือใคร | ทำอะไรได้ | เห็นเมนู |
|---|---|---|---|---|
| `customer` | ผู้แจ้ง (Requester) | นักศึกษา อาจารย์ บุคลากร | สร้างคำร้อง ดูเฉพาะคำร้องของตัวเอง ดูสถานะและประวัติ เขียนข้อความสาธารณะ แก้คำร้องได้ตอนยังไม่เริ่มดำเนินการ | แจ้งปัญหาใหม่, คำร้องของฉัน |
| `admin` | ผู้ดูแลระบบ (Admin) | ผู้ดูแล Helpdesk | จัดการหมวดหมู่ ดูคำร้องทั้งหมดในแดชบอร์ด คัดกรอง (หมวด/ความเร่งด่วน/สถานะ) แชทกับผู้แจ้ง เขียนบันทึกภายใน ผูกใบงานซ่อม Team 10 ปิดงาน ลบคำร้อง | แดชบอร์ด, จัดการหมวดหมู่ |

### 2.2 ผู้ใช้ทดสอบ (Identity stub) — 4 คน

เข้าใช้ผ่านหน้า **เข้าสู่ระบบ** → "เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย" → เลือกบัญชีทดสอบ (ไม่มีช่องรหัสผ่าน เพราะ PRD ห้าม Helpdesk เก็บรหัสผ่าน) หรือเปิดลิงก์ `?as=<id>` · ใน Postman ส่ง header `x-user-id` / `x-user-role`

| id | ชื่อ | role |
|---|---|---|
| 1 | Alice Customer | customer |
| 2 | Bob Customer | customer |
| 6 | Charlie Customer | customer |
| 5 | Admin User | admin |

> ผู้ใช้เป็น **Identity stub** ตามที่ PRD §20 อนุญาต (ไม่เชื่อมกับทีมอื่น) รายชื่ออยู่ที่ `backend/src/core/identity.ts`

### 2.3 ระบบภายนอกที่เกี่ยวข้อง

| ระบบ | ทีม | ความสัมพันธ์กับเรา | สถานะ |
|---|---|---|---|
| Maintenance | Team 10 | เราผูกใบงาน (REST) / เขาส่งสถานะงานซ่อมมา (webhook) | ส่ง proposal แล้ว รอตอบ |
| Wellbeing | Team 16 | เราอ่าน catalogue บริการสาธารณะ | ✅ เสร็จแล้ว (A5) |

---

## 3. หน้าจอ (5 หน้า)

| หน้า | URL | ใครใช้ | PRD |
|---|---|---|---|
| เข้าสู่ระบบ | `/` (เมื่อยังไม่ล็อกอิน) | ทุกคน | FR-01 |
| แจ้งปัญหาใหม่ | `/#/new` | ทุกคน | FR-03, §8 |
| คำร้องของฉัน + รายละเอียด | `/#/my`, `/#/my/12` | ทุกคน | FR-05, FR-06 |
| แดชบอร์ดผู้ดูแล (ตัวเลขสรุป + รายการ / รายละเอียด + แชท + การดำเนินการ) | `/#/queue`, `/#/queue/12` | admin | FR-08, FR-10–FR-13, §6 |
| ผู้ดูแลระบบ | `/#/admin` | admin | §2 Admin |

PRD กลางบังคับ 3 หน้าหลัก: **แจ้งปัญหา / สถานะคำร้องของฉัน / คิวงาน** → ครบ หน้า Admin เป็นของเสริม

---

## 4. ฟีเจอร์ทั้งหมด 30 ข้อ

### A. ผู้ใช้และสิทธิ์ — ผู้รับผิดชอบ P1

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F01 | เข้าระบบผ่าน Identity (Helpdesk ไม่เก็บรหัสผ่าน) มีหน้าเข้าสู่ระบบ + ออกจากระบบ | FR-01 | ✅ stub |
| F02 | รับข้อมูลผู้ใช้ + role | FR-02 | ✅ |
| F03 | ผู้แจ้งเห็นเฉพาะคำร้องของตัวเอง | FR-07, BR-01 | ✅ |
| F28 | ตรวจสิทธิ์ตาม role ฝั่ง server ทุก endpoint | §13 | ✅ |

### B. คำร้อง (Ticket) — P1

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F04 | สร้างคำร้อง (หัวเรื่อง รายละเอียด หมวด ความเร่งด่วน) + ออกเลขไม่ซ้ำ | FR-03 | ✅ |
| F05 | คำร้องของฉัน `GET /tickets/me` | FR-05 | ✅ |
| F06 | รายละเอียด + สถานะ + **ประวัติสถานะ** + ผลการแก้ไข | FR-06 | ✅ (ส่วนข้อความรอ F11) |
| F07 | แดชบอร์ด admin เรียงตามความเร่งด่วน แล้วตามเวลาที่รอ | FR-08 | ✅ |
| ~~F08~~ | ~~มอบหมายงาน~~ ตัดออกใน PRD 1.1 (ไม่มี role เจ้าหน้าที่) | ~~FR-09~~ | ❌ ตัด |
| F09 | คัดกรอง: เปลี่ยนหมวด ความเร่งด่วน สถานะ | FR-10 | ✅ |
| F10 | ปิดงานพร้อมสรุปการแก้ไข | FR-13 | ✅ |
| F25 | บังคับลำดับสถานะ Open → InProgress → Resolved → Closed | §14 | ⏳ P1 (`canTransition`) |

### C. ข้อความ (Comments) — P2

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F11 | ข้อความสาธารณะ (ผู้แจ้ง + admin) ในรูปแบบแชท | FR-11 | ✅ |
| F12 | บันทึกภายใน (ผู้แจ้งมองไม่เห็น) | FR-12, BR-03 | ✅ |

### D. Events — P2

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F15 | ส่ง `ticket.created` | FR-04 | ⏳ P2 (จุดเรียกต่อไว้แล้ว) |
| F16 | ส่ง `ticket.resolved` | FR-13 | ⏳ P2 (จุดเรียกต่อไว้แล้ว) |
| F17 | ส่ง `ticket.escalated` เมื่อ ด่วนมาก + เปิดใหม่ + ไม่มีผู้รับ + รอ > 1 ชม. (cron ทุก 15 นาที) | §14, BR-07 | ⏳ P2 (cron ต่อไว้แล้ว) |
| F18 | events เสริม `status_changed` / `work_order_linked` | §7.2 | 🔸 ⏳ P2 |

### E. ซ่อมบำรุง (Team 10) — P3

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F13 | ผูกคำร้องกับเลขใบงาน (≤ 1 ใบที่ยังเปิด) เก็บแค่ `maintenance_work_order_id` | §6.1–6.2 | 🖥️ ⏳ P3 |
| F14 | รับ webhook `maintenance.status_changed` → อัปเดตคำร้อง | §6.3 | ⏳ P3 |
| F29 | ตรวจลายเซ็น HMAC + กัน event ซ้ำ | §13, §18 | ⏳ P3 (helper HMAC พร้อมแล้ว) |
| F30 | เก็บ secret ใน environment ไม่ใส่ใน git | §13 | ⏳ P3 (config พร้อม) |

### F. AI ช่วยคัดกรอง — P4

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F19 | `POST /tickets/suggest` เสนอ หมวด / ความเร่งด่วน / ส่งต่อไปที่ไหน (Workers AI) | §8, §9.3 | 🖥️ ⏳ P4 |
| F20 | ตรวจคำตอบ AI ว่าอยู่ในค่าที่อนุญาต | §8.6 | ⏳ P4 |
| F21 | Fallback ด้วยกฎ keyword + urgency เมื่อ AI ใช้ไม่ได้ | §8.5, BR-06 | ⏳ P4 |
| F22 | AI เป็นแค่คำแนะนำ ผู้ใช้กด "ใช้ค่าที่แนะนำ" หรือแก้เองได้ | §8.4, BR-05 | ✅ (หน้าจอ) |
| F31 | เก็บคำแนะนำไว้กับคำร้อง ให้ admin เห็นในหน้ารายละเอียด + เตือนถ้าผู้แจ้งเลือกต่างจากที่แนะนำ / เป็นงานซ่อมที่ยังไม่ผูกใบงาน | §8.1, FR-10 | 🖥️ ⏳ P4 (คอลัมน์ DB + หน้าจอพร้อม) |

### G. ผู้ดูแลระบบ — P4

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F23 | จัดการหมวดหมู่ (เพิ่ม / ปิดใช้ ไม่ลบ) | §2 | 🖥️ ⏳ P4 |
| F24 | จำนวนคำร้องตามสถานะ / ความเร่งด่วน | §2 | 🖥️ ⏳ P4 |

### H. หน้าจอและคุณภาพ — P1 (หน้าจอ) / ทุกคน (tests)

| # | ฟีเจอร์ | PRD | สถานะ |
|---|---|---|---|
| F26 | 3 หน้าจอหลัก (React + TypeScript) | PRD กลาง | ✅ |
| F27 | Accessibility: label ทุกช่อง, ใช้ keyboard ได้, focus ชัด, skip link, responsive | §16 | ✅ พื้นฐาน, P1 ตรวจซ้ำ |
| — | Automated tests ≥ 7 ตัว | §18 | 4/7 ผ่าน, 3 รอเพื่อน (ดูข้อ 6) |

**สรุป 30 ข้อ (ตัด F08 แล้ว):** ✅ เสร็จ 15 ข้อ · 🖥️⏳ หน้าจอพร้อม รอ backend 5 ข้อ · ⏳ ยังไม่ทำ 10 ข้อ

---

## 5. API ทั้งหมด (`/api/v1`)

ทุก endpoint ใช้ได้ทั้ง `/api/v1/...` และ path เดิม (Postman ชุด Assignment 2 ยังใช้ได้)

| Method | Path | ใครเรียก | ทำอะไร | Owner | สถานะ |
|---|---|---|---|---|---|
| GET | `/health` | ทุกคน | ตรวจว่าระบบ + DB ทำงาน | P1 | ✅ |
| GET | `/users` | ทุกคน | รายชื่อผู้ใช้ stub | P1 | ✅ |
| GET | `/categories` | ทุกคน | หมวดที่เปิดใช้ (`?all=true` รวมที่ปิด) | P1 | ✅ |
| POST | `/tickets` | ล็อกอิน | สร้างคำร้อง | P1 | ✅ |
| GET | `/tickets/me` | ล็อกอิน | คำร้องของฉัน | P1 | ✅ |
| GET | `/tickets?sort=queue` | admin | แดชบอร์ด (`status`, `priority`) | P1 | ✅ |
| GET | `/tickets/:id` | เจ้าของ / staff | รายละเอียด + `history` | P1 | ✅ |
| PATCH | `/tickets/:id` | เจ้าของ / staff | แก้ไขตามสิทธิ์ | P1 | ✅ |
| POST | `/tickets/:id/resolve` | admin | ปิดงาน | P1 | ✅ |
| GET / POST | `/tickets/:id/comments` | เจ้าของ / staff | ข้อความ | P2 | ⏳ |
| POST | `/tickets/:id/link-maintenance` | admin | ผูกใบงาน | P3 | ⏳ |
| POST | `/webhooks/maintenance` | Team 10 (HMAC) | รับสถานะงานซ่อม | P3 | ⏳ |
| GET | `/wellbeing/services` | ทุกคน | catalogue Team 16 | P3 | ✅ |
| POST | `/tickets/suggest` | ล็อกอิน | AI แนะนำ | P4 | ⏳ |
| GET | `/admin/stats` | admin | จำนวนคำร้อง | P4 | ⏳ |
| POST / PATCH | `/admin/categories[/:id]` | admin | จัดการหมวด | P4 | ⏳ |

endpoint ที่ยังไม่ทำจะตอบ `501` พร้อมชื่อผู้รับผิดชอบ หน้าเว็บแสดงเป็น "ส่วนนี้ยังไม่เปิดใช้งาน"

---

## 6. Automated tests ตาม PRD §18

| # | Test | ไฟล์ | Owner | สถานะ |
|---|---|---|---|---|
| 1 | Create ticket | `backend/test/tickets.rules.test.ts` | P1 | ✅ ผ่าน |
| 2 | Ownership / access control | `backend/test/tickets.rules.test.ts` | P1 | ✅ ผ่าน |
| 3 | Admin-only triage | `backend/test/tickets.rules.test.ts` | P1 | ✅ ผ่าน |
| 4 | Comment | `backend/test/comments.test.ts` | P2 | ✅ ผ่าน |
| 5 | Resolve | `backend/test/tickets.rules.test.ts` | P1 | ✅ ผ่าน |
| 6 | Maintenance link / webhook | `backend/test/maintenance.test.ts` | P3 | ⏳ `.skip` |
| 7 | Escalation event | `backend/test/escalation.test.ts` | P2 | ⏳ `.skip` |
| + | AI fallback / invalid AI output | `backend/test/ai.test.ts` | P4 | ⏳ `.skip` |

ตอนนี้ `npm test` → **16 ผ่าน, 17 รอ** และ `bash scripts/smoke.sh` (ทดสอบ API จริง) → **21/21 ผ่าน**

---

## 7. ข้อมูล (Database: Cloudflare D1)

| ตาราง | เก็บอะไร | ของใคร |
|---|---|---|
| `tickets` | คำร้อง + `maintenance_work_order_id` + `maintenance_status` | Helpdesk |
| `ticket_categories` | หมวดหมู่ (+ `is_active`) | Helpdesk |
| `ticket_status_history` | ประวัติสถานะทุกครั้ง | Helpdesk |
| `ticket_comments` | ข้อความ public / internal | Helpdesk |
| `processed_events` | eventId ที่รับแล้ว (กัน webhook ซ้ำ) | Helpdesk |
| `domain_events` | outbox ของ event ที่เราส่งออก | Helpdesk |
| `tags`, `ticket_tags` | จาก Assignment 2 | Helpdesk |

**ไม่มีตาราง users** และ **ไม่เก็บรายละเอียดใบงานซ่อม** (PRD §11 data ownership)

ชื่อ field ต่างจาก PRD เล็กน้อย (ความหมายเดียวกัน): `title` = subject, `customer_id` = requester_id, `assigned_agent_id` = คอลัมน์เก่าจาก A2 ไม่ได้ใช้แล้ว, `priority` = urgency

---

## 8. Tech stack

| ชั้น | ใช้ |
|---|---|
| หน้าเว็บ | React 18 + TypeScript + Vite (build ไปที่ `public/` แล้ว Worker เสิร์ฟ) |
| Backend | Cloudflare Workers + Hono + TypeScript |
| Database | Cloudflare D1 (SQLite) |
| AI | Workers AI (`llama-3.1-8b-instruct`) + fallback ด้วยกฎ |
| งานตามเวลา | Cron Triggers (escalation ทุก 15 นาที) |
| Tests / CI | Vitest + GitHub Actions |

ตรงกับ stack ที่ PRD กลางของอาจารย์แนะนำ (PRD ทีมเรา §17 เขียน Next.js/PostgreSQL ไว้ แต่ §17 ระบุว่าเปลี่ยนได้ถ้าไม่กระทบ domain/contract)
