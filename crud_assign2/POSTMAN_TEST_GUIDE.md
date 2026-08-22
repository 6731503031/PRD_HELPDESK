# Postman Test Guide — Helpdesk Ticket API

> เอกสารสำหรับ Tester ใช้ยิง API ผ่าน Postman
> API ทำงานบน `http://127.0.0.1:8787` (local dev) ไม่ต้อง deploy production
> อ่าน tutorial เต็มที่ `../crud_assign2.md` ถ้าต้องการ context เพิ่ม

---

## 0. Setup ก่อนเริ่ม

### 0.1 Verify server รันอยู่
```bash
curl http://127.0.0.1:8787/
```
ต้องได้ JSON list endpoints ถ้าไม่ได้ → บอก developer รัน `npm run dev`

### 0.2 Import collection (ถ้ายังไม่มี)
1. Postman → **Import** → เลือกไฟล์ `crud_assign2/postman_collection.json`
2. จะเห็น folder: Health, Ticket CRUD, Negative tests

### 0.3 Identity stub — 5 users ที่ใช้ได้

| id | ชื่อ | role | ใช้ทำอะไร |
|---|---|---|---|
| 1 | Alice Customer | customer | สร้าง/อ่าน ticket ตัวเอง |
| 2 | Bob Customer | customer | ทดสอบ ownership (อ่านของคนอื่น) |
| 3 | Somchai Agent | agent | จัดการ queue, assign, resolve |
| 4 | Suda Agent | agent | รับงานที่ assign |
| 5 | Admin User | admin | ลบได้, override ทุกอย่าง |

> **Identity stub อยู่ใน `src/identity.ts`** — ถ้า Tester เพิ่ม user ใหม่ต้องแจ้ง developer แก้ไฟล์นี้ด้วย

### 0.4 Headers ที่ต้องส่งทุก request (ที่ขึ้นต้นด้วย /tickets)

| Header | Required | ค่าตัวอย่าง | คำอธิบาย |
|---|---|---|---|
| `Content-Type` | ส่ง POST/PATCH/PUT | `application/json` | บอกว่า body เป็น JSON |
| `x-user-id` | **ทุก /tickets\* request** | `1` ถึง `5` | external id จาก Identity (ต้องตรงกับ stub) |
| `x-user-role` | **ทุก /tickets\* request** | `customer` / `agent` / `admin` | ต้องตรงกับ Identity claim — server validate |

> ⚠️ **ถ้า `x-user-role` ไม่ตรงกับ Identity claim** จะได้ `403 Forbidden` (ป้องกัน role spoofing)

---

## 1. PATCH /tickets/:id — Partial Update

### 1.1 Endpoint
```
PATCH http://127.0.0.1:8787/tickets/:id
```

### 1.2 Headers
```
Content-Type: application/json
x-user-id: <1-5>
x-user-role: <customer|agent|admin>
```

### 1.3 Field Permissions

| Field | customer (เฉพาะ ticket ตัวเอง) | agent / admin |
|---|---|---|
| `title` | ✅ | ✅ |
| `description` | ✅ | ✅ |
| `priority` | ❌ 403 | ✅ |
| `status` | ❌ 403 | ✅ |
| `category_id` | ❌ 403 | ✅ |
| `assigned_agent_id` | ❌ 403 | ✅ |
| `resolution_note` | ❌ 403 | ✅ |

> Customer ส่ง field ที่ตัวเองแก้ไม่ได้ → 400 (ไม่ใช่ 403 — server ignore fields ที่ไม่มีสิทธิ์)
> Customer ส่งแต่ field ที่แก้ไม่ได้ทั้งหมด → 400 "ไม่มี field ที่แก้ได้"

### 1.4 Example scenarios

#### Scenario A: Customer แก้ title (สำเร็จ)
```
Method:  PATCH
URL:     http://127.0.0.1:8787/tickets/1
Headers: x-user-id: 1, x-user-role: customer, Content-Type: application/json
Body:    { "title": "Wi-Fi หอพักใช้ไม่ได้ (แก้ชื่อใหม่)" }
```
Expected: `200 OK` + ticket ใหม่ที่ title เปลี่ยน

