# 📋 HANDOVER BRIEF — PSU WIT IT Competency Assessment System
**โครงการ**: ระบบทดสอบสมรรถนะเทคโนโลยีสารสนเทศ (IT Competency Assessment System)  
**หน่วยงาน**: โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)  
**Workspace Path**: `d:\Test`  
**GitHub Repository**: https://github.com/rattanapol/PSUWIT-IT_Test (`main` branch)  
**วันที่อัปเดตล่าสุด**: 2026-11-03

---

## 1. ภาพรวมของระบบ (Executive Summary)
เว็บแอปพลิเคชันแบบ Single-Page Application (SPA) พร้อม Node.js Backend & SQLite 3 Relational Database สำหรับวัดและประเมินสมรรถนะทางเทคโนโลยีสารสนเทศ (IT Competency) ของนักเรียนระดับชั้นมัธยมศึกษาปีที่ 1 ถึงปีที่ 6 (`ม.1` - `ม.6`) ครอบคลุม 6 ด้านสมรรถนะหลัก มีการสอบ 2 รอบ (`Pre-test` และ `Post-test`), ระบบวิเคราะห์ผลด้วยกราฟใยแมงมุม (`Spider Radar Chart`), ระบบออกเกียรติบัตรอิเล็กทรอนิกส์ (`PDF 300 DPI`), ระบบป้องกันการทุจริตระหว่างสอบ และระบบจัดการหลังบ้านสำหรับผู้ดูแลระบบ

---

## 2. สถาปัตยกรรมและโครงสร้างไฟล์ (Project Structure)

```text
d:\Test/
├── index.html                   # หน้าเว็บหลัก (5 Views: Auth, Student Portal, Exam Arena, Results, Admin Dashboard)
├── server.js                    # Node.js HTTP Server + SQLite 3 Database (node:sqlite) + REST API (/api/*)
├── package.json                 # ข้อมูลโปรเจกต์และสคริปต์ npm start
├── README.md                    # คู่มือการใช้งานระบบ
├── HANDOVER_BRIEF.md            # เอกสารส่งมอบงานสำหรับพัฒนาต่อ (ไฟล์นี้)
├── database/
│   ├── schema.sql               # โครงสร้างตาราง SQL (students, assessments, admins, system_settings)
│   ├── seed.sql                 # ข้อมูลตัวอย่างเริ่มต้น (รหัสนักเรียน 4 หลัก และผู้ดูแลหลัก winai@psuwit.ac.th)
│   └── psuwit_it.sqlite         # ไฟล์ฐานข้อมูล SQLite 3
├── css/
│   └── main.css                 # สไตล์ชีตหลักของระบบ
├── js/
│   ├── config.js                # ค่าคงที่, Regex อีเมล @psuwit.ac.th, primaryAdminEmail (winai@psuwit.ac.th)
│   ├── questions.js             # คลังข้อสอบ ม.1 - ม.6 ระดับชั้นละ 15 ข้อ (รวม 90 ข้อ, คะแนนเต็ม 75 คะแนน, ครบ 6 ด้านสมรรถนะ)
│   ├── storage.js               # Multi-Tier Database Adapter (SQLite REST API + IndexedDB v2 + LocalStorage)
│   ├── assessment.js            # กลไกห้องสอบ (สุ่มข้อสอบ/ตัวเลือก, จับเวลา 15 นาที, Anti-Cheat สลับหน้าจอ 3 ครั้ง)
│   ├── charts.js                # กราฟใยแมงมุม (Chart.js Radar Chart) และกราฟแท่งเปรียบเทียบรายระดับชั้น
│   ├── certificate.js           # ระบบวาดเกียรติบัตร Canvas และสร้างไฟล์ PDF 300 DPI (ผ่านเกณฑ์ >= 60%)
│   ├── admin.js                 # ระบบหลังบ้าน (Dashboard, กรองรายชั้น, Export CSV, จัดการนักเรียน/แอดมิน/ฐานข้อมูล)
│   └── app.js                   # ตัวควบคุมหลัก (State Router, 2-Step Gmail SSO Login, Admin Access Verification)
└── google-sheets/
    ├── Code.gs                  # Google Apps Script สำหรับกรณีต้องการซิงก์เสริมไปยัง Google Sheets
    └── README_SETUP.md          # คู่มือการตั้งค่า Google Sheets Webhook
```

---

## 3. กระบวนการล็อกอินและสิทธิ์การเข้าถึง (Authentication & Access Control)

### 3.1 การเข้าสอบของนักเรียน (2-Step Gmail `@psuwit.ac.th` SSO Login)
1. **ขั้นตอนที่ 1 (Gmail Organization SSO)**:
   - นักเรียนต้องกดปุ่ม **"ลงชื่อเข้าใช้ด้วย Google (`@psuwit.ac.th`)"** ให้ผ่านก่อนเท่านั้น
   - อนุญาตเฉพาะอีเมลองค์กรที่ลงท้ายด้วย `@psuwit.ac.th` (เช่น `1001@psuwit.ac.th`) และบล็อก `@gmail.com` ทั่วไปโดยเด็ดขาด
   - รองรับทั้ง **Google Identity Services OAuth 2.0 ของจริง** (เมื่อตั้งค่า `Google Client ID` ในหน้า Admin) และ **หน้าต่างจำลอง Google Workspace SSO (`#googleOAuthModal`)** สำหรับทดสอบระบบทันที
