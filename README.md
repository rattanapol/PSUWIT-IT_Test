# ระบบทดสอบสมรรถนะเทคโนโลยีสารสนเทศ (IT Competency Assessment System)
### โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)

เว็บแอปพลิเคชันสำหรับประเมินและพัฒนาสมรรถนะทาง IT ของนักเรียนระดับชั้นมัธยมศึกษาปีที่ 1 ถึงปีที่ 6 (ม.1 - ม.6) พร้อมระบบฐานข้อมูลเชิงสัมพันธ์ (**SQLite 3 Relational Database** + **IndexedDB**), รายงานผลแบบกราฟใยแมงมุม (Radar Spider Chart), เกียรติบัตรอิเล็กทรอนิกส์ PDF, ระบบความปลอดภัยป้องกันการทุจริต และระบบแดชบอร์ดสำหรับผู้ดูแลระบบ

---

## 🗄️ สถาปัตยกรรมระบบฐานข้อมูล (Database Architecture)

ระบบจัดเก็บข้อมูลในรูปแบบ **Multi-Tier Relational Database** เพื่อให้รองรับทั้งการรันผ่าน Node.js Server และการเปิดใช้งานบน Cloud / Static Hosting:

1. **SQLite 3 Relational Database (`database/psuwit_it.sqlite`)**:
   - ขับเคลื่อนด้วยโมดูล `node:sqlite` ในตัวของ Node.js (ไม่ต้องติดตั้งแพ็กเกจภายนอกเพิ่มเติม)
   - โครงสร้างตารางฐานข้อมูล (`database/schema.sql`) รองรับทั้ง SQLite, MySQL และ PostgreSQL:
     - ตาราง **`students`**: จัดเก็บข้อมูลนักเรียน (`id`, `student_id`, `name`, `email` UNIQUE, `grade`, `status`, `pretest_completed`, `posttest_completed`, `created_at`, `updated_at`)
     - ตาราง **`assessments`**: จัดเก็บประวัติและผลคะแนนการสอบ (`id`, `test_id` UNIQUE, `student_id`, `student_name`, `email` FK, `grade`, `test_type`, `score_total`, `max_score`, `score_percent`, `d1_score` - `d6_score`, `time_spent_seconds`, `violations_count`, `passed`, `submitted_at`)
     - ตาราง **`system_settings`**: จัดเก็บค่าตั้งค่าระบบ
2. **Browser Database (`IndexedDB: PSUWIT_IT_Database`)**:
   - ซิงก์ข้อมูลอัตโนมัติกับฐานข้อมูลบนเบราว์เซอร์พร้อมระบบ Indexing (`email`, `grade`, `test_type`) ทำให้งานได้แม้เปิดผ่าน GitHub Pages หรือโหมด Offline
3. **ระบบสำรองและส่งออกฐานข้อมูล (Database Backup & Export)**:
   - ดาวน์โหลดฐานข้อมูลเป็นไฟล์ **SQL Dump (`.sql`)**
   - สำรองและกู้คืนฐานข้อมูลเป็นไฟล์ **JSON (`.json`)**
   - ส่งออกรายงานผลคะแนนแยกตามระดับชั้นเป็นไฟล์ **CSV (UTF-8 BOM)** สำหรับ Microsoft Excel

---

## 🌟 ฟังก์ชันเด่นของระบบ

### 1. ส่วนของผู้เข้าทดสอบ (Student / User)
- **ครอบคลุม 6 ระดับชั้น**: มัธยมศึกษาปีที่ 1 ถึงปีที่ 6 (ม.1 - ม.6)
- **ครอบคลุม 6 ด้านสมรรถนะ IT ตามมาตรฐานการศึกษา**:
  1. `D1: Digital Literacy & Safety` (การรู้เท่าทันสื่อดิจิทัลและความปลอดภัย)
  2. `D2: Hardware, Systems & Networks` (ฮาร์ดแวร์ ระบบปฏิบัติการ และเครือข่ายคอมพิวเตอร์)
  3. `D3: Computational Thinking & Coding` (การคิดเชิงคำนวณและการเขียนโปรแกรม)
  4. `D4: Data Management & Analysis` (การจัดการและวิเคราะห์ข้อมูล)
  5. `D5: Cybersecurity, Ethics & Law` (ความมั่นคงปลอดภัยไซเบอร์ จริยธรรม และ พ.ร.บ. คอมพิวเตอร์)
  6. `D6: Emerging Tech, AI & Cloud` (เทคโนโลยีสมัยใหม่ ปัญญาประดิษฐ์ และคลาวด์)
