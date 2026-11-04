# 📋 HANDOVER BRIEF — PSU WIT IT Competency Assessment System
**โครงการ**: ระบบทดสอบสมรรถนะเทคโนโลยีสารสนเทศ (IT Competency Assessment System)  
**หน่วยงาน**: โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)  
**Workspace Path**: `d:\Test`  
**GitHub Repository**: https://github.com/rattanapol/PSUWIT-IT_Test (`main` branch)  
**วันที่อัปเดตล่าสุด**: 2026-11-04

---

## 1. ภาพรวมของระบบ (Executive Summary)
เว็บแอปพลิเคชันแบบ Single-Page Application (SPA) พร้อม Node.js Backend & SQLite 3 Relational Database สำหรับวัดและประเมินสมรรถนะทางเทคโนโลยีสารสนเทศ (IT Competency) ของนักเรียนระดับชั้นมัธยมศึกษาปีที่ 1 ถึงปีที่ 6 (`ม.1` - `ม.6`) ครอบคลุม 6 ด้านสมรรถนะหลัก มีการสอบ 2 รอบ (`Pre-test` และ `Post-test`), ระบบวิเคราะห์ผลด้วยกราฟใยแมงมุม (`Spider Radar Chart`), ระบบออกเกียรติบัตรอิเล็กทรอนิกส์ (`PDF 300 DPI`), ระบบป้องกันการทุจริตระหว่างสอบ, ระบบล็อกอินด้วย **Username & Password** จากฐานข้อมูลผู้ใช้งานจริง (`user.xlsx` จำนวน 1,468 บัญชี) และระบบให้ผู้ใช้งานทุกคนสามารถแก้ไขรหัสผ่านของตนเองได้

---

## 2. สถาปัตยกรรมและโครงสร้างไฟล์ (Project Structure)

```text
d:\Test/
├── index.html                   # หน้าเว็บหลัก (5 Views: Auth, Student Portal, Exam Arena, Results, Admin Dashboard + Change Password Modal)
├── server.js                    # Node.js HTTP Server + SQLite 3 Database (node:sqlite) + REST API (/api/*)
├── user.xlsx                    # ไฟล์ต้นฉบับรายชื่อผู้ใช้งานโรงเรียน (นักเรียน 1,465 คน + ผู้ดูแลระบบ 3 คน)
├── package.json                 # ข้อมูลโปรเจกต์และสคริปต์ npm start
├── README.md                    # คู่มือการใช้งานระบบ
├── HANDOVER_BRIEF.md            # เอกสารส่งมอบงานสำหรับพัฒนาต่อ (ไฟล์นี้)
├── database/
│   ├── schema.sql               # โครงสร้างตาราง SQL (students, assessments, admins, system_settings)
│   ├── seed.sql                 # ข้อมูลผู้ใช้งานเริ่มต้นทั้ง 1,468 คนจาก user.xlsx
│   └── psuwit_it.sqlite         # ไฟล์ฐานข้อมูล SQLite 3
├── css/
│   └── main.css                 # สไตล์ชีตหลักของระบบ
├── js/
│   ├── config.js                # ค่าคงที่ของระบบ
│   ├── questions.js             # คลังข้อสอบ ม.1 - ม.6 ระดับชั้นละ 15 ข้อ (รวม 90 ข้อ, คะแนนเต็ม 75 คะแนน, ครบ 6 ด้านสมรรถนะ)
│   ├── users_data.js            # ข้อมูลผู้ใช้งาน 1,468 คนที่แปลงจาก user.xlsx (สำหรับทั้ง Node.js และ Browser IndexedDB)
│   ├── storage.js               # Multi-Tier Database Adapter (SQLite REST API + IndexedDB v3 + LocalStorage + Auth & Password Change)
│   ├── assessment.js            # กลไกห้องสอบ (สุ่มข้อสอบ/ตัวเลือก, จับเวลา 15 นาที, Anti-Cheat สลับหน้าจอ 3 ครั้ง)
│   ├── charts.js                # กราฟใยแมงมุม (Chart.js Radar Chart) และกราฟแท่งเปรียบเทียบรายระดับชั้น
│   ├── certificate.js           # ระบบวาดเกียรติบัตร Canvas และสร้างไฟล์ PDF 300 DPI (ผ่านเกณฑ์ >= 60%)
│   ├── admin.js                 # ระบบหลังบ้าน (Dashboard, กรองรายชั้น, Export CSV, จัดการนักเรียน 1,465 คนแบบแบ่งหน้า, รีเซ็ตรหัสผ่าน)
│   └── app.js                   # ตัวควบคุมหลัก (State Router, Username/Password Login, Self-Service Change Password)
└── google-sheets/
    ├── Code.gs                  # Google Apps Script สำหรับกรณีต้องการซิงก์เสริมไปยัง Google Sheets
    └── README_SETUP.md          # คู่มือการตั้งค่า Google Sheets Webhook
```

---

## 3. กระบวนการล็อกอินและการจัดการรหัสผ่าน (Authentication & Password Management)

### 3.1 ฐานข้อมูลผู้ใช้งานจาก `user.xlsx` (รวม 1,468 คน)
1. **นักเรียน (`student`) จำนวน 1,465 คน**:
   - ระดับชั้น `ม.1` (215 คน), `ม.2` (246 คน), `ม.3` (222 คน), `ม.4` (279 คน), `ม.5` (271 คน), `ม.6` (232 คน)
   - มีข้อมูลครบถ้วน: `รหัสนักเรียน`, `เลขที่`, `คำนำหน้า`, `ชื่อ`, `นามสกุล`, `ระดับชั้น`, `ห้อง`, `username` (เช่น `6166@psuwit.ac.th`), และ `password` (ค่าเริ่มต้น `123456`)