#### Scenario B: Customer ส่ง priority (ถูก ignore เพราะไม่มีสิทธิ์)
```
Body:    { "title": "ok", "priority": "urgent" }
```
Expected: `400 Bad Request` "ไม่มี field ที่แก้ได้" (priority ถูก skip → ไม่เหลือ field)

#### Scenario C: Agent เปลี่ยน priority + status
```
Method:  PATCH
URL:     http://127.0.0.1:8787/tickets/1
Headers: x-user-id: 3, x-user-role: agent, Content-Type: application/json
Body:    { "priority": "urgent", "status": "in_progress" }
```
Expected: `200 OK` + status=`in_progress`, priority=`urgent`, updated_at อัปเดต

#### Scenario D: Agent เปลี่ยน category
```
Body:    { "category_id": 3 }
```
Expected: `200 OK` + category_id=3

#### Scenario E: Agent แก้ทุก field พร้อมกัน
```
Body:    {
  "title": "อัปเดตใหม่ทั้งหมด",
  "description": "อธิบายใหม่",
  "priority": "medium",
  "status": "assigned",
  "category_id": 3,
  "resolution_note": "แก้ปัญหาแล้วบางส่วน"
}
```
Expected: `200 OK` + ทุก field อัปเดต

### 1.5 Response format
```json
{
  "message": "Ticket updated",
  "data": {
    "id": 1,
    "ticket_number": "TKT-00001",
    "title": "...",
    "status": "in_progress",
    "priority": "urgent",
    "category_id": 3,
    "customer_id": 1,
    "assigned_agent_id": null,
    "resolution_note": null,
    "created_at": "2026-08-22 ...",
    "updated_at": "2026-08-22 ...",    ← เปลี่ยนทุกครั้งที่ PATCH
    "resolved_at": null
  }
}
```

---

## 2. PUT /tickets/:id — Full Update

### 2.1 Endpoint
```
PUT http://127.0.0.1:8787/tickets/:id
```

### 2.2 Headers + Body = เหมือน PATCH
```
PUT ใช้ตัวเดียวกับ PATCH (semantics เหมือนกันใน assignment นี้)
```

### 2.3 ตัวอย่าง
```
Method:  PUT
URL:     http://127.0.0.1:8787/tickets/1
Headers: x-user-id: 3, x-user-role: agent, Content-Type: application/json
Body:    {
  "title": "อัปเดตใหม่ทั้งหมด",
  "description": "อธิบายใหม่",
  "priority": "medium",
  "status": "assigned",
  "category_id": 3
}
```
Expected: `200 OK` (เหมือน PATCH)

> **หมายเหตุ:** PUT ใน assignment นี้ delegate ไป PATCH handler
> Production จริงควรแยก semantics — PUT = replace ทั้ง object, PATCH = partial

---

## 3. Other Endpoints (Quick Reference)

### POST /tickets (Create)
```
Headers: x-user-id: 1, x-user-role: customer, Content-Type: application/json
Body: {
  "title": "Wi-Fi หอพักใช้ไม่ได้",
  "description": "...",
  "category_id": 1,
  "priority": "high"
  // customer_id optional (default = x-user-id)
  // assigned_agent_id optional
}
```
Required: `title`, `description`, `category_id`
→ `201 Created` + ticket object

### GET /tickets (List)
```
Headers: x-user-id: 1, x-user-role: customer
```
Query params (optional): `?status=open&priority=high&customer_id=1&assigned_agent_id=3`
- customer เห็นเฉพาะ ticket ตัวเอง (filter อัตโนมัติ)
- agent/admin เห็นทั้งหมด

### GET /tickets/:id (Read one)
```
Headers: x-user-id: 3, x-user-role: agent
```
→ 200 + ticket + enriched fields (category_name, customer_name, agent_name)

### POST /tickets/:id/assign
```
Headers: x-user-id: 3, x-user-role: agent
Body: { "agent_id": 4 }
```
- customer ยิง → 403
- agent_id ไม่มี → 400
- agent_id เป็น customer (id=1,2) → 400
→ 200 + status=`assigned`, assigned_agent_id=4

### POST /tickets/:id/resolve
```
Headers: x-user-id: 3, x-user-role: agent
Body: { "resolution_note": "รีเซ็ตเราท์เตอร์" }   // optional
```
- customer ยิง → 403
→ 200 + status=`resolved`, resolved_at ติ๊ด, resolution_note บันทึก

