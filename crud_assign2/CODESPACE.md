# ใช้ใน GitHub Codespace

> สำหรับทีม/dev ที่อยาก test API โดยไม่ต้องติดตั้ง Node/Wrangler ที่เครื่อง local

## 0. Codespace คืออะไร (สั้นๆ)

- Cloud dev environment บน GitHub — เปิด repo ในเบราว์เซอร์ ได้ VS Code + Terminal ทันที
- ใช้ Linux container (ไม่ใช่ Windows — คำสั่ง PowerShell ใน tutorial นี้ใช้ไม่ได้ ใช้ `bash` แทน)
- Persistent storage ที่ `/workspaces/<repo-name>/`
- Node.js + Git ติดตั้งมาให้แล้ว

---

## 1. เปิด Codespace

**จาก GitHub:**
1. ไปที่ https://github.com/6731503031/PRD_HELPDESK
2. กดปุ่ม **Code** → tab **Codespaces** → **Create codespace on main**
3. รอ ~30–60 วินาที container จะ boot ขึ้นมา

**จาก VS Code local:**
1. ติดตั้ง extension **GitHub Codespaces**
2. Ctrl+Shift+P → "Codespaces: Create New Codespace"
3. เลือก repo `6731503031/PRD_HELPDESK`

---

## 2. Setup (รันครั้งเดียวต่อ Codespace)

Codespace จะอยู่ใน folder `/workspaces/PRD_HELPDESK/` โดยอัตโนมัติ

```bash
# 1. เข้าโฟลเดอร์ CRUD
cd PRD/crud_assign2

# 2. ติดตั้ง dependencies
npm install

# 3. Login Wrangler (ต่างจาก local — ดู section 3)
wrangler login
```

> ⚠️ ถ้า Codespace นี้เคยใช้แล้ว ไม่ต้อง login ใหม่ — credentials cache อยู่ใน Codespace secret

---

## 3. Wrangler login ใน Codespace

Codespace ไม่มี browser ในตัว — `wrangler login` แบบปกติจะเปิด browser ไม่ได้

**ทางเลือก A: ใช้ API Token (แนะนำ)**

1. ไป https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → template **Edit Cloudflare Workers** (หรือ custom scope: D1 + Workers)
3. Copy token ที่ได้
4. ใน Codespace terminal:
   ```bash
   export CLOUDFLARE_API_TOKEN="<paste token here>"
   wrangler whoami
   ```
   ถ้าแสดง email ของคุณ = login สำเร็จ

**ทางเลือก B: Device flow (รองรับ browser นอก)**

```bash
wrangler login --browser=false
```
จะแสดง URL + code → copy ไปเปิดใน browser ที่เครื่อง local → approve

---

## 4. สร้าง D1 database (ถ้ายังไม่มี)

```bash
wrangler d1 create helpdesk-db
```

Output:
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy database_id ไปวางใน `wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "helpdesk-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # ← แก้ตรงนี้
```

---

## 5. รัน schema + dev server

```bash
# รัน schema บน local DB
npm run db:local

# Start dev server (background หรือ terminal ใหม่)
npm run dev
```

Output:
```
Ready on http://127.0.0.1:8787
```

> **ใน Codespace:** port 8787 จะถูก auto-forward → กดปุ่ม **Open in Browser** ที่แถบ Ports ด้านล่าง
> URL จะเป็น `https://<codespace-name>-8787.app.github.dev/`

---

## 6. Test ด้วย Postman

**ใน Codespace:** Postman desktop ไม่มี — มี 3 ทางเลือก:

| ทางเลือก | วิธี |
|---|---|
| **A. curl** (built-in) | `curl http://127.0.0.1:8787/categories` |
| **B. Postman Web** | https://web.postman.com — import collection จาก `crud_assign2/postman_collection.json` |
| **C. Postman desktop local** | ใช้ Codespace URL จาก section 5 (เปลี่ยน base_url) |

**ทางเลือก B แนะนำ** — เปิด web.postman.com ในเบราว์เซอร์ → Import → paste JSON จาก collection file

---

## 7. คำสั่งที่ใช้บ่อย

```bash
# ดูสถานะ D1
wrangler d1 list

# Query local DB
wrangler d1 execute helpdesk-db --local --command="SELECT * FROM tickets"

# ลบ local DB (reset)
rm -rf .wrangler/state/v3/d1
npm run db:local

# ดู logs (ถ้า dev server รันอยู่)
# logs จะอยู่ใน terminal ที่รัน npm run dev
```

---

## 8. Codespace lifecycle

| Action | ผลกระทบ |
|---|---|
| **Stop codespace** | container หยุด แต่ data + files ยังอยู่ |
| **Delete codespace** | ลบทุกอย่าง (ต้อง setup ใหม่) |
| **Rebuild** | ลบ node_modules + .wrangler แต่ source code ยังอยู่ |

**Free tier:** 60 hours/month สำหรับ 2-core machine (พอสำหรับ dev/test)

---

## 9. Limitations vs local

| Item | Local (Windows) | Codespace (Linux) |
|---|---|---|
| Node | manual install | pre-installed |
| Wrangler | `npm i -g` | ใช้ `npx wrangler` หรือ install ใน project |
| Browser login | ทำงานปกติ | ต้อง API token หรือ device flow |
| D1 local | ทำงาน | ทำงานเหมือนกัน (Miniflare cross-platform) |
| Postman desktop | ใช้ได้ | ไม่มี → ใช้ web.postman.com |
| Thai text encoding | PowerShell mangled | bash ปกติ (UTF-8) |

---

## 10. Quick reference — ทุกคำสั่งเรียงตามลำดับ

```bash
# === Setup ครั้งแรก ===
cd PRD/crud_assign2
npm install
export CLOUDFLARE_API_TOKEN="<token>"      # หรือใช้ wrangler login --browser=false
wrangler d1 create helpdesk-db             # เอา database_id ไปใส่ wrangler.toml
npm run db:local

# === รัน dev ===
npm run dev
# → เปิด https://<codespace>-8787.app.github.dev/

# === Reset (ลบ local DB แล้ว reseed) ===
rm -rf .wrangler/state/v3/d1 && npm run db:local

# === ทุกครั้งที่กลับมา ===
cd PRD/crud_assign2
npm run dev
# (npm install + wrangler login ทำแค่ครั้งแรก หรือหลัง rebuild)
```

---

## 11. ถ้าติดปัญหา

| Error | สาเหตุ | วิธีแก้ |
|---|---|---|
| `wrangler: command not found` | wrangler ไม่ได้ติดตั้ง | `npm install` (ใช้ wrangler จาก node_modules ผ่าน npm scripts) หรือ `npm i -g wrangler` |
| `Authentication error [code: 10000]` | API token ผิด/หมดอายุ | สร้าง token ใหม่ที่ dash.cloudflare.com |
| port 8787 ไม่ forward | Codespace ไม่เห็น port | กด tab **Ports** ด้านล่าง → Add Port → 8787 |
| Thai text เพี้ยน | shell locale ไม่ใช่ UTF-8 | `export LANG=en_US.UTF-8` หรือใช้ curl + jq |
| local DB หายหลัง rebuild | .wrangler เป็น ephemeral | `npm run db:local` รันใหม่ |
