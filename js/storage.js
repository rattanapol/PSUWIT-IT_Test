/**
 * ระบบจัดการฐานข้อมูล (Multi-Tier Database Engine)
 * 1. Primary (เมื่อรัน node server.js): SQLite 3 Relational Database ผ่าน Backend REST API (/api/*)
 * 2. Static / GitHub Pages Mode (เมื่อเปิดบน github.io หรือไม่มี Backend):
 *    ใช้ฐานข้อมูลในเบราว์เซอร์ (LocalStorage + IndexedDB) พร้อมข้อมูลเริ่มต้น 1,468 คนจาก user.xlsx (js/users_data.js)
 * 3. Optional Cloud Sync: รองรับการส่งข้อมูลต่อไปยัง External Webhook / Google Apps Script
 */

const INITIAL_SEED_STUDENTS = (typeof window !== "undefined" && Array.isArray(window.INITIAL_USERS_STUDENTS))
  ? window.INITIAL_USERS_STUDENTS
  : [];

const INITIAL_SEED_ASSESSMENTS = [];

const INITIAL_SEED_ADMINS = (typeof window !== "undefined" && Array.isArray(window.INITIAL_USERS_ADMINS))
  ? window.INITIAL_USERS_ADMINS
  : [
      {
        student_id: "50015",
        title: "นาย",
        first_name: "วินัย",
        last_name: "รัตนพล",
        name: "นายวินัย รัตนพล",
        email: "winai@psuwit.ac.th",
        username: "winai@psuwit.ac.th",
        password: "123456",
        role: "super_admin",
        created_at: "2026-05-01T08:00:00Z"
      },
      {
        student_id: "53001",
        title: "นางสาว",
        first_name: "กนก",
        last_name: "กล่่อมขจิต",
        name: "นางสาวกนก กล่่อมขจิต",
        email: "knok@psuwit.ac.th",
        username: "knok@psuwit.ac.th",
        password: "123456",
        role: "admin",
        created_at: "2026-05-01T08:00:00Z"
      },
      {
        student_id: "1",
        title: "นาย",
        first_name: "ดูแลระบบ",
        last_name: "เทพสุดสุด",
        name: "นายดูแลระบบ เทพสุดสุด",
        email: "00001@psuwit.ac.th",
        username: "00001@psuwit.ac.th",
        password: "123456",
        role: "super_admin",
        created_at: "2026-05-01T08:00:00Z"
      }
    ];

// ตรวจสอบว่ารันอยู่บน Static Hosting เช่น GitHub Pages หรือเปิดไฟล์ตรงหรือไม่
function isStaticHostEnvironment() {
  if (typeof window === "undefined" || !window.location) return false;
  const host = (window.location.hostname || "").toLowerCase();
  const proto = window.location.protocol || "";
  return proto === "file:" || host.endsWith("github.io") || host.endsWith("pages.dev") || host.endsWith("netlify.app");
}

// ============================================================================
// IndexedDB Browser Relational Store (Non-blocking with safety timeout)
// ============================================================================
const IDBEngine = {
  dbName: "PSUWIT_IT_Database_v3",
  dbVersion: 1,
  _dbPromise: null,

  open() {
    if (this._dbPromise) return this._dbPromise;
    if (typeof indexedDB === "undefined") return Promise.resolve(null);

    this._dbPromise = new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };

      // ป้องกัน IndexedDB ค้างกรณีเบราว์เซอร์บล็อกหรือเปิดหลายแท็บ
      const timer = setTimeout(() => done(null), 800);

      try {
        const req = indexedDB.open(this.dbName, this.dbVersion);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("students")) {
            const studentStore = db.createObjectStore("students", { keyPath: "email" });
            studentStore.createIndex("grade", "grade", { unique: false });
            studentStore.createIndex("student_id", "student_id", { unique: false });
          }
          if (!db.objectStoreNames.contains("assessments")) {
            const assessStore = db.createObjectStore("assessments", { keyPath: "test_id" });
            assessStore.createIndex("email", "email", { unique: false });
            assessStore.createIndex("grade", "grade", { unique: false });
            assessStore.createIndex("test_type", "test_type", { unique: false });
            assessStore.createIndex("submitted_at", "submitted_at", { unique: false });
          }
          if (!db.objectStoreNames.contains("admins")) {
            db.createObjectStore("admins", { keyPath: "email" });
          }
        };

        req.onsuccess = (e) => {
          clearTimeout(timer);
          done(e.target.result);
        };
        req.onerror = () => {
          clearTimeout(timer);
          done(null);
        };
        req.onblocked = () => {
          clearTimeout(timer);
          done(null);
        };
      } catch (err) {
        clearTimeout(timer);
        done(null);
      }
    });

    return this._dbPromise;
  },

  async getAll(storeName) {
    const db = await this.open();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  },

  async put(storeName, record) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  async putBulk(storeName, records) {
    const db = await this.open();
    if (!db || !Array.isArray(records)) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        records.forEach((r) => store.put(r));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  async delete(storeName, key) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  async clear(storeName) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
};

