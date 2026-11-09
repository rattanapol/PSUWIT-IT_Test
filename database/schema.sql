-- ============================================================================
-- ระบบฐานข้อมูล: ระบบทดสอบสมรรถนะเทคโนโลยีสารสนเทศ (IT Competency Assessment System)
-- โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)
-- รองรับ: SQLite 3 / MySQL / PostgreSQL
-- สร้างจากฐานข้อมูลผู้ใช้งาน user.xlsx (นักเรียน 1,465 คน + ผู้ดูแลระบบ 3 คน = 1,468 คน)
-- ============================================================================

-- 1. ตารางข้อมูลนักเรียนและผู้เข้าสอบ (students)
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id VARCHAR(32) NOT NULL,
    class_no VARCHAR(20) DEFAULT '',
    title VARCHAR(50) DEFAULT '',
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT '123456',
    grade VARCHAR(20) NOT NULL,
    room VARCHAR(20) DEFAULT '',
    role VARCHAR(30) NOT NULL DEFAULT 'student',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    pretest_completed INTEGER NOT NULL DEFAULT 0,
    posttest_completed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_username ON students(username);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);

-- 2. ตารางบันทึกผลการทดสอบสมรรถนะ IT (assessments)
CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id VARCHAR(64) NOT NULL UNIQUE,
    student_id VARCHAR(32) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    test_type VARCHAR(20) NOT NULL, -- 'Pre-test' หรือ 'Post-test'
    score_total INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 75,
    score_percent INTEGER NOT NULL DEFAULT 0,
    d1_score INTEGER NOT NULL DEFAULT 0, -- Digital Literacy & Safety (%)
    d2_score INTEGER NOT NULL DEFAULT 0, -- Hardware, Systems & Networks (%)
    d3_score INTEGER NOT NULL DEFAULT 0, -- Computational Thinking & Coding (%)
    d4_score INTEGER NOT NULL DEFAULT 0, -- Data Management & Analysis (%)
    d5_score INTEGER NOT NULL DEFAULT 0, -- Cybersecurity, Ethics & Law (%)
    d6_score INTEGER NOT NULL DEFAULT 0, -- Emerging Tech, AI & Cloud (%)
    domain_scores_json TEXT,             -- JSON เก็บคะแนนรายด้าน
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    violations_count INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email) REFERENCES students(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessments_email ON assessments(email);
CREATE INDEX IF NOT EXISTS idx_assessments_grade ON assessments(grade);
CREATE INDEX IF NOT EXISTS idx_assessments_test_type ON assessments(test_type);
CREATE INDEX IF NOT EXISTS idx_assessments_submitted_at ON assessments(submitted_at);

-- 3. ตารางรายชื่อผู้ดูแลระบบ (admins)
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id VARCHAR(32) DEFAULT '',
    title VARCHAR(50) DEFAULT '',
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT '123456',
    role VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'super_admin' หรือ 'admin'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- 4. ตารางตั้งค่าระบบ (system_settings)
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. ตารางข้อมูลผู้ใช้งานจาก Google OAuth 2.0 (users)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    google_id VARCHAR(255) DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'student', -- 'student' หรือ 'admin'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