### DELETE /tickets/:id
```
Headers: x-user-id: 5, x-user-role: admin
```
- customer ยิง → 200 (เฉพาะ ticket ตัวเอง, สถานะ open เท่านั้น)
- agent ยิง → **403** "agent ลบ ticket ไม่ได้ ใช้ resolve แทน"
- admin ยิง ticket resolved แล้ว → **409** "ticket ที่ resolved/closed แล้วลบไม่ได้"
→ 200 ถ้าผ่าน

---

## 4. Status Code Reference

| Code | ความหมาย | ตัวอย่าง |
|---|---|---|
| `200 OK` | สำเร็จ | GET, PATCH, PUT, DELETE |
| `201 Created` | สร้างสำเร็จ | POST /tickets |
| `400 BadRequest` | validation fail | missing field, invalid enum, wrong FK |
| `401 Unauthorized` | ไม่มี auth หรือ user ไม่อยู่ใน Identity | ไม่ส่ง headers, ส่ง id=99 |
| `403 Forbidden` | auth แล้วแต่ไม่มีสิทธิ์ | role spoofing, customer อ่านของคนอื่น |
| `404 NotFound` | ไม่พบ resource | GET /tickets/99999 |
| `409 Conflict` | state conflict | DELETE ticket ที่ resolved แล้ว |

---

## 5. Test Workflow (แนะนำ)

### Round 1 — Happy path
1. `GET /categories` → จด id 1-5
2. `POST /tickets` (customer id=1, category_id=1) → จด id ที่ได้
3. `GET /tickets/:id` (agent id=3) → ดู enriched fields
4. `PATCH /tickets/:id` (agent, body `{priority:"urgent",status:"in_progress"}`)
5. `POST /tickets/:id/assign` (agent, body `{agent_id:4}`)
6. `POST /tickets/:id/resolve` (agent, body `{resolution_note:"..."}`)
7. `DELETE /tickets/:id` (admin) → คาดว่า 409 (เพราะ resolved แล้ว)

### Round 2 — Negative
1. `POST /tickets` ไม่มี headers → 401
2. `POST /tickets` headers แต่ body ว่าง → 400
3. `GET /tickets/99999` (agent) → 404
4. `GET /tickets/1` (customer id=2) → 403
5. `PATCH /tickets/1` ส่ง role=admin แต่ id=1 (เป็น customer) → 403 (role spoofing!)
6. `DELETE /tickets/1` (agent id=3) → 403

### Round 3 — Field-level authz (PATCH)
1. PATCH ด้วย customer ส่งเฉพาะ `title` → 200
2. PATCH ด้วย customer ส่ง `priority` → 400
3. PATCH ด้วย agent ส่งทุก field → 200

---

## 6. Common Issues

| Issue | สาเหตุ | วิธีแก้ |
|---|---|---|
| ได้ `ECONNREFUSED 127.0.0.1:8787` | dev server ไม่รัน | บอก developer รัน `npm run dev` |
| `401` "ไม่พบใน Identity" | x-user-id ไม่อยู่ใน 1-5 | ใช้ id 1-5 เท่านั้น |
| `403` "role ไม่ตรงกับ Identity" | x-user-role ไม่ตรงกับ user นั้น | ตรวจ role จากตาราง section 0.3 |
| `400` "category_id ไม่มีในระบบ" | category_id ไม่อยู่ใน 1-5 | ใช้ id 1-5 เท่านั้น |
| ได้ response แต่ ticket ไม่เปลี่ยน | field ถูก ignore (authz) | ดู section 1.3 ตาราง field permissions |
| Thai text เพี้ยนใน Postman | encoding issue | Postman ส่ง UTF-8 ปกติ ปัญหาอยู่ที่การแสดงผล ไม่กระทบ data |

---

## 7. ถ้าต้องการข้อมูลเพิ่ม

- Tutorial เต็ม: `../crud_assign2.md`
- Architecture: `README.md`
- Identity stub: `src/identity.ts`
- Routes ทั้งหมด: `src/index.ts`
- Database schema: `schema.sql`

ถ้าเจอ bug หรือ behavior ไม่ตรง spec นี้ → แจ้ง developer พร้อม:
1. Request ที่ยิง (method, URL, headers, body)
2. Response ที่ได้ (status code + body)
3. Expected behavior ตามที่ควรเป็น