// ============================================================================
// Main DB Adapter
// ============================================================================
const DB = {
  // หากเปิดบน GitHub Pages ให้ตั้งค่า serverAvailable = false ทันทีเพื่อไม่ต้องยิง /api/* ให้ติด 404
  serverAvailable: isStaticHostEnvironment() ? false : null,
  _supabaseClient: null,
  _supabaseClientKeyCache: "",

  canUseServer() {
    if (isStaticHostEnvironment()) return false;
    return this.serverAvailable !== false;
  },

  // ==========================================================================
  // Supabase Cloud PostgreSQL Configuration & Client
  // ==========================================================================
  getSupabaseConfig() {
    const url = (
      localStorage.getItem(APP_CONFIG.storageKeys.supabaseUrl) ||
      APP_CONFIG.supabaseUrl ||
      ""
    ).trim();
    const anonKey = (
      localStorage.getItem(APP_CONFIG.storageKeys.supabaseAnonKey) ||
      APP_CONFIG.supabaseAnonKey ||
      ""
    ).trim();
    return { url, anonKey };
  },

  setSupabaseConfig(url, anonKey) {
    const cleanUrl = (url || "").trim().replace(/\/+$/, "");
    const cleanKey = (anonKey || "").trim();
    if (cleanUrl) {
      localStorage.setItem(APP_CONFIG.storageKeys.supabaseUrl, cleanUrl);
    } else {
      localStorage.removeItem(APP_CONFIG.storageKeys.supabaseUrl);
    }
    if (cleanKey) {
      localStorage.setItem(APP_CONFIG.storageKeys.supabaseAnonKey, cleanKey);
    } else {
      localStorage.removeItem(APP_CONFIG.storageKeys.supabaseAnonKey);
    }
    this._supabaseClient = null;
    this._supabaseClientKeyCache = "";
  },

  hasSupabase() {
    const { url, anonKey } = this.getSupabaseConfig();
    return Boolean(
      url &&
        anonKey &&
        typeof window !== "undefined" &&
        window.supabase &&
        typeof window.supabase.createClient === "function"
    );
  },

  getSupabaseClient(customUrl = null, customKey = null) {
    if (typeof window === "undefined" || !window.supabase || typeof window.supabase.createClient !== "function") {
      return null;
    }
    const cfg = this.getSupabaseConfig();
    const targetUrl = (customUrl !== null ? customUrl : cfg.url || "").trim().replace(/\/+$/, "");
    const targetKey = (customKey !== null ? customKey : cfg.anonKey || "").trim();
    if (!targetUrl || !targetKey) return null;

    const cacheKey = `${targetUrl}::${targetKey}`;
    if (this._supabaseClient && this._supabaseClientKeyCache === cacheKey) {
      return this._supabaseClient;
    }

    try {
      const client = window.supabase.createClient(targetUrl, targetKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      if (customUrl === null && customKey === null) {
        this._supabaseClient = client;
        this._supabaseClientKeyCache = cacheKey;
      }
      return client;
    } catch (e) {
      return null;
    }
  },

  // ทดสอบการเชื่อมต่อกับ Supabase PostgreSQL
  async testSupabaseConnection(customUrl = null, customKey = null) {
    const client = this.getSupabaseClient(customUrl, customKey);
    if (!client) {
      return {
        success: false,
        message: "กรุณาระบุ Supabase Project URL และ Supabase Anon / Publishable Key ให้ครบถ้วน"
      };
    }

    try {
      const { count: studentsCount, error: stuErr } = await client
        .from("students")
        .select("email", { count: "exact", head: true });

      if (stuErr) {
        const msg = stuErr.message || String(stuErr);
        const code = stuErr.code || "";
        if (code === "42P01" || code === "PGRST205" || msg.includes("does not exist") || msg.includes("schema cache")) {
          return {
            success: false,
            needsSchema: true,
            message:
              "⚠️ เชื่อมต่อโปรเจกต์ Supabase สำเร็จ แต่ยังไม่มีตารางข้อมูล! กรุณากดปุ่ม '📥 ดาวน์โหลดไฟล์ SQL สร้างตาราง (supabase_schema.sql)' แล้วนำไป Run ใน SQL Editor บน Supabase Dashboard"
          };
        }
        return {
          success: false,
          message: `ไม่สามารถอ่านตารางบน Supabase ได้: ${msg} (${code || "Error"})`
        };
      }

      const { count: assessCount } = await client
        .from("assessments")
        .select("test_id", { count: "exact", head: true });

      return {
        success: true,
        studentsCount: studentsCount || 0,
        assessmentsCount: assessCount || 0,
        message: `เชื่อมต่อ Supabase PostgreSQL สำเร็จ! (พบนักเรียน ${(studentsCount || 0).toLocaleString()} คน, ผลสอบ ${(assessCount || 0).toLocaleString()} รายการ)`
      };
    } catch (err) {
      return {
        success: false,
        message: "ไม่สามารถเชื่อมต่อ Supabase URL ที่ระบุได้ กรุณาตรวจสอบ URL และ API Key อีกครั้ง"
      };
    }
  },

  // อัปโหลดรายชื่อผู้ใช้งานเริ่มต้น 1,468 คน (จาก user.xlsx) ขึ้นสู่ตารางบน Supabase
  async syncSeedToSupabase(onProgress = null) {
    const client = this.getSupabaseClient();
    if (!client) {
      return {
        success: false,
        message: "กรุณาบันทึกค่า Supabase Project URL และ Anon Key ก่อนอัปโหลดข้อมูล"
      };
    }

    const students = this.getLocalStudentsSync();
    const admins = this.getLocalAdminsSync();
    let localAssessments = [];
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
      localAssessments = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    try {
      // 1. Upsert ผู้ดูแลระบบ (admins)
      if (onProgress) onProgress("⏳ กำลังอัปโหลดข้อมูลผู้ดูแลระบบ (admins)...");
      const adminRows = admins.map((a) => ({
        student_id: String(a.student_id || ""),
        title: a.title || "",
        first_name: a.first_name || "",
        last_name: a.last_name || "",
        name: a.name || "ผู้ดูแลระบบ",
        email: (a.email || a.username || "").trim().toLowerCase(),
        username: (a.username || a.email || "").trim().toLowerCase(),
        password: String(a.password || "123456"),
        role: a.role || "admin"
      }));

      if (adminRows.length > 0) {
        const { error: admErr } = await client.from("admins").upsert(adminRows, { onConflict: "email" });
        if (admErr) {
          return {
            success: false,
            message: `อัปโหลดตาราง admins ไม่สำเร็จ: ${admErr.message} (กรุณาตรวจสอบว่าได้รันไฟล์ supabase_schema.sql บน Supabase SQL Editor แล้ว)`
          };
        }
      }

      // 2. Upsert นักเรียน 1,465 คน แบ่งเป็น Batch ละ 250 คน
      const batchSize = 250;
      let uploadedStudents = 0;
      for (let i = 0; i < students.length; i += batchSize) {
        const chunk = students.slice(i, i + batchSize).map((s) => ({
          student_id: String(s.student_id || ""),
          class_no: String(s.class_no || ""),
          title: s.title || "",
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          name: s.name || "",
          email: (s.email || s.username || "").trim().toLowerCase(),
          username: (s.username || s.email || "").trim().toLowerCase(),
          password: String(s.password || "123456"),
          grade: s.grade || "ม.1",
          room: String(s.room || ""),
          role: "student",
          status: s.status || "active",
          pretest_completed: Boolean(s.pretest_completed),
          posttest_completed: Boolean(s.posttest_completed)
        }));

        if (onProgress) {
          onProgress(`⏳ กำลังอัปโหลดข้อมูลนักเรียน (${Math.min(i + chunk.length, students.length)} / ${students.length} คน)...`);
        }

        const { error: stuErr } = await client.from("students").upsert(chunk, { onConflict: "email" });
        if (stuErr) {
          return {
            success: false,
            message: `อัปโหลดตาราง students ไม่สำเร็จ: ${stuErr.message}`
          };
        }
        uploadedStudents += chunk.length;
      }

      // 3. Upsert ประวัติผลสอบในเครื่อง (ถ้ามี)
      if (localAssessments.length > 0) {
        const assessRows = localAssessments.map((a) => this._mapAssessmentToSupabaseRow(a));
        await client.from("assessments").upsert(assessRows, { onConflict: "test_id" });
      }

      return {
        success: true,
        message: `🎉 อัปโหลดข้อมูลขึ้น Supabase สำเร็จ! (นักเรียน ${uploadedStudents.toLocaleString()} คน, ผู้ดูแลระบบ ${adminRows.length} คน)`
      };
    } catch (err) {
      return {
        success: false,
        message: `เกิดข้อผิดพลาดระหว่างอัปโหลดข้อมูลขึ้น Supabase: ${err.message}`
      };
    }
  },

  // ดาวน์โหลดไฟล์ SQL สำหรับนำไปรันใน Supabase SQL Editor
  downloadSupabaseSchemaSQL() {
    const sql = `-- ============================================================================
-- PSU WIT IT Competency Assessment System
-- Supabase PostgreSQL Schema, Indexes, Grants & Row-Level Security (RLS)
-- วิธีใช้งาน: คัดลอกโค้ดทั้งหมดนี้ไปวางในเมนู "SQL Editor" บน Supabase Dashboard แล้วกด Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_no TEXT DEFAULT '',
  title TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT '123456',
  grade TEXT NOT NULL CHECK (grade IN ('ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6')),
  room TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  pretest_completed BOOLEAN NOT NULL DEFAULT FALSE,
  posttest_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_grade_student_id ON public.students (grade, student_id);
CREATE INDEX IF NOT EXISTS idx_students_grade_room ON public.students (grade, room);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students (student_id);
CREATE INDEX IF NOT EXISTS idx_students_active_email ON public.students (email) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.assessments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  test_id TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6')),
  test_type TEXT NOT NULL CHECK (test_type IN ('Pre-test', 'Post-test')),
  score_total INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 75,
  score_percent INTEGER NOT NULL DEFAULT 0,
  d1_score INTEGER NOT NULL DEFAULT 0,
  d2_score INTEGER NOT NULL DEFAULT 0,
  d3_score INTEGER NOT NULL DEFAULT 0,
  d4_score INTEGER NOT NULL DEFAULT 0,
  d5_score INTEGER NOT NULL DEFAULT 0,
  d6_score INTEGER NOT NULL DEFAULT 0,
  domain_scores_json JSONB DEFAULT '{}'::jsonb,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  violations_count INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_email_grade_submitted ON public.assessments (email, grade, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_grade_submitted_at ON public.assessments (grade, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_submitted_at ON public.assessments (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_passed_posttest ON public.assessments (grade) WHERE test_type = 'Post-test' AND passed = TRUE;

CREATE TABLE IF NOT EXISTS public.admins (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT DEFAULT '',
  title TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT '123456',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psuwit_students_access" ON public.students;
CREATE POLICY "psuwit_students_access" ON public.students
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "psuwit_assessments_access" ON public.assessments;
CREATE POLICY "psuwit_assessments_access" ON public.assessments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "psuwit_admins_access" ON public.admins;
CREATE POLICY "psuwit_admins_access" ON public.admins
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "psuwit_settings_access" ON public.system_settings;
CREATE POLICY "psuwit_settings_access" ON public.system_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.admins (student_id, title, first_name, last_name, name, email, username, password, role)
VALUES
  ('50015', 'นาย', 'วินัย', 'รัตนพล', 'นายวินัย รัตนพล', 'winai@psuwit.ac.th', 'winai@psuwit.ac.th', '123456', 'super_admin'),
  ('53001', 'นางสาว', 'กนก', 'กล่อมขจิต', 'นางสาวกนก กล่อมขจิต', 'knok@psuwit.ac.th', 'knok@psuwit.ac.th', '123456', 'admin'),
  ('1', 'นาย', 'ดูแลระบบ', 'เทพสุดสุด', 'นายดูแลระบบ เทพสุดสุด', '00001@psuwit.ac.th', '00001@psuwit.ac.th', '123456', 'super_admin')
ON CONFLICT (email) DO NOTHING;
`;

    const blob = new Blob([sql], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supabase_schema.sql";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  _mapAssessmentToSupabaseRow(record) {
    const d = record.domain_scores || {};
    return {
      test_id: record.test_id,
      student_id: String(record.student_id || ""),
      student_name: record.student_name || "นักเรียน",
      email: (record.email || "").trim().toLowerCase(),
      grade: record.grade || "ม.1",
      test_type: record.test_type || "Pre-test",
      score_total: Number(record.score_total || 0),
      max_score: Number(record.max_score || 75),
      score_percent: Number(record.score_percent || 0),
      d1_score: Number(d.D1 || 0),
      d2_score: Number(d.D2 || 0),
      d3_score: Number(d.D3 || 0),
      d4_score: Number(d.D4 || 0),
      d5_score: Number(d.D5 || 0),
      d6_score: Number(d.D6 || 0),
      domain_scores_json: d,
      time_spent_seconds: Number(record.time_spent_seconds || 0),
      violations_count: Number(record.violations_count || 0),
      passed: Boolean(record.passed),
      submitted_at: record.submitted_at || new Date().toISOString()
    };
  },

  _mapSupabaseRowToAssessment(r) {
    let domainScores = {
      D1: Number(r.d1_score || 0),
      D2: Number(r.d2_score || 0),
      D3: Number(r.d3_score || 0),
      D4: Number(r.d4_score || 0),
      D5: Number(r.d5_score || 0),
      D6: Number(r.d6_score || 0)
    };
    if (r.domain_scores_json) {
      if (typeof r.domain_scores_json === "object") {
        domainScores = { ...domainScores, ...r.domain_scores_json };
      } else if (typeof r.domain_scores_json === "string") {
        try {
          domainScores = { ...domainScores, ...JSON.parse(r.domain_scores_json) };
        } catch (e) {}
      }
    }
    return {
      test_id: r.test_id,
      student_id: r.student_id,
      student_name: r.student_name,
      email: r.email,
      grade: r.grade,
      test_type: r.test_type,
      score_total: Number(r.score_total || 0),
      max_score: Number(r.max_score || 75),
      score_percent: Number(r.score_percent || 0),
      domain_scores: domainScores,
      time_spent_seconds: Number(r.time_spent_seconds || 0),
      violations_count: Number(r.violations_count || 0),
      passed: Boolean(r.passed),
      submitted_at: r.submitted_at
    };
  },

  getGasUrl() {
    return localStorage.getItem(APP_CONFIG.storageKeys.gasUrl) || "";
  },

  setGasUrl(url) {
    if (url) {
      localStorage.setItem(APP_CONFIG.storageKeys.gasUrl, url.trim());
    } else {
      localStorage.removeItem(APP_CONFIG.storageKeys.gasUrl);
    }
  },

  getGoogleClientId() {
    return localStorage.getItem(APP_CONFIG.storageKeys.googleClientId) || APP_CONFIG.googleClientId || "";
  },

  async setGoogleClientId(clientId) {
    const clean = (clientId || "").trim();
    if (clean) {
      localStorage.setItem(APP_CONFIG.storageKeys.googleClientId, clean);
    } else {
      localStorage.removeItem(APP_CONFIG.storageKeys.googleClientId);
    }
    if (!this.canUseServer()) return;
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_client_id: clean })
      });
    } catch (e) {
      this.serverAvailable = false;
    }
  },

  async loadServerSettings() {
    if (!this.canUseServer()) return;
    try {
      const res = await fetch("/api/settings");
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const json = await res.json();
        if (json.status === "success" && json.data) {
          this.serverAvailable = true;
          if (json.data.google_client_id !== undefined && json.data.google_client_id !== "") {
            localStorage.setItem(APP_CONFIG.storageKeys.googleClientId, json.data.google_client_id);
          }
        }
      } else {
        this.serverAvailable = false;
      }
    } catch (e) {
      this.serverAvailable = false;
    }
  },

  // Normalize username: รองรับทั้ง 6166@psuwit.ac.th และ 6166 หรือ winai
  normalizeUsernameCandidates(rawInput) {
    const clean = String(rawInput || "").trim().toLowerCase();
    if (!clean) return [];
    const candidates = [clean];
    if (!clean.includes("@")) {
      candidates.push(`${clean}@psuwit.ac.th`);
    }
    return candidates;
  },

  // ดึงข้อมูลนักเรียนจาก LocalStorage / Seed ทันทีโดยไม่บล็อก
  getLocalStudentsSync() {
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.students);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 100) {
          return parsed;
        }
      }
    } catch (e) {}
    if (INITIAL_SEED_STUDENTS.length > 0) {
      try {
        localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(INITIAL_SEED_STUDENTS));
      } catch (e) {}
      return [...INITIAL_SEED_STUDENTS];
    }
    return [];
  },

  // ดึงข้อมูลแอดมินจาก LocalStorage / Seed ทันทีโดยไม่บล็อก
  getLocalAdminsSync() {
    let list = [];
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.admins);
      if (raw) {
        list = JSON.parse(raw);
      }
    } catch (e) {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    let changed = false;
    for (const seedAdmin of INITIAL_SEED_ADMINS) {
      const idx = list.findIndex((a) => (a.email || "").toLowerCase() === seedAdmin.email.toLowerCase());
      if (idx < 0) {
        list.push({ ...seedAdmin });
        changed = true;
      } else if (!list[idx].password) {
        list[idx].password = seedAdmin.password || "123456";
        changed = true;
      }
    }
    if (changed) {
      try {
        localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(list));
      } catch (e) {}
    }
    return list;
  },

  // ตรวจสอบการเข้าสู่ระบบด้วย Username และ Password (รองรับ Supabase Cloud -> SQLite Server -> Browser DB)
  async authenticateUser(rawUsername, rawPassword, loginRole = "any") {
    const candidates = this.normalizeUsernameCandidates(rawUsername);
    const pwd = String(rawPassword ?? "");

    if (candidates.length === 0 || !pwd) {
      return { success: false, message: "กรุณากรอก Username และ Password ให้ครบถ้วน" };
    }

    // 1. ตรวจสอบผ่าน Supabase Cloud PostgreSQL (หากตั้งค่าเชื่อมต่อไว้)
    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          const emailList = candidates.filter((c) => c.includes("@"));
          const rawId = String(rawUsername || "").trim();

          const [admByEmail, stuByEmail, stuById] = await Promise.all([
            emailList.length > 0 ? sb.from("admins").select("*").in("email", emailList).limit(1) : Promise.resolve({ data: [] }),
            emailList.length > 0 ? sb.from("students").select("*").in("email", emailList).limit(1) : Promise.resolve({ data: [] }),
            !rawId.includes("@") ? sb.from("students").select("*").eq("student_id", rawId).limit(1) : Promise.resolve({ data: [] })
          ]);

          const sbAdmin = (admByEmail.data && admByEmail.data[0]) || null;
          const sbStudent = (stuByEmail.data && stuByEmail.data[0]) || (stuById.data && stuById.data[0]) || null;

          if (sbAdmin || sbStudent) {
            if (loginRole === "admin") {
              if (!sbAdmin) {
                return {
                  success: false,
                  message: "🚫 บัญชีนี้เป็นบัญชีนักเรียน ไม่มีสิทธิ์เข้าใช้งานส่วนผู้ดูแลระบบ (Admin)"
                };
              }
              if (String(sbAdmin.password || "123456") !== pwd) {
                return { success: false, message: "❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
              }
              return {
                success: true,
                user: {
                  student_id: sbAdmin.student_id || "",
                  title: sbAdmin.title || "",
                  first_name: sbAdmin.first_name || "",
                  last_name: sbAdmin.last_name || "",
                  name: sbAdmin.name,
                  email: sbAdmin.email,
                  username: sbAdmin.username || sbAdmin.email,
                  grade: "-",
                  room: "-",
                  role: "admin",
                  adminRole: sbAdmin.role || "admin",
                  status: "active"
                }
              };
            }

            if (sbStudent) {
              if (sbStudent.status === "suspended") {
                return {
                  success: false,
                  message: "🚫 บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ"
                };
              }
              if (String(sbStudent.password || "123456") !== pwd) {
                return { success: false, message: "❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
              }
              return {
                success: true,
                user: {
                  student_id: sbStudent.student_id,
                  class_no: sbStudent.class_no || "",
                  title: sbStudent.title || "",
                  first_name: sbStudent.first_name || "",
                  last_name: sbStudent.last_name || "",
                  name: sbStudent.name,
                  email: sbStudent.email,
                  username: sbStudent.username || sbStudent.email,
                  grade: sbStudent.grade,
                  room: sbStudent.room || "",
                  role: "student",
                  status: sbStudent.status || "active",
                  pretest_completed: Boolean(sbStudent.pretest_completed),
                  posttest_completed: Boolean(sbStudent.posttest_completed)
                }
              };
            }

            if (sbAdmin) {
              if (String(sbAdmin.password || "123456") !== pwd) {
                return { success: false, message: "❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
              }
              return {
                success: true,
                user: {
                  student_id: sbAdmin.student_id || "",
                  title: sbAdmin.title || "",
                  first_name: sbAdmin.first_name || "",
                  last_name: sbAdmin.last_name || "",
                  name: sbAdmin.name,
                  email: sbAdmin.email,
                  username: sbAdmin.username || sbAdmin.email,
                  grade: "-",
                  room: "-",
                  role: "admin",
                  adminRole: sbAdmin.role || "admin",
                  status: "active"
                }
              };
            }
          }
        } catch (e) {
          // หาก Supabase ยังไม่ได้สร้างตารางหรือออฟไลน์ ให้ fallback ลงมาเช็คในเครื่องต่อได้โดยไม่พัง
        }
      }
    }

    // 2. ลองตรวจสอบผ่าน Backend SQLite API (เฉพาะเมื่อไม่ได้รันบน Static Host เช่น GitHub Pages)
    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: rawUsername, password: pwd, loginRole })
        });
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          if (res.ok && json.status === "success" && json.data) {
            this.serverAvailable = true;
            return { success: true, user: json.data };
          } else if (json && json.message) {
            return { success: false, message: json.message };
          }
        } else {
          this.serverAvailable = false;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    // 3. ตรวจสอบจากฐานข้อมูลในเบราว์เซอร์ (LocalStorage / Seed user.xlsx) ทันทีโดยไม่ค้าง
    const admins = this.getLocalAdminsSync();
    const students = this.getLocalStudentsSync();

    const adminMatch = admins.find((a) => {
      const u = (a.username || a.email || "").toLowerCase();
      const sid = String(a.student_id || "").toLowerCase();
      return candidates.includes(u) || (sid && candidates.includes(sid));
    });

    const studentMatch = students.find((s) => {
      const u = (s.username || s.email || "").toLowerCase();
      const sid = String(s.student_id || "").toLowerCase();
      return candidates.includes(u) || (sid && candidates.includes(sid));
    });

    if (loginRole === "admin") {
      if (!adminMatch) {
        if (studentMatch) {
          return {
            success: false,
            message: "🚫 บัญชีนี้เป็นบัญชีนักเรียน ไม่มีสิทธิ์เข้าใช้งานส่วนผู้ดูแลระบบ (Admin)"
          };
        }
        return { success: false, message: "❌ ไม่พบบัญชีผู้ดูแลระบบนี้ในฐานข้อมูล" };
      }
      if (String(adminMatch.password || "123456") !== pwd) {
        return { success: false, message: "❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
      }
      return {
        success: true,
        user: {
          student_id: adminMatch.student_id || "",
          title: adminMatch.title || "",
          first_name: adminMatch.first_name || "",
          last_name: adminMatch.last_name || "",
          name: adminMatch.name,
          email: adminMatch.email,
          username: adminMatch.username || adminMatch.email,
          grade: "-",
          room: "-",
          role: "admin",
          adminRole: adminMatch.role || "admin",
          status: "active"
        }
      };
    }

    if (studentMatch) {
      if (studentMatch.status === "suspended") {
        return {
          success: false,
          message: "🚫 บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ"
        };
      }
      if (String(studentMatch.password || "123456") !== pwd) {
        return { success: false, message: "❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
      }
      return {
        success: true,
        user: {
          student_id: studentMatch.student_id,
          class_no: studentMatch.class_no || "",
          title: studentMatch.title || "",
          first_name: studentMatch.first_name || "",
          last_name: studentMatch.last_name || "",
          name: studentMatch.name,
          email: studentMatch.email,
          username: studentMatch.username || studentMatch.email,
          grade: studentMatch.grade,
          room: studentMatch.room || "",
          role: "student",
          status: studentMatch.status || "active",
          pretest_completed: Boolean(studentMatch.pretest_completed),
          posttest_completed: Boolean(studentMatch.posttest_completed)
        }
      };
    }

    if (adminMatch) {
      if (String(adminMatch.password || "123456") !== pwd) {
        return { success: false, message: "❌ รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
      }
      return {
        success: true,
        user: {
          student_id: adminMatch.student_id || "",
          title: adminMatch.title || "",
          first_name: adminMatch.first_name || "",
          last_name: adminMatch.last_name || "",
          name: adminMatch.name,
          email: adminMatch.email,
          username: adminMatch.username || adminMatch.email,
          grade: "-",
          room: "-",
          role: "admin",
          adminRole: adminMatch.role || "admin",
          status: "active"
        }
      };
    }

    return {
      success: false,
      message: "❌ ไม่พบชื่อผู้ใช้งาน (Username) นี้ในระบบ กรุณาตรวจสอบอีกครั้ง"
    };
  },

  // เปลี่ยนรหัสผ่านด้วยตนเอง (หรือรีเซ็ตโดย Admin)
  async changePassword(rawUsername, currentPassword, newPassword, isAdminReset = false) {
    const candidates = this.normalizeUsernameCandidates(rawUsername);
    const curPwd = String(currentPassword ?? "");
    const nextPwd = String(newPassword ?? "").trim();

    if (candidates.length === 0) {
      return { success: false, message: "กรุณาระบุชื่อผู้ใช้งาน (Username)" };
    }
    if (!nextPwd || nextPwd.length < 4) {
      return { success: false, message: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร" };
    }

    let apiHandled = false;
    let apiSuccess = false;
    let apiMessage = "";

    // 1. อัปเดตรหัสผ่านบน Supabase Cloud PostgreSQL (หากเชื่อมต่อไว้)
    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          const emailList = candidates.filter((c) => c.includes("@"));
          const rawId = String(rawUsername || "").trim();
          const [stuRes, admRes] = await Promise.all([
            emailList.length > 0 ? sb.from("students").select("*").in("email", emailList).limit(1) : Promise.resolve({ data: [] }),
            emailList.length > 0 ? sb.from("admins").select("*").in("email", emailList).limit(1) : Promise.resolve({ data: [] })
          ]);
          let sbStu = (stuRes.data && stuRes.data[0]) || null;
          if (!sbStu && !rawId.includes("@")) {
            const byId = await sb.from("students").select("*").eq("student_id", rawId).limit(1);
            sbStu = (byId.data && byId.data[0]) || null;
          }
          const sbAdm = (admRes.data && admRes.data[0]) || null;

          if (sbStu) {
            if (!isAdminReset && String(sbStu.password || "123456") !== curPwd) {
              return { success: false, message: "❌ รหัสผ่านปัจจุบันไม่ถูกต้อง" };
            }
            const { error: uErr } = await sb
              .from("students")
              .update({ password: nextPwd, updated_at: new Date().toISOString() })
              .eq("email", sbStu.email);
            if (!uErr) {
              apiHandled = true;
              apiSuccess = true;
              apiMessage = "✅ เปลี่ยนรหัสผ่านบนฐานข้อมูลออนไลน์ (Supabase) สำเร็จเรียบร้อยแล้ว!";
            }
          }

          if (sbAdm) {
            if (!apiHandled && !isAdminReset && String(sbAdm.password || "123456") !== curPwd) {
              return { success: false, message: "❌ รหัสผ่านปัจจุบันไม่ถูกต้อง" };
            }
            const { error: aErr } = await sb
              .from("admins")
              .update({ password: nextPwd, updated_at: new Date().toISOString() })
              .eq("email", sbAdm.email);
            if (!aErr) {
              apiHandled = true;
              apiSuccess = true;
              apiMessage = "✅ เปลี่ยนรหัสผ่านบนฐานข้อมูลออนไลน์ (Supabase) สำเร็จเรียบร้อยแล้ว!";
            }
          }
        } catch (e) {}
      }
    }

    // 2. ส่งคำขอเปลี่ยนรหัสผ่านไปยัง SQLite Backend API (ถ้ามี Server)
    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: rawUsername,
            currentPassword: curPwd,
            newPassword: nextPwd,
            isAdminReset: Boolean(isAdminReset)
          })
        });
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          apiHandled = true;
          apiSuccess = res.ok && json.status === "success";
          apiMessage = json.message || "";
          if (!apiSuccess) {
            return { success: false, message: apiMessage || "ไม่สามารถเปลี่ยนรหัสผ่านได้" };
          }
        } else {
          this.serverAvailable = false;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    // 3. อัปเดตใน LocalStorage และ IndexedDB ให้ตรงกันเสมอ
    let updatedLocal = false;
    const students = this.getLocalStudentsSync();
    const sIdx = students.findIndex((s) => {
      const u = (s.username || s.email || "").toLowerCase();
      const sid = String(s.student_id || "").toLowerCase();
      return candidates.includes(u) || (sid && candidates.includes(sid));
    });

    if (sIdx >= 0) {
      if (!apiHandled && !isAdminReset && String(students[sIdx].password || "123456") !== curPwd) {
        return { success: false, message: "❌ รหัสผ่านปัจจุบันไม่ถูกต้อง" };
      }
      students[sIdx].password = nextPwd;
      students[sIdx].updated_at = new Date().toISOString();
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
      IDBEngine.put("students", students[sIdx]);
      updatedLocal = true;
    }

    const admins = this.getLocalAdminsSync();
    const aIdx = admins.findIndex((a) => {
      const u = (a.username || a.email || "").toLowerCase();
      const sid = String(a.student_id || "").toLowerCase();
      return candidates.includes(u) || (sid && candidates.includes(sid));
    });

    if (aIdx >= 0) {
      if (!apiHandled && !updatedLocal && !isAdminReset && String(admins[aIdx].password || "123456") !== curPwd) {
        return { success: false, message: "❌ รหัสผ่านปัจจุบันไม่ถูกต้อง" };
      }
      admins[aIdx].password = nextPwd;
      admins[aIdx].updated_at = new Date().toISOString();
      localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(admins));
      IDBEngine.put("admins", admins[aIdx]);
      updatedLocal = true;
    }

    if (!apiHandled && !updatedLocal) {
      return { success: false, message: "❌ ไม่พบบัญชีผู้ใช้งานนี้ในระบบ" };
    }

    return {
      success: true,
      message: apiMessage || "✅ เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว!"
    };
  },

  // ตรวจสอบสถานะฐานข้อมูลทั้งหมด (Supabase Cloud -> SQLite Backend -> IndexedDB)
  async getDatabaseStatus() {
    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      const cfg = this.getSupabaseConfig();
      if (sb) {
        try {
          const [stuRes, assRes] = await Promise.all([
            sb.from("students").select("email", { count: "exact", head: true }),
            sb.from("assessments").select("test_id", { count: "exact", head: true })
          ]);
          if (!stuRes.error) {
            return {
              connected: true,
              mode: "supabase_cloud",
              engine: "Supabase PostgreSQL (Cloud Database)",
              file: cfg.url,
              fileSize: 0,
              tables: {
                students: stuRes.count || 0,
                assessments: assRes.count || 0
              }
            };
          }
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/status", { method: "GET" });
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const json = await res.json();
          if (json.status === "success") {
            this.serverAvailable = true;
            return {
              connected: true,
              mode: "server_sqlite",
              engine: json.data.engine || "SQLite 3 (Relational Database)",
              file: json.data.database_file || "database/psuwit_it.sqlite",
              fileSize: json.data.file_size_bytes || 0,
              tables: json.data.tables || { students: 0, assessments: 0 }
            };
          }
        } else {
          this.serverAvailable = false;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    const students = this.getLocalStudentsSync();
    const assessments = await this.getAssessments("all");
    return {
      connected: true,
      mode: "browser_indexeddb",
      engine: "Browser Database (LocalStorage + IndexedDB)",
      file: "Static Hosting / GitHub Pages (user.xlsx 1,468 users)",
      fileSize: new Blob([JSON.stringify({ students, assessments })]).size,
      tables: {
        students: students.length,
        assessments: assessments.length
      }
    };
  },

  async testConnection(url) {
    const targetUrl = url || this.getGasUrl();
    if (!targetUrl) return { success: false, message: "ยังไม่ได้ระบุ External Webhook / Web App URL" };

    try {
      const response = await fetch(`${targetUrl}?action=ping`, {
        method: "GET",
        mode: "cors"
      });
      const data = await response.json();
      return { success: true, message: data.message || "เชื่อมต่อ External Database สำเร็จ!" };
    } catch (err) {
      return {
        success: false,
        message: "ไม่สามารถเชื่อมต่อ URL ภายนอกได้ (แต่ฐานข้อมูลหลักของระบบทำงานปกติ)"
      };
    }
  },

  // เตรียมข้อมูลเริ่มต้นจากไฟล์ user.xlsx สำหรับ LocalStorage และ IndexedDB
  initMockData() {
    const students = this.getLocalStudentsSync();
    const admins = this.getLocalAdminsSync();

    let rawAssessments = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
    if (!rawAssessments || rawAssessments.includes("T-1715320000001")) {
      localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify([]));
    }

    // ซิงก์เข้า IndexedDB แบบเบื้องหลังโดยไม่บล็อกการทำงานหน้าเว็บ
    setTimeout(() => {
      IDBEngine.putBulk("students", students);
      IDBEngine.putBulk("admins", admins);
    }, 50);
  },

  // ดึงรายชื่อผู้ดูแลระบบทั้งหมด
  async getAdmins() {
    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          const { data, error } = await sb.from("admins").select("*").order("id", { ascending: true });
          if (!error && Array.isArray(data) && data.length > 0) {
            localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(data));
            IDBEngine.putBulk("admins", data);
            return data;
          }
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/admins");
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const json = await res.json();
          if (json.status === "success" && Array.isArray(json.data)) {
            this.serverAvailable = true;
            localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(json.data));
            IDBEngine.putBulk("admins", json.data);
            return json.data;
          }
        } else {
          this.serverAvailable = false;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    return this.getLocalAdminsSync();
  },

  // ตรวจสอบว่าอีเมล/ชื่อผู้ใช้นี้มีสิทธิ์ผู้ดูแลระบบหรือไม่
  async findAdmin(emailOrUsername) {
    const candidates = this.normalizeUsernameCandidates(emailOrUsername);
    if (candidates.length === 0) return null;
    const admins = await this.getAdmins();
    return (
      admins.find((a) => {
        const u = (a.username || a.email || "").toLowerCase();
        const sid = String(a.student_id || "").toLowerCase();
        return candidates.includes(u) || (sid && candidates.includes(sid));
      }) || null
    );
  },

  // เพิ่มผู้ดูแลระบบใหม่
  async saveAdmin(adminData) {
    const cleanEmail = (adminData.email || adminData.username || "").trim().toLowerCase();
    const record = {
      student_id: adminData.student_id || "",
      title: adminData.title || "",
      first_name: adminData.first_name || "",
      last_name: adminData.last_name || "",
      email: cleanEmail,
      username: cleanEmail,
      password: adminData.password || "123456",
      name: (adminData.name || cleanEmail.split("@")[0] || "ผู้ดูแลระบบ").trim(),
      role: (cleanEmail === "winai@psuwit.ac.th" || cleanEmail === "00001@psuwit.ac.th") ? "super_admin" : (adminData.role || "admin"),
      created_at: adminData.created_at || new Date().toISOString()
    };

    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          await sb.from("admins").upsert(
            [
              {
                student_id: record.student_id,
                title: record.title,
                first_name: record.first_name,
                last_name: record.last_name,
                name: record.name,
                email: record.email,
                username: record.username,
                password: record.password,
                role: record.role
              }
            ],
            { onConflict: "email" }
          );
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        await fetch("/api/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record)
        });
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    const admins = this.getLocalAdminsSync();
    const idx = admins.findIndex((a) => (a.email || "").toLowerCase() === cleanEmail);
    if (idx >= 0) {
      admins[idx] = { ...admins[idx], ...record };
    } else {
      admins.push(record);
    }
    localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(admins));
    IDBEngine.put("admins", record);
    return record;
  },

  // ลบผู้ดูแลระบบ (ไม่อนุญาตให้ลบ winai@psuwit.ac.th)
  async deleteAdmin(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (cleanEmail === "winai@psuwit.ac.th") {
      throw new Error("ไม่สามารถลบผู้ดูแลระบบหลัก (winai@psuwit.ac.th) ได้");
    }

    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          await sb.from("admins").delete().eq("email", cleanEmail);
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        await fetch(`/api/admins?email=${encodeURIComponent(cleanEmail)}`, { method: "DELETE" });
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    IDBEngine.delete("admins", cleanEmail);
    const admins = this.getLocalAdminsSync().filter((a) => (a.email || "").toLowerCase() !== cleanEmail);
    localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(admins));
    return true;
  },

  // ดึงรายชื่อนักเรียนทั้งหมด (รองรับมากกว่า 1,000 แถวบน Supabase PostgREST)
  async getStudents() {
    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          const [page1, page2] = await Promise.all([
            sb.from("students").select("*").order("grade", { ascending: true }).order("student_id", { ascending: true }).range(0, 999),
            sb.from("students").select("*").order("grade", { ascending: true }).order("student_id", { ascending: true }).range(1000, 2999)
          ]);
          if (!page1.error && Array.isArray(page1.data)) {
            const combined = [...page1.data, ...(Array.isArray(page2.data) ? page2.data : [])];
            if (combined.length > 0) {
              localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(combined));
              IDBEngine.putBulk("students", combined);
              return combined;
            }
          }
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/students");
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const json = await res.json();
          if (json.status === "success" && Array.isArray(json.data)) {
            this.serverAvailable = true;
            localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(json.data));
            IDBEngine.putBulk("students", json.data);
            return json.data;
          }
        } else {
          this.serverAvailable = false;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      try {
        const res = await fetch(`${gasUrl}?action=get_students`);
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(json.data));
          IDBEngine.putBulk("students", json.data);
          return json.data;
        }
      } catch (err) {}
    }

    return this.getLocalStudentsSync();
  },

  // บันทึก / แก้ไขข้อมูลนักเรียน (รองรับการเปลี่ยนระดับชั้นโดยยังคงเก็บประวัติการสอบของระดับชั้นเดิมไว้)
  async saveStudent(studentData) {
    const cleanEmail = (studentData.email || studentData.username || "").trim().toLowerCase();
    const students = this.getLocalStudentsSync();

    const existingIndex = students.findIndex((s) => (s.email || "").toLowerCase() === cleanEmail);
    const existing = existingIndex >= 0 ? students[existingIndex] : null;
    const nextGrade = studentData.grade || (existing ? existing.grade : "ม.1");
    const gradeChanged = Boolean(existing && existing.grade && existing.grade !== nextGrade);

    let preCompleted =
      studentData.pretest_completed !== undefined
        ? Boolean(studentData.pretest_completed)
        : existing
        ? Boolean(existing.pretest_completed)
        : false;
    let postCompleted =
      studentData.posttest_completed !== undefined
        ? Boolean(studentData.posttest_completed)
        : existing
        ? Boolean(existing.posttest_completed)
        : false;

    // หากมีการเปลี่ยนระดับชั้น ให้คำนวณสถานะ Pre/Post ของระดับชั้นใหม่จากประวัติการสอบที่มีอยู่ โดยเก็บประวัติระดับชั้นเดิมไว้ครบถ้วน
    if (gradeChanged && studentData.pretest_completed === undefined && studentData.posttest_completed === undefined) {
      let allAssessments = [];
      try {
        const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
        allAssessments = raw ? JSON.parse(raw) : [];
      } catch (e) {}
      preCompleted = allAssessments.some(
        (a) => (a.email || "").toLowerCase() === cleanEmail && a.grade === nextGrade && a.test_type === "Pre-test"
      );
      postCompleted = allAssessments.some(
        (a) => (a.email || "").toLowerCase() === cleanEmail && a.grade === nextGrade && a.test_type === "Post-test"
      );
    }

    const record = {
      student_id: studentData.student_id !== undefined ? studentData.student_id : (existing ? existing.student_id : ""),
      class_no: studentData.class_no !== undefined ? studentData.class_no : (existing ? existing.class_no : ""),
      title: studentData.title !== undefined ? studentData.title : (existing ? existing.title : ""),
      first_name: studentData.first_name !== undefined ? studentData.first_name : (existing ? existing.first_name : ""),
      last_name: studentData.last_name !== undefined ? studentData.last_name : (existing ? existing.last_name : ""),
      name: studentData.name || (existing ? existing.name : ""),
      email: cleanEmail,
      username: cleanEmail,
      password: studentData.password || (existing && existing.password) || "123456",
      grade: nextGrade,
      room: studentData.room !== undefined ? studentData.room : (existing ? existing.room : ""),
      role: "student",
      status: studentData.status || (existing ? existing.status : "active"),
      pretest_completed: preCompleted,
      posttest_completed: postCompleted,
      created_at: (existing && existing.created_at) || studentData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          await sb.from("students").upsert(
            [
              {
                student_id: String(record.student_id || ""),
                class_no: String(record.class_no || ""),
                title: record.title || "",
                first_name: record.first_name || "",
                last_name: record.last_name || "",
                name: record.name || "",
                email: record.email,
                username: record.username,
                password: String(record.password || "123456"),
                grade: record.grade,
                room: String(record.room || ""),
                role: "student",
                status: record.status || "active",
                pretest_completed: Boolean(record.pretest_completed),
                posttest_completed: Boolean(record.posttest_completed),
                updated_at: record.updated_at
              }
            ],
            { onConflict: "email" }
          );
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record)
        });
        if (res.ok) {
          this.serverAvailable = true;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    if (existingIndex >= 0) {
      students[existingIndex] = record;
    } else {
      students.push(record);
    }
    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
    IDBEngine.put("students", record);

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save_student", data: record })
      }).catch(() => {});
    }

    return true;
  },

  // แก้ไขระดับชั้น/ห้องเรียนแบบกลุ่ม (ทั้งระดับชั้น หรือ ทั้งห้อง หรือเลื่อนชั้นปีการศึกษา ม.1->ม.2->ม.3 / ม.4->ม.5->ม.6)
  // โดยเก็บประวัติการทำแบบทดสอบของทุกระดับชั้นเดิมไว้ทั้งหมด
  async bulkUpdateStudentsGrade(payload = {}) {
    const mode = payload.mode || "single_rule";

    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/students/bulk-grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          this.serverAvailable = true;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    const students = this.getLocalStudentsSync();
    let allAssessments = [];
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
      allAssessments = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    let rules = [];
    if (mode === "promote_junior") {
      // เลื่อนจากชั้นสูงกว่าก่อน (ม.2 -> ม.3 แล้วจึง ม.1 -> ม.2) เพื่อไม่ให้ซ้อนทับกัน
      rules = [
        { sourceGrade: "ม.2", sourceRoom: "all", targetGrade: "ม.3", targetRoom: "keep" },
        { sourceGrade: "ม.1", sourceRoom: "all", targetGrade: "ม.2", targetRoom: "keep" }
      ];
    } else if (mode === "promote_senior") {
      // เลื่อนจากชั้นสูงกว่าก่อน (ม.5 -> ม.6 แล้วจึง ม.4 -> ม.5)
      rules = [
        { sourceGrade: "ม.5", sourceRoom: "all", targetGrade: "ม.6", targetRoom: "keep" },
        { sourceGrade: "ม.4", sourceRoom: "all", targetGrade: "ม.5", targetRoom: "keep" }
      ];
    } else {
      rules = [
        {
          sourceGrade: payload.sourceGrade,
          sourceRoom: payload.sourceRoom || "all",
          targetGrade: payload.targetGrade,
          targetRoom: payload.targetRoom || "keep"
        }
      ];
    }

    const updatedStudents = [];
    const nowIso = new Date().toISOString();

    for (const student of students) {
      let matchedRule = null;
      for (const r of rules) {
        if (!r.sourceGrade || !r.targetGrade) continue;
        const gradeMatch = student.grade === r.sourceGrade;
        const roomMatch = !r.sourceRoom || r.sourceRoom === "all" || String(student.room || "") === String(r.sourceRoom);
        if (gradeMatch && roomMatch) {
          matchedRule = r;
          break;
        }
      }

      if (matchedRule) {
        const nextGrade = matchedRule.targetGrade;
        const nextRoom =
          !matchedRule.targetRoom || matchedRule.targetRoom === "keep"
            ? student.room || ""
            : String(matchedRule.targetRoom);
        const cleanEmail = (student.email || student.username || "").toLowerCase();

        const hasPreInTarget = allAssessments.some(
          (a) => (a.email || "").toLowerCase() === cleanEmail && a.grade === nextGrade && a.test_type === "Pre-test"
        );
        const hasPostInTarget = allAssessments.some(
          (a) => (a.email || "").toLowerCase() === cleanEmail && a.grade === nextGrade && a.test_type === "Post-test"
        );

        student.grade = nextGrade;
        student.room = nextRoom;
        student.pretest_completed = hasPreInTarget;
        student.posttest_completed = hasPostInTarget;
        student.updated_at = nowIso;
        updatedStudents.push(student);
      }
    }

    if (updatedStudents.length > 0) {
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
      IDBEngine.putBulk("students", updatedStudents);

      // ซิงก์การเลื่อนระดับชั้นแบบกลุ่มขึ้นสู่ Supabase Cloud PostgreSQL
      if (this.hasSupabase()) {
        const sb = this.getSupabaseClient();
        if (sb) {
          try {
            const batchSize = 250;
            for (let i = 0; i < updatedStudents.length; i += batchSize) {
              const chunk = updatedStudents.slice(i, i + batchSize).map((s) => ({
                student_id: String(s.student_id || ""),
                class_no: String(s.class_no || ""),
                title: s.title || "",
                first_name: s.first_name || "",
                last_name: s.last_name || "",
                name: s.name || "",
                email: (s.email || s.username || "").trim().toLowerCase(),
                username: (s.username || s.email || "").trim().toLowerCase(),
                password: String(s.password || "123456"),
                grade: s.grade,
                room: String(s.room || ""),
                role: "student",
                status: s.status || "active",
                pretest_completed: Boolean(s.pretest_completed),
                posttest_completed: Boolean(s.posttest_completed),
                updated_at: nowIso
              }));
              await sb.from("students").upsert(chunk, { onConflict: "email" });
            }
          } catch (e) {}
        }
      }
    }

    return {
      success: true,
      updatedCount: updatedStudents.length
    };
  },

  // ลบนักเรียน
  async deleteStudent(email) {
    const cleanEmail = (email || "").trim().toLowerCase();

    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          await sb.from("students").delete().eq("email", cleanEmail);
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        await fetch(`/api/students?email=${encodeURIComponent(cleanEmail)}`, { method: "DELETE" });
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    IDBEngine.delete("students", cleanEmail);

    const students = this.getLocalStudentsSync().filter((s) => (s.email || "").toLowerCase() !== cleanEmail);
    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "delete_student", email: cleanEmail })
      }).catch(() => {});
    }
    return true;
  },

  // รีเซ็ตสิทธิ์การทำแบบทดสอบให้นักเรียน
  async resetAttempts(email) {
    const cleanEmail = (email || "").trim().toLowerCase();

    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          await sb
            .from("students")
            .update({ pretest_completed: false, posttest_completed: false, updated_at: new Date().toISOString() })
            .eq("email", cleanEmail);
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        await fetch("/api/students/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail })
        });
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    const students = this.getLocalStudentsSync();
    const target = students.find((s) => (s.email || "").toLowerCase() === cleanEmail);
    if (target) {
      target.pretest_completed = false;
      target.posttest_completed = false;
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
      IDBEngine.put("students", target);
    }

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "reset_attempts", email: cleanEmail })
      }).catch(() => {});
    }
    return true;
  },

  // ดึงผลการสอบทั้งหมด (สามารถกรองตามระดับชั้น)
  async getAssessments(gradeFilter = "all") {
    let assessments = [];

    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          let query = sb.from("assessments").select("*").order("submitted_at", { ascending: false }).range(0, 4999);
          if (gradeFilter && gradeFilter !== "all") {
            query = query.eq("grade", gradeFilter);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            assessments = data.map((r) => this._mapSupabaseRowToAssessment(r));
            if (gradeFilter === "all") {
              localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
              IDBEngine.putBulk("assessments", assessments);
            }
            return assessments;
          }
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        const res = await fetch(`/api/assessments?grade=${encodeURIComponent(gradeFilter)}`);
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const json = await res.json();
          if (json.status === "success" && Array.isArray(json.data)) {
            this.serverAvailable = true;
            assessments = json.data;
            if (gradeFilter === "all") {
              localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
              IDBEngine.putBulk("assessments", assessments);
            }
            return assessments;
          }
        } else {
          this.serverAvailable = false;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      try {
        const res = await fetch(`${gasUrl}?action=get_assessments&grade=${encodeURIComponent(gradeFilter)}`);
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          assessments = json.data;
          if (gradeFilter === "all") {
            localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
            IDBEngine.putBulk("assessments", assessments);
          }
          return assessments;
        }
      } catch (err) {}
    }

    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
      assessments = raw ? JSON.parse(raw) : [];
    } catch (e) {
      assessments = [];
    }

    if (gradeFilter !== "all") {
      assessments = assessments.filter((a) => a.grade === gradeFilter);
    }

    return assessments.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  },

  async getStudentHistory(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return [];

    // ใช้ Composite Index (idx_assessments_email_grade_submitted) ดึงเฉพาะแถวของนักเรียนคนนี้โดยตรง ไม่ต้องดึงทั้งตาราง
    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          const { data, error } = await sb
            .from("assessments")
            .select("*")
            .eq("email", cleanEmail)
            .order("submitted_at", { ascending: false });
          if (!error && Array.isArray(data)) {
            return data.map((r) => this._mapSupabaseRowToAssessment(r));
          }
        } catch (e) {}
      }
    }

    const all = await this.getAssessments("all");
    return all.filter((a) => (a.email || "").toLowerCase() === cleanEmail);
  },

  async saveAssessment(resultData) {
    const cleanEmail = (resultData.email || "").trim().toLowerCase();
    const record = {
      ...resultData,
      test_id: resultData.test_id || "T-" + Date.now(),
      email: cleanEmail,
      submitted_at: resultData.submitted_at || new Date().toISOString()
    };

    if (this.hasSupabase()) {
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          const sbRow = this._mapAssessmentToSupabaseRow(record);
          await sb.from("assessments").upsert([sbRow], { onConflict: "test_id" });
          const updateFields =
            record.test_type === "Pre-test"
              ? { pretest_completed: true, updated_at: new Date().toISOString() }
              : { posttest_completed: true, updated_at: new Date().toISOString() };
          await sb.from("students").update(updateFields).eq("email", cleanEmail);
        } catch (e) {}
      }
    }

    if (this.canUseServer()) {
      try {
        const res = await fetch("/api/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record)
        });
        if (res.ok) {
          this.serverAvailable = true;
        }
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    let assessments = [];
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
      assessments = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    assessments.unshift(record);
    localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
    IDBEngine.put("assessments", record);

    const students = this.getLocalStudentsSync();
    const studentIndex = students.findIndex((s) => (s.email || "").toLowerCase() === cleanEmail);

    if (studentIndex >= 0) {
      if (record.test_type === "Pre-test") {
        students[studentIndex].pretest_completed = true;
      } else if (record.test_type === "Post-test") {
        students[studentIndex].posttest_completed = true;
      }
      students[studentIndex].name = record.student_name || students[studentIndex].name;
      students[studentIndex].grade = record.grade || students[studentIndex].grade;
      IDBEngine.put("students", students[studentIndex]);
    } else {
      const newStudent = {
        student_id: record.student_id || cleanEmail.split("@")[0],
        name: record.student_name,
        email: cleanEmail,
        username: cleanEmail,
        password: "123456",
        grade: record.grade,
        status: "active",
        pretest_completed: record.test_type === "Pre-test",
        posttest_completed: record.test_type === "Post-test",
        created_at: new Date().toISOString()
      };
      students.push(newStudent);
      IDBEngine.put("students", newStudent);
    }
    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save_assessment", data: record })
      }).catch(() => {});
    }

    return record;
  },

  async exportDatabaseJSON() {
    const students = await this.getStudents();
    const assessments = await this.getAssessments("all");
    const admins = await this.getAdmins();
    const dump = {
      database: "PSUWIT_IT_Competency_DB",
      version: "3.0",
      exported_at: new Date().toISOString(),
      tables: { students, assessments, admins }
    };

    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PSUWIT_IT_Database_Backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async exportDatabaseSQL() {
    const students = await this.getStudents();
    const assessments = await this.getAssessments("all");
    const admins = await this.getAdmins();
    const esc = (val) => String(val ?? "").replace(/'/g, "''");

    let sql = `-- ============================================================================\n`;
    sql += `-- PSU WIT IT Competency Assessment System - SQL Database Dump\n`;
    sql += `-- Generated at: ${new Date().toISOString()}\n`;
    sql += `-- ============================================================================\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS students (\n`;
    sql += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    sql += `  student_id VARCHAR(32) NOT NULL,\n`;
    sql += `  class_no VARCHAR(20) DEFAULT '',\n`;
    sql += `  title VARCHAR(50) DEFAULT '',\n`;
    sql += `  first_name VARCHAR(100) DEFAULT '',\n`;
    sql += `  last_name VARCHAR(100) DEFAULT '',\n`;
    sql += `  name VARCHAR(255) NOT NULL,\n`;
    sql += `  email VARCHAR(255) NOT NULL UNIQUE,\n`;
    sql += `  username VARCHAR(255) NOT NULL UNIQUE,\n`;
    sql += `  password VARCHAR(255) NOT NULL DEFAULT '123456',\n`;
    sql += `  grade VARCHAR(20) NOT NULL,\n`;
    sql += `  room VARCHAR(20) DEFAULT '',\n`;
    sql += `  role VARCHAR(30) NOT NULL DEFAULT 'student',\n`;
    sql += `  status VARCHAR(20) NOT NULL DEFAULT 'active',\n`;
    sql += `  pretest_completed INTEGER NOT NULL DEFAULT 0,\n`;
    sql += `  posttest_completed INTEGER NOT NULL DEFAULT 0,\n`;
    sql += `  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n\n`;

    students.forEach((s) => {
      const u = s.username || s.email;
      sql += `INSERT INTO students (student_id, class_no, title, first_name, last_name, name, email, username, password, grade, room, role, status, pretest_completed, posttest_completed, created_at) VALUES ('${esc(s.student_id)}', '${esc(s.class_no)}', '${esc(s.title)}', '${esc(s.first_name)}', '${esc(s.last_name)}', '${esc(s.name)}', '${esc(s.email)}', '${esc(u)}', '${esc(s.password || "123456")}', '${esc(s.grade)}', '${esc(s.room)}', 'student', '${esc(s.status || "active")}', ${s.pretest_completed ? 1 : 0}, ${s.posttest_completed ? 1 : 0}, '${esc(s.created_at || new Date().toISOString())}');\n`;
    });

    sql += `\nCREATE TABLE IF NOT EXISTS admins (\n`;
    sql += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    sql += `  student_id VARCHAR(32) DEFAULT '',\n`;
    sql += `  title VARCHAR(50) DEFAULT '',\n`;
    sql += `  first_name VARCHAR(100) DEFAULT '',\n`;
    sql += `  last_name VARCHAR(100) DEFAULT '',\n`;
    sql += `  name VARCHAR(255) NOT NULL,\n`;
    sql += `  email VARCHAR(255) NOT NULL UNIQUE,\n`;
    sql += `  username VARCHAR(255) NOT NULL UNIQUE,\n`;
    sql += `  password VARCHAR(255) NOT NULL DEFAULT '123456',\n`;
    sql += `  role VARCHAR(50) NOT NULL DEFAULT 'admin',\n`;
    sql += `  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n\n`;

    admins.forEach((a) => {
      const u = a.username || a.email;
      sql += `INSERT INTO admins (student_id, title, first_name, last_name, name, email, username, password, role) VALUES ('${esc(a.student_id)}', '${esc(a.title)}', '${esc(a.first_name)}', '${esc(a.last_name)}', '${esc(a.name)}', '${esc(a.email)}', '${esc(u)}', '${esc(a.password || "123456")}', '${esc(a.role || "admin")}');\n`;
    });

    sql += `\nCREATE TABLE IF NOT EXISTS assessments (\n`;
    sql += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    sql += `  test_id VARCHAR(64) NOT NULL UNIQUE,\n`;
    sql += `  student_id VARCHAR(32) NOT NULL,\n`;
    sql += `  student_name VARCHAR(255) NOT NULL,\n`;
    sql += `  email VARCHAR(255) NOT NULL,\n`;
    sql += `  grade VARCHAR(20) NOT NULL,\n`;
    sql += `  test_type VARCHAR(20) NOT NULL,\n`;
    sql += `  score_total INTEGER NOT NULL,\n`;
    sql += `  max_score INTEGER NOT NULL,\n`;
    sql += `  score_percent INTEGER NOT NULL,\n`;
    sql += `  d1_score INTEGER NOT NULL, d2_score INTEGER NOT NULL, d3_score INTEGER NOT NULL,\n`;
    sql += `  d4_score INTEGER NOT NULL, d5_score INTEGER NOT NULL, d6_score INTEGER NOT NULL,\n`;
    sql += `  domain_scores_json TEXT,\n`;
    sql += `  time_spent_seconds INTEGER NOT NULL,\n`;
    sql += `  violations_count INTEGER NOT NULL,\n`;
    sql += `  passed INTEGER NOT NULL,\n`;
    sql += `  submitted_at DATETIME NOT NULL\n`;
    sql += `);\n\n`;

    assessments.forEach((a) => {
      const d = a.domain_scores || {};
      sql += `INSERT INTO assessments (test_id, student_id, student_name, email, grade, test_type, score_total, max_score, score_percent, d1_score, d2_score, d3_score, d4_score, d5_score, d6_score, domain_scores_json, time_spent_seconds, violations_count, passed, submitted_at) VALUES ('${esc(a.test_id)}', '${esc(a.student_id)}', '${esc(a.student_name)}', '${esc(a.email)}', '${esc(a.grade)}', '${esc(a.test_type)}', ${Number(a.score_total || 0)}, ${Number(a.max_score || 75)}, ${Number(a.score_percent || 0)}, ${Number(d.D1 || 0)}, ${Number(d.D2 || 0)}, ${Number(d.D3 || 0)}, ${Number(d.D4 || 0)}, ${Number(d.D5 || 0)}, ${Number(d.D6 || 0)}, '${esc(JSON.stringify(d))}', ${Number(a.time_spent_seconds || 0)}, ${Number(a.violations_count || 0)}, ${a.passed ? 1 : 0}, '${esc(a.submitted_at || new Date().toISOString())}');\n`;
    });

    const blob = new Blob([sql], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PSUWIT_IT_Database_Dump_${Date.now()}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async importDatabaseJSON(jsonData) {
    const students = jsonData?.tables?.students || jsonData?.students || [];
    const assessments = jsonData?.tables?.assessments || jsonData?.assessments || [];

    if (this.canUseServer()) {
      try {
        await fetch("/api/database/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students, assessments })
        });
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    if (students.length > 0) {
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
      IDBEngine.putBulk("students", students);
    }
    if (assessments.length > 0) {
      localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
      IDBEngine.putBulk("assessments", assessments);
    }
    return true;
  },

  async resetDatabaseToSeed() {
    if (this.canUseServer()) {
      try {
        await fetch("/api/database/seed", { method: "POST" });
      } catch (e) {
        this.serverAvailable = false;
      }
    }

    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(INITIAL_SEED_STUDENTS));
    localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(INITIAL_SEED_ASSESSMENTS));
    localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(INITIAL_SEED_ADMINS));
    IDBEngine.clear("students");
    IDBEngine.clear("assessments");
    IDBEngine.clear("admins");
    IDBEngine.putBulk("students", INITIAL_SEED_STUDENTS);
    IDBEngine.putBulk("admins", INITIAL_SEED_ADMINS);
    return true;
  }
};

DB.initMockData();
DB.loadServerSettings();

if (typeof window !== "undefined") {
  window.DB = DB;
}
