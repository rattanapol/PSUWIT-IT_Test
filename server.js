/**
 * Backend Server & Relational Database Engine (SQLite 3 + REST API)
 * ระบบทดสอบสมรรถนะเทคโนโลยีสารสนเทศ (IT Competency Assessment System)
 * โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)
 * รองรับฐานข้อมูลผู้ใช้งานจากไฟล์ user.xlsx (นักเรียน 1,465 คน + ผู้ดูแลระบบ 3 คน)
 * พร้อมระบบ Login ด้วย Username / Password และการเปลี่ยนรหัสผ่านด้วยตนเอง
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// โหลดค่า Environment Variables จากไฟล์ .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read .env file:', e.message);
    }
  }
}
loadEnv();

const { INITIAL_USERS_STUDENTS, INITIAL_USERS_ADMINS } = require('./js/users_data.js');

const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'database');
const SQLITE_PATH = path.join(DB_DIR, 'psuwit_it.sqlite');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ============================================================================
// ระบบจัดการฐานข้อมูล SQLite 3 (Built-in node:sqlite)
// ============================================================================
class DatabaseManager {
  constructor() {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(SQLITE_PATH);
    this.initSchema();
    this.ensureColumns();
    this.ensureUsersTable();
    this.ensurePrimaryAdmins();
    this.seedIfEmpty();
  }

  initSchema() {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    this.db.exec(schemaSql);
  }

  ensureColumns() {
    const alterStatements = [
      "ALTER TABLE students ADD COLUMN class_no VARCHAR(20) DEFAULT ''",
      "ALTER TABLE students ADD COLUMN title VARCHAR(50) DEFAULT ''",
      "ALTER TABLE students ADD COLUMN first_name VARCHAR(100) DEFAULT ''",
      "ALTER TABLE students ADD COLUMN last_name VARCHAR(100) DEFAULT ''",
      "ALTER TABLE students ADD COLUMN username VARCHAR(255) DEFAULT ''",
      "ALTER TABLE students ADD COLUMN password VARCHAR(255) DEFAULT '123456'",
      "ALTER TABLE students ADD COLUMN room VARCHAR(20) DEFAULT ''",
      "ALTER TABLE students ADD COLUMN role VARCHAR(30) DEFAULT 'student'",
      "ALTER TABLE admins ADD COLUMN student_id VARCHAR(32) DEFAULT ''",
      "ALTER TABLE admins ADD COLUMN title VARCHAR(50) DEFAULT ''",
      "ALTER TABLE admins ADD COLUMN first_name VARCHAR(100) DEFAULT ''",
      "ALTER TABLE admins ADD COLUMN last_name VARCHAR(100) DEFAULT ''",
      "ALTER TABLE admins ADD COLUMN username VARCHAR(255) DEFAULT ''",
      "ALTER TABLE admins ADD COLUMN password VARCHAR(255) DEFAULT '123456'",
      "ALTER TABLE admins ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const stmt of alterStatements) {
      try {
        this.db.exec(stmt);
      } catch (e) {}
    }
  }

  ensureUsersTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        google_id VARCHAR(255) DEFAULT '',
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    `);
  }

  ensurePrimaryAdmins() {
    const insertAdmin = this.db.prepare(`
      INSERT OR IGNORE INTO admins (student_id, title, first_name, last_name, name, email, username, password, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    for (const a of INITIAL_USERS_ADMINS) {
      const uname = (a.username || a.email || '').toLowerCase();
      insertAdmin.run(
        a.student_id || '',
        a.title || '',
        a.first_name || '',
        a.last_name || '',
        a.name || uname,
        uname,
        uname,
        a.password || '123456',
        a.role || 'admin'
      );
    }
  }

  seedIfEmpty() {
    const countRow = this.db.prepare('SELECT COUNT(*) AS cnt FROM students').get();
    if (!countRow || countRow.cnt < 100) {
      this.seedDatabase();
    }
  }

  seedDatabase() {
    const now = new Date().toISOString();
    this.db.exec('BEGIN TRANSACTION');
    try {
      const insertStudent = this.db.prepare(`
        INSERT OR REPLACE INTO students (
          student_id, class_no, title, first_name, last_name, name,
          email, username, password, grade, room, role, status,
          pretest_completed, posttest_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of INITIAL_USERS_STUDENTS) {
        const uname = (s.username || s.email || '').toLowerCase();
        insertStudent.run(
          s.student_id || '',
          s.class_no || '',
          s.title || '',
          s.first_name || '',
          s.last_name || '',
          s.name || '',
          uname,
          uname,
          s.password || '123456',
          s.grade || 'ม.1',
          s.room || '',
          'student',
          s.status || 'active',
          s.pretest_completed ? 1 : 0,
          s.posttest_completed ? 1 : 0,
          now,
          now
        );
      }

      const insertAdmin = this.db.prepare(`
        INSERT OR REPLACE INTO admins (
          student_id, title, first_name, last_name, name,
          email, username, password, role, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const a of INITIAL_USERS_ADMINS) {
        const uname = (a.username || a.email || '').toLowerCase();
        insertAdmin.run(
          a.student_id || '',
          a.title || '',
          a.first_name || '',
          a.last_name || '',
          a.name || '',
          uname,
          uname,
          a.password || '123456',
          a.role || 'admin',
          now,
          now
        );
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // Normalize username: รองรับทั้งการพิมพ์เต็ม เช่น 6166@psuwit.ac.th หรือพิมพ์เฉพาะรหัส เช่น 6166 หรือ winai
  normalizeUsernameCandidates(rawInput) {
    const clean = String(rawInput || '').trim().toLowerCase();
    if (!clean) return [];
    const candidates = [clean];
    if (!clean.includes('@')) {
      candidates.push(`${clean}@psuwit.ac.th`);
    }
    return candidates;
  }

  // ตรวจสอบการเข้าสู่ระบบด้วย Username และ Password
  authenticateUser(rawUsername, rawPassword, loginRole = 'any') {
    const candidates = this.normalizeUsernameCandidates(rawUsername);
    const pwd = String(rawPassword ?? '');

    if (candidates.length === 0 || !pwd) {
      return { success: false, message: 'กรุณากรอก Username และ Password ให้ครบถ้วน' };
    }

    // 1. ค้นหาในตาราง admins
    let adminMatch = null;
    for (const cand of candidates) {
      adminMatch = this.db.prepare(
        'SELECT * FROM admins WHERE LOWER(username) = ? OR LOWER(email) = ? OR student_id = ?'
      ).get(cand, cand, cand);
      if (adminMatch) break;
    }

    // 2. ค้นหาในตาราง students
    let studentMatch = null;
    for (const cand of candidates) {
      studentMatch = this.db.prepare(
        'SELECT * FROM students WHERE LOWER(username) = ? OR LOWER(email) = ? OR student_id = ?'
      ).get(cand, cand, cand);
      if (studentMatch) break;
    }

    if (loginRole === 'admin') {
      if (!adminMatch) {
        if (studentMatch) {
          return {
            success: false,
            message: '🚫 บัญชีนี้เป็นบัญชีนักเรียน ไม่มีสิทธิ์เข้าใช้งานส่วนผู้ดูแลระบบ (Admin)'
          };
        }
        return { success: false, message: '❌ ไม่พบบัญชีผู้ดูแลระบบนี้ในฐานข้อมูล' };
      }

      if (String(adminMatch.password) !== pwd) {
        return { success: false, message: '❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' };
      }

      return {
        success: true,
        user: {
          student_id: adminMatch.student_id || '',
          title: adminMatch.title || '',
          first_name: adminMatch.first_name || '',
          last_name: adminMatch.last_name || '',
          name: adminMatch.name,
          email: adminMatch.email,
          username: adminMatch.username || adminMatch.email,
          grade: '-',
          room: '-',
          role: 'admin',
          adminRole: adminMatch.role || 'admin',
          status: 'active'
        }
      };
    }

    // กรณีล็อกอินฝั่งนักเรียน (หรือทั่วไป): หากเป็นนักเรียนให้ตรวจรหัสผ่านนักเรียนก่อน หากเป็นแอดมินก็สามารถล็อกอินเข้าได้เช่นกัน
    if (studentMatch) {
      if (studentMatch.status === 'suspended') {
        return {
          success: false,
          message: '🚫 บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ'
        };
      }
      if (String(studentMatch.password) !== pwd) {
        return { success: false, message: '❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' };
      }

      return {
        success: true,
        user: {
          student_id: studentMatch.student_id,
          class_no: studentMatch.class_no || '',
          title: studentMatch.title || '',
          first_name: studentMatch.first_name || '',
          last_name: studentMatch.last_name || '',
          name: studentMatch.name,
          email: studentMatch.email,
          username: studentMatch.username || studentMatch.email,
          grade: studentMatch.grade,
          room: studentMatch.room || '',
          role: 'student',
          status: studentMatch.status || 'active',
          pretest_completed: Boolean(studentMatch.pretest_completed),
          posttest_completed: Boolean(studentMatch.posttest_completed)
        }
      };
    }

    if (adminMatch) {
      if (String(adminMatch.password) !== pwd) {
        return { success: false, message: '❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' };
      }
      return {
        success: true,
        user: {
          student_id: adminMatch.student_id || '',
          title: adminMatch.title || '',
          first_name: adminMatch.first_name || '',
          last_name: adminMatch.last_name || '',
          name: adminMatch.name,
          email: adminMatch.email,
          username: adminMatch.username || adminMatch.email,
          grade: '-',
          room: '-',
          role: 'admin',
          adminRole: adminMatch.role || 'admin',
          status: 'active'
        }
      };
    }

    return {
      success: false,
      message: '❌ ไม่พบชื่อผู้ใช้งาน (Username) นี้ในระบบ กรุณาตรวจสอบอีกครั้ง'
    };
  }

  // เปลี่ยนรหัสผ่านของผู้ใช้งาน (รองรับทั้งนักเรียนและผู้ดูแลระบบ รวมถึงการรีเซ็ตโดย Admin)
  changePassword(rawUsername, currentPassword, newPassword, isAdminReset = false) {
    const candidates = this.normalizeUsernameCandidates(rawUsername);
    const curPwd = String(currentPassword ?? '');
    const nextPwd = String(newPassword ?? '').trim();

    if (candidates.length === 0) {
      return { success: false, message: 'ไม่พบชื่อผู้ใช้งาน (Username)' };
    }
    if (!nextPwd || nextPwd.length < 4) {
      return { success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
    }

    const now = new Date().toISOString();
    let updatedAny = false;

    // ตรวจสอบในตาราง students
    let studentMatch = null;
    for (const cand of candidates) {
      studentMatch = this.db.prepare(
        'SELECT * FROM students WHERE LOWER(username) = ? OR LOWER(email) = ? OR student_id = ?'
      ).get(cand, cand, cand);
      if (studentMatch) break;
    }

    // ตรวจสอบในตาราง admins
    let adminMatch = null;
    for (const cand of candidates) {
      adminMatch = this.db.prepare(
        'SELECT * FROM admins WHERE LOWER(username) = ? OR LOWER(email) = ? OR student_id = ?'
      ).get(cand, cand, cand);
      if (adminMatch) break;
    }

    if (!studentMatch && !adminMatch) {
      return { success: false, message: '❌ ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' };
    }

    if (studentMatch) {
      if (!isAdminReset && String(studentMatch.password) !== curPwd) {
        return { success: false, message: '❌ รหัสผ่านปัจจุบันไม่ถูกต้อง' };
      }
      this.db.prepare('UPDATE students SET password = ?, updated_at = ? WHERE id = ?').run(nextPwd, now, studentMatch.id);
      updatedAny = true;
    }

    if (adminMatch) {
      if (!isAdminReset && !updatedAny && String(adminMatch.password) !== curPwd) {
        return { success: false, message: '❌ รหัสผ่านปัจจุบันไม่ถูกต้อง' };
      }
      this.db.prepare('UPDATE admins SET password = ?, updated_at = ? WHERE id = ?').run(nextPwd, now, adminMatch.id);
      updatedAny = true;
    }

    return {
      success: true,
      message: '✅ เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป'
    };
  }

  getStatus() {
    const studentCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM students').get().cnt;
    const assessmentCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM assessments').get().cnt;
    const adminCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM admins').get().cnt;
    let userCount = 0;
    try {
      userCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
    } catch (e) {}
    let fileSize = 0;
    try {
      fileSize = fs.statSync(SQLITE_PATH).size;
    } catch (e) {}

    return {
      status: 'connected',
      engine: 'SQLite 3 (Relational Database)',
      database_file: 'database/psuwit_it.sqlite',
      file_size_bytes: fileSize,
      tables: {
        users: userCount,
        students: studentCount,
        assessments: assessmentCount,
        admins: adminCount
      },
      timestamp: new Date().toISOString()
    };
  }

  getUsers() {
    return this.db.prepare('SELECT * FROM users ORDER BY id DESC').all();
  }

  saveGoogleUser(profile) {
    const cleanEmail = (profile.email || '').trim().toLowerCase();
    const fullName = (profile.full_name || profile.name || cleanEmail.split('@')[0]).trim();
    const studentId = (profile.student_id || cleanEmail.split('@')[0]).trim();
    const googleId = (profile.google_id || '').trim();
    const role = profile.role || 'student';
    const now = new Date().toISOString();

    const existing = this.db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      this.db.prepare(`
        UPDATE users
        SET full_name = ?, student_id = ?, google_id = ?, role = ?, updated_at = ?
        WHERE id = ?
      `).run(fullName, studentId, googleId || existing.google_id || '', role, now, existing.id);
    } else {
      this.db.prepare(`
        INSERT INTO users (email, full_name, student_id, google_id, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(cleanEmail, fullName, studentId, googleId, role, now, now);
    }

    return this.db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  }

  getAdmins() {
    this.ensurePrimaryAdmins();
    return this.db.prepare('SELECT * FROM admins ORDER BY id ASC').all();
  }

  saveAdmin(data) {
    const email = (data.email || data.username || '').trim().toLowerCase();
    const name = (data.name || email.split('@')[0] || 'ผู้ดูแลระบบ').trim();
    const role = (email === 'winai@psuwit.ac.th' || email === '00001@psuwit.ac.th') ? 'super_admin' : (data.role || 'admin');
    const existing = this.db.prepare('SELECT * FROM admins WHERE LOWER(email) = ? OR LOWER(username) = ?').get(email, email);
    const password = data.password || (existing && existing.password) || '123456';
    const now = new Date().toISOString();

    if (existing) {
      this.db.prepare(`
        UPDATE admins
        SET student_id = ?, name = ?, password = ?, role = ?, updated_at = ?
        WHERE id = ?
      `).run(data.student_id || existing.student_id || '', name, password, role, now, existing.id);
    } else {
      this.db.prepare(`
        INSERT INTO admins (student_id, title, first_name, last_name, name, email, username, password, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.student_id || '',
        data.title || '',
        data.first_name || '',
        data.last_name || '',
        name,
        email,
        email,
        password,
        role,
        now,
        now
      );
    }

    return this.db.prepare('SELECT * FROM admins WHERE LOWER(email) = ?').get(email);
  }

  deleteAdmin(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === 'winai@psuwit.ac.th') {
      throw new Error('ไม่สามารถลบผู้ดูแลระบบหลัก (winai@psuwit.ac.th) ได้');
    }
    this.db.prepare('DELETE FROM admins WHERE LOWER(email) = ? OR LOWER(username) = ?').run(cleanEmail, cleanEmail);
    return true;
  }

  getStudents() {
    const rows = this.db.prepare('SELECT * FROM students ORDER BY id ASC').all();
    return rows.map(r => ({
      id: r.id,
      student_id: r.student_id,
      class_no: r.class_no || '',
      title: r.title || '',
      first_name: r.first_name || '',
      last_name: r.last_name || '',
      name: r.name,
      email: r.email,
      username: r.username || r.email,
      password: r.password || '123456',
      grade: r.grade,
      room: r.room || '',
      role: r.role || 'student',
      status: r.status,
      pretest_completed: Boolean(r.pretest_completed),
      posttest_completed: Boolean(r.posttest_completed),
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  saveStudent(data) {
    const email = (data.email || data.username || '').trim().toLowerCase();
    const existing = this.db.prepare('SELECT * FROM students WHERE LOWER(email) = ? OR LOWER(username) = ?').get(email, email);
    const now = new Date().toISOString();

    if (existing) {
      this.db.prepare(`
        UPDATE students
        SET student_id = ?, class_no = ?, title = ?, first_name = ?, last_name = ?,
            name = ?, password = ?, grade = ?, room = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        data.student_id !== undefined ? data.student_id : existing.student_id,
        data.class_no !== undefined ? data.class_no : (existing.class_no || ''),
        data.title !== undefined ? data.title : (existing.title || ''),
        data.first_name !== undefined ? data.first_name : (existing.first_name || ''),
        data.last_name !== undefined ? data.last_name : (existing.last_name || ''),
        data.name || existing.name,
        data.password || existing.password || '123456',
        data.grade || existing.grade,
        data.room !== undefined ? data.room : (existing.room || ''),
        data.status || existing.status,
        now,
        existing.id
      );
    } else {
      this.db.prepare(`
        INSERT INTO students (
          student_id, class_no, title, first_name, last_name, name,
          email, username, password, grade, room, role, status,
          pretest_completed, posttest_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.student_id || `ID-${Date.now().toString().slice(-4)}`,
        data.class_no || '',
        data.title || '',
        data.first_name || '',
        data.last_name || '',
        data.name || '',
        email,
        email,
        data.password || '123456',
        data.grade || 'ม.1',
        data.room || '',
        'student',
        data.status || 'active',
        data.pretest_completed ? 1 : 0,
        data.posttest_completed ? 1 : 0,
        now,
        now
      );
    }

    return this.db.prepare('SELECT * FROM students WHERE LOWER(email) = ?').get(email);
  }

  deleteStudent(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    this.db.prepare('DELETE FROM students WHERE LOWER(email) = ? OR LOWER(username) = ?').run(cleanEmail, cleanEmail);
    return true;
  }

  resetAttempts(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE students
      SET pretest_completed = 0, posttest_completed = 0, updated_at = ?
      WHERE LOWER(email) = ? OR LOWER(username) = ?
    `).run(now, cleanEmail, cleanEmail);
    return true;
  }

  // เลื่อนชั้นหรือแก้ไขระดับชั้น/ห้องเรียนแบบกลุ่ม (ทั้งระดับชั้น หรือ ทั้งห้องเรียน) โดยยังคงประวัติผลสอบชั้นปีเดิมไว้ครบถ้วน
  bulkUpdateGrade(payload) {
    const mode = payload.mode || 'single_rule';
    const now = new Date().toISOString();
    let updatedCount = 0;

    const applyRule = (srcGrade, srcRoom, dstGrade, dstRoom) => {
      let query = 'SELECT * FROM students WHERE grade = ?';
      const params = [srcGrade];
      if (srcRoom && srcRoom !== 'all') {
        query += ' AND room = ?';
        params.push(String(srcRoom));
      }
      const targets = this.db.prepare(query).all(...params);
      const updateStmt = this.db.prepare(`
        UPDATE students
        SET grade = ?, room = ?, pretest_completed = ?, posttest_completed = ?, updated_at = ?
        WHERE id = ?
      `);
      const checkAssessStmt = this.db.prepare(`
        SELECT test_type FROM assessments WHERE LOWER(email) = ? AND grade = ?
      `);

      for (const st of targets) {
        const nextRoom = (!dstRoom || dstRoom === 'keep') ? (st.room || '') : String(dstRoom);
        const existingTests = checkAssessStmt.all((st.email || '').toLowerCase(), dstGrade);
        const hasPre = existingTests.some(t => t.test_type === 'Pre-test') ? 1 : 0;
        const hasPost = existingTests.some(t => t.test_type === 'Post-test') ? 1 : 0;
        updateStmt.run(dstGrade, nextRoom, hasPre, hasPost, now, st.id);
        updatedCount++;
      }
    };

    this.db.exec('BEGIN TRANSACTION');
    try {
      if (mode === 'promote_junior') {
        // เลื่อนชั้น ม.ต้น (ม.2 -> ม.3 ก่อน แล้วตามด้วย ม.1 -> ม.2)
        applyRule('ม.2', 'all', 'ม.3', 'keep');
        applyRule('ม.1', 'all', 'ม.2', 'keep');
      } else if (mode === 'promote_senior') {
        // เลื่อนชั้น ม.ปลาย (ม.5 -> ม.6 ก่อน แล้วตามด้วย ม.4 -> ม.5)
        applyRule('ม.5', 'all', 'ม.6', 'keep');
        applyRule('ม.4', 'all', 'ม.5', 'keep');
      } else {
        // แก้ไขตามระดับชั้น หรือ ตามห้องเรียนที่ระบุ
        applyRule(
          payload.sourceGrade,
          payload.sourceRoom || 'all',
          payload.targetGrade,
          payload.targetRoom || 'keep'
        );
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }

    return { updatedCount };
  }

  getAssessments(gradeFilter = 'all', emailFilter = '') {
    let query = 'SELECT * FROM assessments WHERE 1=1';
    const params = [];

    if (gradeFilter && gradeFilter !== 'all') {
      query += ' AND grade = ?';
      params.push(gradeFilter);
    }
    if (emailFilter) {
      query += ' AND LOWER(email) = ?';
      params.push(emailFilter.trim().toLowerCase());
    }

    query += ' ORDER BY submitted_at DESC, id DESC';
    const rows = this.db.prepare(query).all(...params);

    return rows.map(r => {
      let domainScores = {
        D1: r.d1_score,
        D2: r.d2_score,
        D3: r.d3_score,
        D4: r.d4_score,
        D5: r.d5_score,
        D6: r.d6_score
      };
      if (r.domain_scores_json) {
        try {
          domainScores = JSON.parse(r.domain_scores_json);
        } catch (e) {}
      }
      return {
        id: r.id,
        test_id: r.test_id,
        student_id: r.student_id,
        student_name: r.student_name,
        email: r.email,
        grade: r.grade,
        test_type: r.test_type,
        score_total: r.score_total,
        max_score: r.max_score,
        score_percent: r.score_percent,
        domain_scores: domainScores,
        time_spent_seconds: r.time_spent_seconds,
        violations_count: r.violations_count,
        passed: Boolean(r.passed),
        submitted_at: r.submitted_at
      };
    });
  }

  saveAssessment(data) {
    const testId = data.test_id || ('T-' + Date.now());
    const email = (data.email || '').trim().toLowerCase();
    const submittedAt = data.submitted_at || new Date().toISOString();
    const dScores = data.domain_scores || {};

    this.db.prepare(`
      INSERT OR REPLACE INTO assessments (
        test_id, student_id, student_name, email, grade, test_type,
        score_total, max_score, score_percent,
        d1_score, d2_score, d3_score, d4_score, d5_score, d6_score,
        domain_scores_json, time_spent_seconds, violations_count, passed, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testId,
      data.student_id || '',
      data.student_name || '',
      email,
      data.grade || 'ม.1',
      data.test_type || 'Pre-test',
      Number(data.score_total || 0),
      Number(data.max_score || 75),
      Number(data.score_percent || 0),
      Number(dScores.D1 || 0),
      Number(dScores.D2 || 0),
      Number(dScores.D3 || 0),
      Number(dScores.D4 || 0),
      Number(dScores.D5 || 0),
      Number(dScores.D6 || 0),
      JSON.stringify(dScores),
      Number(data.time_spent_seconds || 0),
      Number(data.violations_count || 0),
      data.passed ? 1 : 0,
      submittedAt
    );

    if (data.test_type === 'Pre-test') {
      this.db.prepare('UPDATE students SET pretest_completed = 1, updated_at = ? WHERE LOWER(email) = ?').run(submittedAt, email);
    } else if (data.test_type === 'Post-test') {
      this.db.prepare('UPDATE students SET posttest_completed = 1, updated_at = ? WHERE LOWER(email) = ?').run(submittedAt, email);
    }

    return {
      test_id: testId,
      student_id: data.student_id || '',
      student_name: data.student_name || '',
      email: email,
      grade: data.grade || 'ม.1',
      test_type: data.test_type || 'Pre-test',
      score_total: Number(data.score_total || 0),
      max_score: Number(data.max_score || 75),
      score_percent: Number(data.score_percent || 0),
      domain_scores: dScores,
      time_spent_seconds: Number(data.time_spent_seconds || 0),
      violations_count: Number(data.violations_count || 0),
      passed: Boolean(data.passed),
      submitted_at: submittedAt
    };
  }

  importDatabase(payload) {
    if (Array.isArray(payload.students)) {
      for (const s of payload.students) {
        this.saveStudent(s);
      }
    }
    if (Array.isArray(payload.assessments)) {
      for (const a of payload.assessments) {
        this.saveAssessment(a);
      }
    }
    return this.getStatus();
  }

  resetAndSeedDatabase() {
    this.db.exec('DELETE FROM assessments; DELETE FROM students; DELETE FROM admins;');
    this.seedDatabase();
    return this.getStatus();
  }

  getSettings() {
    const rows = this.db.prepare('SELECT setting_key, setting_value FROM system_settings').all();
    const out = {};
    for (const r of rows) {
      out[r.setting_key] = r.setting_value;
    }
    return out;
  }

  saveSettings(settingsObj) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO system_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(settingsObj || {})) {
      stmt.run(k, String(v ?? ''), now);
    }
    return this.getSettings();
  }
}

const dbManager = new DatabaseManager();

// ============================================================================
// HTTP Server & REST API Router
// ============================================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.sql': 'text/plain; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ถอดรหัส Base64URL JWT Payload ของ Google ID Token
function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// ตรวจสอบ Google ID Token กับ Google TokenInfo Endpoint (พร้อม Fallback ถอดรหัสในเครื่อง)
function verifyGoogleToken(idToken) {
  return new Promise((resolve) => {
    if (!idToken) return resolve(null);
    const decoded = decodeJwtPayload(idToken);

    // ลองตรวจสอบกับ Google API ผ่าน HTTPS
    try {
      const req = https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const info = JSON.parse(data);
              return resolve(info);
            }
          } catch (e) {}
          // หากสถานะไม่ใช่ 200 ให้ใช้ decoded token
          resolve(decoded);
        });
      });
      req.on('error', () => {
        resolve(decoded);
      });
      req.setTimeout(4000, () => {
        req.destroy();
        resolve(decoded);
      });
    } catch (e) {
      resolve(decoded);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --------------------------------------------------------------------------
  // REST API Endpoints (/api/*)
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/status' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'success', data: dbManager.getStatus() });
      }

      if (pathname === '/api/auth/config' && req.method === 'GET') {
        return sendJson(res, 200, {
          status: 'success',
          data: {
            googleClientId: process.env.GOOGLE_CLIENT_ID || '',
            hostedDomain: 'psuwit.ac.th'
          }
        });
      }

      if (pathname === '/api/auth/google' && req.method === 'POST') {
        const body = await parseBody(req);
        let email = '';
        let fullName = '';
        let googleId = '';

        if (body.credential) {
          const verified = await verifyGoogleToken(body.credential);
          if (!verified || !verified.email) {
            return sendJson(res, 400, {
              status: 'error',
              message: '❌ ไม่สามารถตรวจสอบความถูกต้องของ Google ID Token ได้'
            });
          }
          email = (verified.email || '').toLowerCase().trim();
          fullName = verified.name || verified.given_name || email.split('@')[0];
          googleId = verified.sub || '';
        } else if (body.email) {
          // โหมดทดสอบ Localhost (Direct Simulation)
          email = String(body.email).toLowerCase().trim();
          fullName = body.name || body.full_name || email.split('@')[0];
          googleId = body.google_id || `sim_${Date.now()}`;
        } else {
          return sendJson(res, 400, {
            status: 'error',
            message: '❌ กรุณาระบุ Google Credential หรือ Email'
          });
        }

        // [สำคัญ] ตรวจสอบ Domain Restriction: ต้องลงท้ายด้วย @psuwit.ac.th เท่านั้น
        if (!email.endsWith('@psuwit.ac.th')) {
          return sendJson(res, 403, {
            status: 'error',
            error_code: 'DOMAIN_RESTRICTED',
            message: 'อนุญาตเฉพาะนักเรียน/บุคลากรภายในองค์กรเท่านั้น'
          });
        }

        // สกัดรหัสนักเรียน/บุคลากรจากชื่อส่วนหน้าของอีเมล (เช่น 50015@psuwit.ac.th -> 50015)
        const studentId = email.split('@')[0];

        // ตรวจสอบสิทธิ์ว่าเป็น Admin หรือไม่
        const adminMatch = dbManager.db.prepare('SELECT * FROM admins WHERE LOWER(email) = ? OR LOWER(username) = ?').get(email, email);
        const role = adminMatch ? (adminMatch.role || 'admin') : 'student';

        // บันทึกข้อมูลลงตาราง users
        const userRow = dbManager.saveGoogleUser({
          email,
          full_name: fullName,
          student_id: studentId,
          google_id: googleId,
          role: role === 'super_admin' ? 'admin' : role
        });

        // หากเป็นนักเรียน ให้เชื่อมโยงกับตาราง students
        let studentRow = null;
        if (role === 'student') {
          studentRow = dbManager.db.prepare('SELECT * FROM students WHERE LOWER(email) = ? OR LOWER(username) = ?').get(email, email);
          if (!studentRow) {
            const now = new Date().toISOString();
            dbManager.db.prepare(`
              INSERT INTO students (
                student_id, name, email, username, password, grade, room, role, status,
                pretest_completed, posttest_completed, created_at, updated_at
              ) VALUES (?, ?, ?, ?, '123456', 'ม.1', '', 'student', 'active', 0, 0, ?, ?)
            `).run(studentId, fullName, email, email, now, now);
            studentRow = dbManager.db.prepare('SELECT * FROM students WHERE LOWER(email) = ?').get(email);
          } else if (fullName && (!studentRow.name || studentRow.name === studentRow.email)) {
            dbManager.db.prepare('UPDATE students SET name = ?, updated_at = ? WHERE id = ?').run(fullName, new Date().toISOString(), studentRow.id);
            studentRow.name = fullName;
          }
        }

        return sendJson(res, 200, {
          status: 'success',
          data: {
            id: userRow.id,
            student_id: studentId,
            name: fullName || userRow.full_name,
            email: userRow.email,
            username: userRow.email,
            google_id: userRow.google_id,
            role: role,
            adminRole: adminMatch ? (adminMatch.role || 'admin') : null,
            grade: studentRow ? studentRow.grade : '-',
            room: studentRow ? studentRow.room : '-',
            class_no: studentRow ? studentRow.class_no : '',
            status: studentRow ? studentRow.status : 'active',
            pretest_completed: studentRow ? Boolean(studentRow.pretest_completed) : false,
            posttest_completed: studentRow ? Boolean(studentRow.posttest_completed) : false
          }
        });
      }

      if (pathname === '/api/users' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'success', data: dbManager.getUsers() });
      }

      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await parseBody(req);
        const result = dbManager.authenticateUser(body.username, body.password, body.loginRole || 'any');
        if (!result.success) {
          return sendJson(res, 401, { status: 'error', message: result.message });
        }
        return sendJson(res, 200, { status: 'success', data: result.user });
      }

      if (pathname === '/api/auth/change-password' && req.method === 'POST') {
        const body = await parseBody(req);
        const result = dbManager.changePassword(
          body.username,
          body.currentPassword,
          body.newPassword,
          Boolean(body.isAdminReset)
        );
        if (!result.success) {
          return sendJson(res, 400, { status: 'error', message: result.message });
        }
        return sendJson(res, 200, { status: 'success', message: result.message });
      }

      if (pathname === '/api/students' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'success', data: dbManager.getStudents() });
      }

      if (pathname === '/api/students' && req.method === 'POST') {
        const body = await parseBody(req);
        const saved = dbManager.saveStudent(body);
        return sendJson(res, 200, { status: 'success', data: saved });
      }

      if (pathname === '/api/students' && req.method === 'DELETE') {
        const email = query.email;
        dbManager.deleteStudent(email);
        return sendJson(res, 200, { status: 'success', message: 'Deleted student' });
      }

      if (pathname === '/api/students/reset' && req.method === 'POST') {
        const body = await parseBody(req);
        dbManager.resetAttempts(body.email);
        return sendJson(res, 200, { status: 'success', message: 'Reset attempts' });
      }

      if (pathname === '/api/students/bulk-grade' && req.method === 'POST') {
        const body = await parseBody(req);
        const result = dbManager.bulkUpdateGrade(body);
        return sendJson(res, 200, { status: 'success', data: result });
      }

      if (pathname === '/api/assessments' && req.method === 'GET') {
        const list = dbManager.getAssessments(query.grade || 'all', query.email || '');
        return sendJson(res, 200, { status: 'success', data: list });
      }

      if (pathname === '/api/assessments' && req.method === 'POST') {
        const body = await parseBody(req);
        const saved = dbManager.saveAssessment(body);
        return sendJson(res, 200, { status: 'success', data: saved });
      }

      if (pathname === '/api/admins' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'success', data: dbManager.getAdmins() });
      }

      if (pathname === '/api/admins' && req.method === 'POST') {
        const body = await parseBody(req);
        const saved = dbManager.saveAdmin(body);
        return sendJson(res, 200, { status: 'success', data: saved });
      }

      if (pathname === '/api/admins' && req.method === 'DELETE') {
        const email = query.email;
        dbManager.deleteAdmin(email);
        return sendJson(res, 200, { status: 'success', message: 'Deleted admin' });
      }

      if (pathname === '/api/database/export' && req.method === 'GET') {
        const dump = {
          metadata: dbManager.getStatus(),
          students: dbManager.getStudents(),
          assessments: dbManager.getAssessments('all'),
          admins: dbManager.getAdmins()
        };
        return sendJson(res, 200, { status: 'success', data: dump });
      }

      if (pathname === '/api/database/import' && req.method === 'POST') {
        const body = await parseBody(req);
        const status = dbManager.importDatabase(body);
        return sendJson(res, 200, { status: 'success', data: status });
      }

      if (pathname === '/api/database/seed' && req.method === 'POST') {
        const status = dbManager.resetAndSeedDatabase();
        return sendJson(res, 200, { status: 'success', data: status });
      }

      if (pathname === '/api/settings' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'success', data: dbManager.getSettings() });
      }

      if (pathname === '/api/settings' && req.method === 'POST') {
        const body = await parseBody(req);
        const saved = dbManager.saveSettings(body);
        return sendJson(res, 200, { status: 'success', data: saved });
      }

      return sendJson(res, 404, { status: 'error', message: 'API endpoint not found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { status: 'error', message: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // Static File Serving
  // --------------------------------------------------------------------------
  let targetPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, targetPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 PSU WIT IT Assessment Server & SQLite Database Running`);
  console.log(`👉 URL: http://localhost:${PORT}`);
  console.log(`🗄️  Database: ${SQLITE_PATH}`);
  console.log(`================================================================`);
});