- **ระบบคะแนนแบบ Rubric 1 - 5 ระดับ**: วัดระดับความถูกต้องและเหมาะสมตั้งแต่ 1 ถึง 5 คะแนน พร้อมปรับความยาวของตัวเลือกให้สมดุลกันเพื่อป้องกันการเดา
- **ระบบทดสอบ 2 ครั้ง (Pre-test & Post-test)**: วัดผลก่อนและหลังเรียน พร้อมสลับลำดับข้อสอบและสลับตัวเลือกแบบสุ่ม (Fisher-Yates Shuffle)
- **ระบบความปลอดภัยและการจับเวลา (Anti-Cheat & Timer)**:
  - จำกัดเวลาทำข้อสอบ 15 นาที พร้อมแจ้งเตือนเมื่อเวลาใกล้หมด
  - ระบบตรวจจับการสลับแท็บ/เปิดโปรแกรมอื่น (`visibilitychange` และ `blur`) เตือนได้สูงสุด 3 ครั้ง หากฝ่าฝืนระบบจะส่งข้อสอบทันที
- **รายงานผลด้วยกราฟใยแมงมุม (Spider Radar Chart)** และ **เกียรติบัตรอิเล็กทรอนิกส์ (E-Certificate PDF)**

### 2. ส่วนของผู้ดูแลระบบ (Admin)
- **Dashboard วิเคราะห์ภาพรวม**: สถิติผู้เข้าสอบทั้งหมด, คะแนนเฉลี่ย Pre-test, Post-test และอัตราผ่านเกณฑ์
- **รายงานผลการทดสอบละเอียด**: กรองข้อมูลแยกตามระดับชั้น (ม.1 - ม.6), ค้นหาตามชื่อ/รหัสนักเรียน/อีเมล และ Export CSV
- **จัดการข้อมูลนักเรียน (User Management)**: เพิ่ม แก้ไข ลบ ปรับสถานะบัญชี และรีเซ็ตสิทธิ์การสอบ
- **จัดการฐานข้อมูล (Database Management)**: ตรวจสอบสถานะตารางฐานข้อมูล, Export `.sql` / `.json`, Import `.json` และ Reset Seed Data

---

## 📁 โครงสร้างโปรเจกต์

```text
PSUWIT-IT_Test/
├── index.html                   # ไฟล์หลักของเว็บแอปพลิเคชัน (Single-Page Application)
├── server.js                    # Node.js Backend Server + SQLite 3 Database & REST API
├── package.json                 # ข้อมูลโปรเจกต์และสคริปต์เริ่มต้นระบบ
├── database/
│   ├── schema.sql               # โครงสร้างตารางฐานข้อมูล SQL (students, assessments, system_settings)
│   ├── seed.sql                 # ข้อมูลตัวอย่างเริ่มต้นในรูปแบบ SQL
│   └── psuwit_it.sqlite         # ไฟล์ฐานข้อมูล SQLite 3 (สร้างและอัปเดตอัตโนมัติเมื่อรันเซิร์ฟเวอร์)
├── css/
│   └── main.css                 # สไตล์ชีตหลัก ดีไซน์โมเดิร์น Responsive
├── js/
│   ├── config.js                # ค่าคงที่ การตั้งค่าระบบ และ Regex ตรวจสอบอีเมล @psuwit.ac.th
│   ├── questions.js             # ธนาคารข้อสอบ ม.1 - ม.6 พร้อม 6 ด้านสมรรถนะ ตัวเลือกคะแนน 1-5
│   ├── storage.js               # ระบบเชื่อมต่อฐานข้อมูล REST API + IndexedDB + SQL/JSON Export
│   ├── assessment.js            # กลไกห้องสอบ ระบบสลับโจทย์ จับเวลา และตรวจจับการสลับจอ
│   ├── charts.js                # ระบบวาดกราฟใยแมงมุม (Chart.js Radar Chart)
│   ├── certificate.js           # ระบบสร้างเกียรติบัตร Canvas & แปลงเป็นไฟล์ PDF (jsPDF)
│   ├── admin.js                 # ระบบจัดการฐานข้อมูล กรองระดับชั้น Export CSV และจัดการผู้ใช้
│   └── app.js                   # ตัวควบคุมหลักและ State Router
└── google-sheets/
    ├── Code.gs                  # โค้ด Google Apps Script สำหรับกรณีต้องการซิงก์เสริมกับ Google Sheets
    └── README_SETUP.md          # คู่มือการติดตั้ง Google Sheets Webhook
```

---

## 🚀 วิธีการรันระบบ

1. เปิด Terminal ในโฟลเดอร์โปรเจกต์แล้วสั่งรัน:
   ```bash
   node server.js
   ```
2. เปิดเบราว์เซอร์ไปที่: **[http://localhost:3000](http://localhost:3000)**
   - **อีเมลนักเรียนสำหรับทดสอบ**: `s641001@psuwit.ac.th` (หรืออีเมลใดก็ได้ที่ลงท้ายด้วย `@psuwit.ac.th`)
   - **รหัสผ่านผู้ดูแลระบบ (Admin)**: `admin1234`
