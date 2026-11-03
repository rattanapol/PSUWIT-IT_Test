/**
 * Backend Server & Relational Database Engine (SQLite 3 + REST API)
 * ระบบทดสอบสมรรถนะเทคโนโลยีสารสนเทศ (IT Competency Assessment System)
 * โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'database');
const SQLITE_PATH = path.join(DB_DIR, 'psuwit_it.sqlite');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ============================================================================
// ข้อมูลตัวอย่างเริ่มต้น (Initial Seed Data)
// ============================================================================
const INITIAL_STUDENTS = [
  { student_id: "1001", name: "เด็กชายกิตติศักดิ์ มณีโชติ", email: "1001@psuwit.ac.th", grade: "ม.1", status: "active", pretest_completed: 1, posttest_completed: 0, created_at: "2026-05-10T08:30:00Z" },
  { student_id: "1002", name: "เด็กหญิงกมลวรรณ ชัยเจริญ", email: "1002@psuwit.ac.th", grade: "ม.1", status: "active", pretest_completed: 1, posttest_completed: 1, created_at: "2026-05-10T09:00:00Z" },
  { student_id: "2001", name: "เด็กชายนภดล รัตนโกสินทร์", email: "2001@psuwit.ac.th", grade: "ม.2", status: "active", pretest_completed: 1, posttest_completed: 0, created_at: "2026-05-11T10:15:00Z" },
  { student_id: "3001", name: "เด็กหญิงชญานิษฐ์ วรรณกรรม", email: "3001@psuwit.ac.th", grade: "ม.3", status: "active", pretest_completed: 1, posttest_completed: 1, created_at: "2026-05-12T11:20:00Z" },
  { student_id: "4001", name: "นายธนภัทร สุขสมบูรณ์", email: "4001@psuwit.ac.th", grade: "ม.4", status: "active", pretest_completed: 1, posttest_completed: 1, created_at: "2026-05-13T13:45:00Z" },
  { student_id: "5001", name: "นางสาวศศิธร เปล่งศรี", email: "5001@psuwit.ac.th", grade: "ม.5", status: "active", pretest_completed: 1, posttest_completed: 0, created_at: "2026-05-14T14:10:00Z" },
  { student_id: "6001", name: "นายวริทธิ์ อัครเดชาภิรมย์", email: "6001@psuwit.ac.th", grade: "ม.6", status: "active", pretest_completed: 1, posttest_completed: 1, created_at: "2026-05-15T15:00:00Z" }
];

const INITIAL_ASSESSMENTS = [
  {
    test_id: "T-1715320000001",
    student_id: "1001",
    student_name: "เด็กชายกิตติศักดิ์ มณีโชติ",
    email: "1001@psuwit.ac.th",
    grade: "ม.1",
    test_type: "Pre-test",
    score_total: 45,
    max_score: 75,
    score_percent: 60,
    domain_scores: { D1: 60, D2: 80, D3: 40, D4: 60, D5: 80, D6: 40 },
    time_spent_seconds: 520,
    violations_count: 0,
    passed: 1,
    submitted_at: "2026-05-10T09:15:00Z"
  },
  {
    test_id: "T-1715320000002",
    student_id: "1002",
    student_name: "เด็กหญิงกมลวรรณ ชัยเจริญ",
    email: "1002@psuwit.ac.th",
    grade: "ม.1",
    test_type: "Pre-test",
    score_total: 48,
    max_score: 75,
    score_percent: 64,
    domain_scores: { D1: 60, D2: 80, D3: 60, D4: 60, D5: 60, D6: 60 },
    time_spent_seconds: 480,
    violations_count: 0,
    passed: 1,
    submitted_at: "2026-05-10T09:30:00Z"
  },
  {
    test_id: "T-1715320000003",
    student_id: "1002",
    student_name: "เด็กหญิงกมลวรรณ ชัยเจริญ",
    email: "1002@psuwit.ac.th",
    grade: "ม.1",
    test_type: "Post-test",
    score_total: 68,
    max_score: 75,
    score_percent: 91,
    domain_scores: { D1: 100, D2: 80, D3: 100, D4: 80, D5: 100, D6: 80 },
    time_spent_seconds: 410,
    violations_count: 0,
    passed: 1,
    submitted_at: "2026-05-10T11:45:00Z"
  },
  {
    test_id: "T-1715320000004",
    student_id: "4001",
    student_name: "นายธนภัทร สุขสมบูรณ์",
    email: "4001@psuwit.ac.th",
    grade: "ม.4",
    test_type: "Pre-test",
    score_total: 50,
    max_score: 75,
    score_percent: 67,
    domain_scores: { D1: 80, D2: 60, D3: 60, D4: 80, D5: 60, D6: 60 },
    time_spent_seconds: 640,
    violations_count: 1,
    passed: 1,
    submitted_at: "2026-05-13T14:10:00Z"
  },
  {
    test_id: "T-1715320000005",
    student_id: "4001",
    student_name: "นายธนภัทร สุขสมบูรณ์",
    email: "4001@psuwit.ac.th",
    grade: "ม.4",
    test_type: "Post-test",
    score_total: 70,
    max_score: 75,
    score_percent: 93,
    domain_scores: { D1: 100, D2: 100, D3: 80, D4: 100, D5: 100, D6: 80 },
    time_spent_seconds: 510,
    violations_count: 0,
    passed: 1,
    submitted_at: "2026-05-13T16:00:00Z"
  }
];

const INITIAL_ADMINS = [
  {
    email: "winai@psuwit.ac.th",
    name: "อาจารย์วินัย (ผู้ดูแลระบบหลัก)",
    role: "super_admin",
    created_at: "2026-05-01T08:00:00Z"
  }
];

// ============================================================================
// ระบบจัดการฐานข้อมูล SQLite 3 (Built-in node:sqlite)
// ============================================================================
class DatabaseManager {
  constructor() {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(SQLITE_PATH);
    this.initSchema();
    this.ensurePrimaryAdmin();
    this.seedIfEmpty();
  }

  initSchema() {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    this.db.exec(schemaSql);
  }

  ensurePrimaryAdmin() {
    const insertAdmin = this.db.prepare(`
      INSERT OR IGNORE INTO admins (email, name, role, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const a of INITIAL_ADMINS) {
      insertAdmin.run(a.email.toLowerCase(), a.name, a.role, a.created_at);
    }
  }

  seedIfEmpty() {
    const countRow = this.db.prepare('SELECT COUNT(*) AS cnt FROM students').get();
    if (!countRow || countRow.cnt === 0) {
      this.seedDatabase();
    }
  }

  seedDatabase() {
    const insertStudent = this.db.prepare(`
      INSERT OR REPLACE INTO students (
        student_id, name, email, grade, status, pretest_completed, posttest_completed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of INITIAL_STUDENTS) {
      insertStudent.run(
        s.student_id,
        s.name,
        s.email.toLowerCase(),
        s.grade,
        s.status,
        s.pretest_completed ? 1 : 0,
        s.posttest_completed ? 1 : 0,
        s.created_at,
        s.created_at
      );
    }

    const insertAssessment = this.db.prepare(`
      INSERT OR REPLACE INTO assessments (
        test_id, student_id, student_name, email, grade, test_type,
        score_total, max_score, score_percent,
        d1_score, d2_score, d3_score, d4_score, d5_score, d6_score,
        domain_scores_json, time_spent_seconds, violations_count, passed, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of INITIAL_ASSESSMENTS) {
      insertAssessment.run(
        a.test_id,
        a.student_id,
        a.student_name,
        a.email.toLowerCase(),
        a.grade,
        a.test_type,
        a.score_total,
        a.max_score,
        a.score_percent,
        a.domain_scores.D1 || 0,
        a.domain_scores.D2 || 0,
        a.domain_scores.D3 || 0,
        a.domain_scores.D4 || 0,
        a.domain_scores.D5 || 0,
        a.domain_scores.D6 || 0,
        JSON.stringify(a.domain_scores),
        a.time_spent_seconds,
        a.violations_count,
        a.passed ? 1 : 0,
        a.submitted_at
      );
    }
  }

  getStatus() {
    const studentCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM students').get().cnt;
    const assessmentCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM assessments').get().cnt;
    const adminCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM admins').get().cnt;
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
        students: studentCount,
        assessments: assessmentCount,
        admins: adminCount
      },
      timestamp: new Date().toISOString()
    };
  }

  getAdmins() {
    this.ensurePrimaryAdmin();
    return this.db.prepare('SELECT * FROM admins ORDER BY id ASC').all();
  }

  saveAdmin(data) {
    const email = (data.email || '').trim().toLowerCase();
    const name = (data.name || email.split('@')[0] || 'ผู้ดูแลระบบ').trim();
    const role = email === 'winai@psuwit.ac.th' ? 'super_admin' : (data.role || 'admin');
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT OR REPLACE INTO admins (email, name, role, created_at)
      VALUES (?, ?, ?, ?)
    `).run(email, name, role, data.created_at || now);

    return this.db.prepare('SELECT * FROM admins WHERE LOWER(email) = ?').get(email);
  }

  deleteAdmin(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === 'winai@psuwit.ac.th') {
      throw new Error('ไม่สามารถลบผู้ดูแลระบบหลัก (winai@psuwit.ac.th) ได้');
    }
    this.db.prepare('DELETE FROM admins WHERE LOWER(email) = ?').run(cleanEmail);
    return true;
  }

  getStudents() {
    const rows = this.db.prepare('SELECT * FROM students ORDER BY id ASC').all();
    return rows.map(r => ({
      id: r.id,
      student_id: r.student_id,
      name: r.name,
      email: r.email,
      grade: r.grade,
      status: r.status,
      pretest_completed: Boolean(r.pretest_completed),
      posttest_completed: Boolean(r.posttest_completed),
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  saveStudent(data) {
    const email = (data.email || '').trim().toLowerCase();
    const existing = this.db.prepare('SELECT * FROM students WHERE LOWER(email) = ?').get(email);
    const now = new Date().toISOString();

    if (existing) {
      this.db.prepare(`
        UPDATE students
        SET student_id = ?, name = ?, grade = ?, status = ?, updated_at = ?
        WHERE LOWER(email) = ?
      `).run(
        data.student_id || existing.student_id,
        data.name || existing.name,
        data.grade || existing.grade,
        data.status || existing.status,
        now,
        email
      );
    } else {
      this.db.prepare(`
        INSERT INTO students (student_id, name, email, grade, status, pretest_completed, posttest_completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.student_id || `ID-${Date.now().toString().slice(-4)}`,
        data.name || '',
        email,
        data.grade || 'ม.1',
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
    this.db.prepare('DELETE FROM students WHERE LOWER(email) = ?').run(cleanEmail);
    return true;
  }

  resetAttempts(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE students
      SET pretest_completed = 0, posttest_completed = 0, updated_at = ?
      WHERE LOWER(email) = ?
    `).run(now, cleanEmail);
    return true;
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

    // อัปเดตสถานะในตาราง students
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
      max_score: Number(data.max_score || 30),
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
    this.db.exec('DELETE FROM assessments; DELETE FROM students;');
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
      if (body.length > 5 * 1024 * 1024) {
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
          assessments: dbManager.getAssessments('all')
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
