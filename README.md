# Attendence-V1
ระบบเข้า-ออกงาน แบบกดcheck-in-check-out เวอร์ชั่น1.0

## การติดตั้งและใช้งานด้วย Docker & Cloudflare Tunnel

เพื่อให้ระบบมีความปลอดภัยสูง ไม่ต้องเปิดพอร์ต (Port Forwarding) จากเราเตอร์ภายนอกตรงๆ สามารถใช้ Docker Compose ในการรัน API คู่กับ Cloudflare Tunnel ได้ดังนี้:

### 1. การเตรียมการ
* สร้าง Tunnel ในหน้าเว็บ Cloudflare Zero Trust Dashboard และคัดลอก **Tunnel Token** ไว้
* ตั้งค่าไฟล์ `.env` สำหรับเชื่อมต่อกับฐานข้อมูล MySQL ของคุณให้เรียบร้อย

### 2. ขั้นตอนการรัน
เปิด Terminal ในโฟลเดอร์โปรเจกต์แล้วรันคำสั่งด้านล่างนี้ (แทนที่ `<YOUR_TUNNEL_TOKEN>` ด้วย Token ที่ได้มาจาก Cloudflare):

```bash
# กำหนด Token ใน Environment Variable แล้วสั่งขึ้นระบบ
CLOUDFLARE_TUNNEL_TOKEN="<YOUR_TUNNEL_TOKEN>" docker-compose up -d
```

### 3. การเชื่อมต่อบน Cloudflare Dashboard
ในส่วน **Public Hostname** ของ Tunnel ให้ระบุค่าดังนี้:
* **Service Type:** `HTTP`
* **URL:** `http://attendance-api:3004` (ใช้ชื่อ service container แทน localhost เนื่องจากรันอยู่บน Docker network เดียวกัน)
