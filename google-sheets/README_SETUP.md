# คู่มือการติดตั้งและเชื่อมต่อ Google Sheets เป็นฐานข้อมูล

ระบบนี้ถูกออกแบบให้ใช้ **Google Sheets** เป็นฐานข้อมูลหลักผ่าน **Google Apps Script (Web App)** โดยมีขั้นตอนการตั้งค่าง่าย ๆ ดังนี้:

---

### ขั้นตอนที่ 1: สร้าง Google Sheets ใหม่
1. ไปที่ [Google Sheets](https://sheets.new) และสร้าง Spreadsheet ใหม่
2. ตั้งชื่อไฟล์ เช่น `PSU_WIT_IT_Assessment_DB`

---

### ขั้นตอนที่ 2: ติดตั้ง Google Apps Script
1. ที่เมนูด้านบนของ Google Sheets คลิกที่ **ส่วนขยาย (Extensions) > Apps Script**
2. ลบโค้ดเริ่มต้นทั้งหมดในไฟล์ `Code.gs` ออก
3. เปิดไฟล์ [google-sheets/Code.gs](Code.gs) ในโปรเจกต์นี้ คัดลอกโค้ดทั้งหมดมาวาง
4. บันทึกโค้ด (กด Ctrl+S หรือรูปแผ่นดิสก์)
5. ทดสอบสร้างตารางเริ่มต้น:
   - เลือกฟังก์ชัน `setupDatabase` ที่ดรอปดาวน์ด้านบน
   - กดปุ่ม **Run (เรียกใช้)**
   - กดยอมรับการเข้าถึงสิทธิ์ (Review permissions > บัญชี Google ของคุณ > Advanced > Go to Untitled project > Allow)
   - กลับไปดูที่ Google Sheets จะพบตาราง `Students`, `Assessments` และ `Logs` ถูกสร้างขึ้นโดยอัตโนมัติ

---

### ขั้นตอนที่ 3: เผยแพร่เป็น Web App (Deploy)
1. คลิกที่ปุ่มสีน้ำเงินมุมขวาบน **Deploy (ทำให้ใช้งานได้) > New deployment (การทำให้ใช้งานได้ใหม่)**
2. คลิกรูปเฟือง **Select type** เลือก **Web app**
3. ตั้งค่าดังนี้:
   - **Description**: `PSU WIT IT Assessment API v1`
   - **Execute as**: `Me (อีเมลของคุณ)`
   - **Who has access**: `Anyone (ทุกคน)` *(สำคัญมาก เพื่อให้เว็บแอปเรียกส่งข้อมูลได้โดยไม่ต้องล็อกอินบัญชี Google ฝั่งสคริปต์)*
4. กด **Deploy**
5. กดยืนยันสิทธิ์อีกครั้ง (หากมีป๊อปอัปถาม)
6. คัดลอก **Web app URL** ที่ได้ (เช่น `https://script.google.com/macros/s/AKfycb.../exec`)

---

### ขั้นตอนที่ 4: นำ URL มาใส่ในระบบ
1. เปิดหน้าเว็บแอปพลิเคชัน
2. เข้าสู่ระบบในฐานะ **Admin (ผู้ดูแลระบบ)**
3. ไปที่แท็บ **"ตั้งค่าระบบ (Settings)"**
4. วาง URL ที่ได้ลงในช่อง **"Google Apps Script Web App URL"** แล้วกด **"ทดสอบการเชื่อมต่อ & บันทึก"**
5. ระบบจะซิงก์ข้อมูลกับ Google Sheets ของคุณแบบ Real-time ทันที!
*(หมายเหตุ: หากยังไม่ได้ใส่ URL ระบบจะใช้ฐานข้อมูลจำลอง LocalStorage ให้โดยอัตโนมัติ ทำให้สามารถทดสอบและใช้งานระบบได้ทันทีโดยไม่ติดขัด)*