2. **ขั้นตอนที่ 2 (ระบุชื่อ-นามสกุล และระดับชั้น)**:
   - เปิดให้กรอกได้หลังจากผ่านการยืนยันบัญชี Gmail `@psuwit.ac.th` ในขั้นตอนที่ 1 แล้วเท่านั้น
   - ระบบดึงรหัสนักเรียน 4 หลักจากอีเมลอัตโนมัติ นักเรียนเพียงระบุ **ชื่อ - นามสกุล** และเลือก **ระดับชั้น (`ม.1` - `ม.6`)** เพื่อเข้าสู่หน้าทำแบบทดสอบ

### 3.2 การเข้าใช้งานส่วนผู้ดูแลระบบ (Admin Access Control)
- จำกัดสิทธิ์เฉพาะผู้ใช้อีเมล **`winai@psuwit.ac.th`** (ผู้ดูแลระบบหลัก `super_admin`) และอีเมลผู้ดูแลระบบที่ถูกเพิ่มไว้ในตาราง `admins` เท่านั้น
- ปุ่มลิงก์ **"🛡️ ผู้ดูแลระบบ"** บน Header (`#btnHeaderAdminLink`) และการเข้าถึงหน้า `#view-admin` จะตรวจสอบกับ `DB.findAdmin(email)` ทุกครั้ง หากไม่มีชื่อในตาราง `admins` ระบบจะปฏิเสธการเข้าถึงทันที
- ในหน้า Admin Dashboard มีแท็บ **"🛡️ จัดการผู้ดูแลระบบ (Admin)"** ที่สามารถ:
  - **เพิ่มผู้ดูแลระบบใหม่**: ระบุอีเมล `@psuwit.ac.th` และชื่อ-นามสกุล
  - **ลบผู้ดูแลระบบ**: ยกเลิกสิทธิ์ผู้ดูแลที่เพิ่มเข้ามาได้ (ยกเว้น `winai@psuwit.ac.th` ที่ถูกล็อกเป็นสิทธิ์ถาวร ห้ามลบ)

---

## 4. โครงสร้างฐานข้อมูลและ REST API (Database & API Reference)

### 4.1 ตารางฐานข้อมูล (`database/schema.sql`)
1. **`students`**: `id`, `student_id`, `name`, `email (UNIQUE)`, `grade`, `status`, `pretest_completed`, `posttest_completed`, `created_at`, `updated_at`
2. **`assessments`**: `id`, `test_id (UNIQUE)`, `student_id`, `student_name`, `email (FK)`, `grade`, `test_type`, `score_total`, `max_score`, `score_percent`, `d1_score`..`d6_score`, `domain_scores_json`, `time_spent_seconds`, `violations_count`, `passed`, `submitted_at`
3. **`admins`**: `id`, `email (UNIQUE)`, `name`, `role ('super_admin' | 'admin')`, `created_at`
4. **`system_settings`**: `setting_key (PK)`, `setting_value`, `updated_at`

### 4.2 REST API Endpoints (`server.js`)
- `GET /api/status` — สถานะฐานข้อมูล SQLite และจำนวนเรคคอร์ดในแต่ละตาราง
- `GET /api/students` | `POST /api/students` | `DELETE /api/students?email=...` — จัดการข้อมูลนักเรียน
- `POST /api/students/reset` — รีเซ็ตสิทธิ์การสอบ (`pretest_completed`, `posttest_completed`)
- `GET /api/assessments?grade=...` | `POST /api/assessments` — ดึงและบันทึกผลการสอบ
- `GET /api/admins` | `POST /api/admins` | `DELETE /api/admins?email=...` — ดึง เพิ่ม และลบผู้ดูแลระบบ
- `GET /api/settings` | `POST /api/settings` — ดึงและบันทึกค่าตั้งค่าระบบ (เช่น `google_client_id`)
- `GET /api/database/export` | `POST /api/database/import` | `POST /api/database/seed` — สำรอง นำเข้า และรีเซ็ตฐานข้อมูล

---

## 5. วิธีเริ่มต้นทำงานต่อในแชทใหม่ (Quick Start for Next Session)
1. ในแชทใหม่ สามารถพิมพ์สั่งงานต่อได้ทันทีโดยอ้างอิงไฟล์นี้ เช่น:
   > *"อ่านไฟล์ `d:\Test\HANDOVER_BRIEF.md` เพื่อดูโครงสร้างระบบล่าสุด แล้วช่วยปรับปรุงส่วน..."*
2. การรันเซิร์ฟเวอร์ในเครื่อง:
   ```bash
   node server.js
   ```
   เปิดใช้งานที่ `http://localhost:3000`
   - **ทดสอบฝั่งนักเรียน**: ล็อกอินด้วย `1001@psuwit.ac.th`
   - **ทดสอบฝั่งผู้ดูแลระบบ (Admin)**: ล็อกอินด้วย `winai@psuwit.ac.th`