2. **ผู้ดูแลระบบ (`Super admin` / `admin`) จำนวน 3 คน**:
   - `winai@psuwit.ac.th` — นายวินัย รัตนพล (`super_admin`, รหัสผ่านเริ่มต้น `123456`)
   - `knok@psuwit.ac.th` — นางสาวกนก กล่อมขจิต (`admin`, รหัสผ่านเริ่มต้น `123456`)
   - `00001@psuwit.ac.th` — นายดูแลระบบ เทพสุดสุด (`super_admin`, รหัสผ่านเริ่มต้น `123456`)

### 3.2 การล็อกอินด้วย Username และ Password
- **ฝั่งนักเรียน**: ล็อกอินด้วย `Username` (สามารถกรอกเต็ม เช่น `6166@psuwit.ac.th` หรือกรอกเฉพาะรหัสนักเรียน เช่น `6166`) และ `Password` (ค่าเริ่มต้น `123456`) ระบบดึงชื่อ-นามสกุล ชั้น/ห้อง และเลขที่จากฐานข้อมูลอัตโนมัติ
- **ฝั่งผู้ดูแลระบบ (Admin)**: ล็อกอินด้วย `Username` ผู้ดูแลระบบ (`winai@psuwit.ac.th`, `knok@psuwit.ac.th`, `00001@psuwit.ac.th` หรือแอดมินที่เพิ่มใหม่) และ `Password`

### 3.3 การแก้ไขรหัสผ่านของตนเอง (Self-Service Change Password)
- ผู้ใช้งานทุกคน (ทั้งนักเรียนและผู้ดูแลระบบ) สามารถแก้ไขรหัสผ่านของตนเองได้ตลอดเวลาผ่าน:
  1. ปุ่ม **`🔑 เปลี่ยนรหัสผ่าน`** บนแถบ Header ด้านบน (`#btnHeaderChangePassword`)
  2. ปุ่ม **`🔑 เปลี่ยนรหัสผ่านของฉัน`** ในการ์ดพอร์ทัลนักเรียน
  3. ปุ่ม **`🔑 แก้ไขรหัสผ่านด้วยตนเอง`** ในหน้าล็อกอิน (`#view-auth`)
- นอกจากนี้ ผู้ดูแลระบบยังสามารถกดปุ่ม **`🔑`** ในตารางจัดการนักเรียน/ผู้ดูแลระบบ เพื่อรีเซ็ตรหัสผ่านให้ผู้ใช้กรณีลืมรหัสผ่านได้ด้วย

---

## 4. โครงสร้างฐานข้อมูลและ REST API (Database & API Reference)

### 4.1 ตารางฐานข้อมูล (`database/schema.sql`)
1. **`students`**: `id`, `student_id`, `class_no`, `title`, `first_name`, `last_name`, `name`, `email (UNIQUE)`, `username (UNIQUE)`, `password`, `grade`, `room`, `role`, `status`, `pretest_completed`, `posttest_completed`, `created_at`, `updated_at`
2. **`assessments`**: `id`, `test_id (UNIQUE)`, `student_id`, `student_name`, `email (FK)`, `grade`, `test_type`, `score_total`, `max_score (75)`, `score_percent`, `d1_score`..`d6_score`, `domain_scores_json`, `time_spent_seconds`, `violations_count`, `passed`, `submitted_at`
3. **`admins`**: `id`, `student_id`, `title`, `first_name`, `last_name`, `name`, `email (UNIQUE)`, `username (UNIQUE)`, `password`, `role ('super_admin' | 'admin')`, `created_at`, `updated_at`
4. **`system_settings`**: `setting_key (PK)`, `setting_value`, `updated_at`

### 4.2 REST API Endpoints (`server.js`)
- `POST /api/auth/login` — ตรวจสอบการเข้าสู่ระบบด้วย `username` และ `password`
- `POST /api/auth/change-password` — เปลี่ยนรหัสผ่านด้วยตนเอง (ตรวจสอบรหัสผ่านปัจจุบัน) หรือรีเซ็ตโดย Admin
- `GET /api/status` — สถานะฐานข้อมูล SQLite และจำนวนเรคคอร์ดในแต่ละตาราง
- `GET /api/students` | `POST /api/students` | `DELETE /api/students?email=...` — จัดการข้อมูลนักเรียน
- `POST /api/students/reset` — รีเซ็ตสิทธิ์การสอบ (`pretest_completed`, `posttest_completed`)
- `GET /api/assessments?grade=...` | `POST /api/assessments` — ดึงและบันทึกผลการสอบ
- `GET /api/admins` | `POST /api/admins` | `DELETE /api/admins?email=...` — ดึง เพิ่ม และลบผู้ดูแลระบบ
- `GET /api/database/export` | `POST /api/database/import` | `POST /api/database/seed` — สำรอง นำเข้า และรีเซ็ตฐานข้อมูล

---

## 5. วิธีเริ่มต้นทำงานต่อในแชทใหม่ (Quick Start for Next Session)
1. การรันเซิร์ฟเวอร์ในเครื่อง:
   ```bash
   node server.js
   ```
   เปิดใช้งานที่ `http://localhost:3000`
   - **ทดสอบฝั่งนักเรียน**: Username `6166@psuwit.ac.th` (หรือ `6166`), Password `123456`
   - **ทดสอบฝั่งผู้ดูแลระบบ (Admin)**: Username `winai@psuwit.ac.th` (หรือ `knok@psuwit.ac.th`, `00001@psuwit.ac.th`), Password `123456`
