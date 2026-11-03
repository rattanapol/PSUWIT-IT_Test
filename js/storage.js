/**
 * ระบบจัดการฐานข้อมูล (Multi-Tier Database Engine)
 * 1. Primary: SQLite 3 Relational Database ผ่าน Backend REST API (/api/*)
 * 2. Browser DB: IndexedDB (PSUWIT_IT_Database) ตาราง students และ assessments พร้อม Index
 * 3. Fallback Cache: LocalStorage สำหรับการเข้าถึงแบบ Offline / Static Hosting (เช่น GitHub Pages)
 * 4. Optional Cloud Sync: รองรับการส่งข้อมูลต่อไปยัง External Webhook / Google Apps Script
 */

const INITIAL_SEED_STUDENTS = [
  { student_id: "1001", name: "เด็กชายกิตติศักดิ์ มณีโชติ", email: "1001@psuwit.ac.th", grade: "ม.1", status: "active", pretest_completed: true, posttest_completed: false, created_at: "2026-05-10T08:30:00Z" },
  { student_id: "1002", name: "เด็กหญิงกมลวรรณ ชัยเจริญ", email: "1002@psuwit.ac.th", grade: "ม.1", status: "active", pretest_completed: true, posttest_completed: true, created_at: "2026-05-10T09:00:00Z" },
  { student_id: "2001", name: "เด็กชายนภดล รัตนโกสินทร์", email: "2001@psuwit.ac.th", grade: "ม.2", status: "active", pretest_completed: true, posttest_completed: false, created_at: "2026-05-11T10:15:00Z" },
  { student_id: "3001", name: "เด็กหญิงชญานิษฐ์ วรรณกรรม", email: "3001@psuwit.ac.th", grade: "ม.3", status: "active", pretest_completed: true, posttest_completed: true, created_at: "2026-05-12T11:20:00Z" },
  { student_id: "4001", name: "นายธนภัทร สุขสมบูรณ์", email: "4001@psuwit.ac.th", grade: "ม.4", status: "active", pretest_completed: true, posttest_completed: true, created_at: "2026-05-13T13:45:00Z" },
  { student_id: "5001", name: "นางสาวศศิธร เปล่งศรี", email: "5001@psuwit.ac.th", grade: "ม.5", status: "active", pretest_completed: true, posttest_completed: false, created_at: "2026-05-14T14:10:00Z" },
  { student_id: "6001", name: "นายวริทธิ์ อัครเดชาภิรมย์", email: "6001@psuwit.ac.th", grade: "ม.6", status: "active", pretest_completed: true, posttest_completed: true, created_at: "2026-05-15T15:00:00Z" }
];

const INITIAL_SEED_ASSESSMENTS = [
  {
    test_id: "T-1715320000001",
    student_id: "1001",
    student_name: "เด็กชายกิตติศักดิ์ มณีโชติ",
    email: "1001@psuwit.ac.th",
    grade: "ม.1",
    test_type: "Pre-test",
    score_total: 18,
    max_score: 30,
    score_percent: 60,
    domain_scores: { D1: 60, D2: 80, D3: 40, D4: 60, D5: 80, D6: 40 },
    time_spent_seconds: 520,
    violations_count: 0,
    passed: true,
    submitted_at: "2026-05-10T09:15:00Z"
  },
  {
    test_id: "T-1715320000002",
    student_id: "1002",
    student_name: "เด็กหญิงกมลวรรณ ชัยเจริญ",
    email: "1002@psuwit.ac.th",
    grade: "ม.1",
    test_type: "Pre-test",
    score_total: 19,
    max_score: 30,
    score_percent: 63,
    domain_scores: { D1: 60, D2: 80, D3: 60, D4: 60, D5: 60, D6: 60 },
    time_spent_seconds: 480,
    violations_count: 0,
    passed: true,
    submitted_at: "2026-05-10T09:30:00Z"
  },
  {
    test_id: "T-1715320000003",
    student_id: "1002",
    student_name: "เด็กหญิงกมลวรรณ ชัยเจริญ",
    email: "1002@psuwit.ac.th",
    grade: "ม.1",
    test_type: "Post-test",
    score_total: 27,
    max_score: 30,
    score_percent: 90,
    domain_scores: { D1: 100, D2: 80, D3: 100, D4: 80, D5: 100, D6: 80 },
    time_spent_seconds: 410,
    violations_count: 0,
    passed: true,
    submitted_at: "2026-05-10T11:45:00Z"
  },
  {
    test_id: "T-1715320000004",
    student_id: "4001",
    student_name: "นายธนภัทร สุขสมบูรณ์",
    email: "4001@psuwit.ac.th",
    grade: "ม.4",
    test_type: "Pre-test",
    score_total: 20,
    max_score: 30,
    score_percent: 66,
    domain_scores: { D1: 80, D2: 60, D3: 60, D4: 80, D5: 60, D6: 60 },
    time_spent_seconds: 640,
    violations_count: 1,
    passed: true,
    submitted_at: "2026-05-13T14:10:00Z"
  },
  {
    test_id: "T-1715320000005",
    student_id: "4001",
    student_name: "นายธนภัทร สุขสมบูรณ์",
    email: "4001@psuwit.ac.th",
    grade: "ม.4",
    test_type: "Post-test",
    score_total: 28,
    max_score: 30,
    score_percent: 93,
    domain_scores: { D1: 100, D2: 100, D3: 80, D4: 100, D5: 100, D6: 80 },
    time_spent_seconds: 510,
    violations_count: 0,
    passed: true,
    submitted_at: "2026-05-13T16:00:00Z"
  }
];

// ============================================================================
// IndexedDB Browser Relational Store
// ============================================================================
const IDBEngine = {
  dbName: "PSUWIT_IT_Database",
  dbVersion: 1,
  _dbPromise: null,

  open() {
    if (this._dbPromise) return this._dbPromise;
    if (typeof indexedDB === "undefined") return Promise.resolve(null);

    this._dbPromise = new Promise((resolve) => {
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
      };

      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });

    return this._dbPromise;
  },

  async getAll(storeName) {
    const db = await this.open();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },

  async put(storeName, record) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  },

  async putBulk(storeName, records) {
    const db = await this.open();
    if (!db || !Array.isArray(records)) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      records.forEach((r) => store.put(r));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  },

  async delete(storeName, key) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  },

  async clear(storeName) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
};

// ============================================================================
// Main DB Adapter
// ============================================================================
const DB = {
  serverAvailable: null,

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
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_client_id: clean })
      });
    } catch (e) {}
  },

  async loadServerSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && json.data) {
          if (json.data.google_client_id !== undefined && json.data.google_client_id !== "") {
            localStorage.setItem(APP_CONFIG.storageKeys.googleClientId, json.data.google_client_id);
          }
        }
      }
    } catch (e) {}
  },

  // ตรวจสอบสถานะฐานข้อมูลทั้งหมด (SQLite Backend + IndexedDB)
  async getDatabaseStatus() {
    try {
      const res = await fetch("/api/status", { method: "GET" });
      if (res.ok) {
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
      }
    } catch (e) {
      this.serverAvailable = false;
    }

    // Fallback: IndexedDB + LocalStorage
    const students = await this.getStudents();
    const assessments = await this.getAssessments("all");
    return {
      connected: true,
      mode: "browser_indexeddb",
      engine: "IndexedDB (PSUWIT_IT_Database) + LocalStorage",
      file: "Browser IndexedDB Storage",
      fileSize: new Blob([JSON.stringify({ students, assessments })]).size,
      tables: {
        students: students.length,
        assessments: assessments.length
      }
    };
  },

  // ทดสอบการเชื่อมต่อ External Webhook / Google Apps Script
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

  // เตรียมข้อมูลเริ่มต้นสำหรับ IndexedDB และ LocalStorage
  async initMockData() {
    let rawStudents = localStorage.getItem(APP_CONFIG.storageKeys.students);
    // ตรวจสอบว่ามีข้อมูลรูปแบบเก่า (เช่น s641001@psuwit.ac.th) ค้างอยู่หรือไม่ หากมีให้อัปเดตเป็นรูปแบบรหัส 4 หลัก
    if (!rawStudents || rawStudents.includes("s641001@psuwit.ac.th")) {
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(INITIAL_SEED_STUDENTS));
      localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(INITIAL_SEED_ASSESSMENTS));
      await IDBEngine.clear("students");
      await IDBEngine.clear("assessments");
      rawStudents = JSON.stringify(INITIAL_SEED_STUDENTS);
    }

    let rawAssessments = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
    if (!rawAssessments) {
      localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(INITIAL_SEED_ASSESSMENTS));
      rawAssessments = JSON.stringify(INITIAL_SEED_ASSESSMENTS);
    } else {
      // อัปเกรดข้อมูลคะแนนรายด้านเดิมที่เป็น 1-5 ให้เป็นเปอร์เซ็นต์ 0-100% สำหรับกราฟเรดาร์
      try {
        const parsed = JSON.parse(rawAssessments);
        let updated = false;
        parsed.forEach((a) => {
          if (a.domain_scores && a.domain_scores.D1 <= 5 && a.domain_scores.D2 <= 5) {
            Object.keys(a.domain_scores).forEach((k) => {
              a.domain_scores[k] = Math.round((a.domain_scores[k] / 5) * 100);
            });
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    // ซิงก์เข้า IndexedDB
    const idbStudents = await IDBEngine.getAll("students");
    if (idbStudents.length === 0) {
      await IDBEngine.putBulk("students", JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.students) || "[]"));
    }
    const idbAssessments = await IDBEngine.getAll("assessments");
    if (idbAssessments.length === 0) {
      await IDBEngine.putBulk("assessments", JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.assessments) || "[]"));
    }
  },

  // ดึงรายชื่อนักเรียนทั้งหมด
  async getStudents() {
    // 1. ลองดึงจาก SQLite Backend API
    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          this.serverAvailable = true;
          localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(json.data));
          await IDBEngine.putBulk("students", json.data);
          return json.data;
        }
      }
    } catch (e) {
      this.serverAvailable = false;
    }

    // 2. ลองดึงจาก External Webhook ถ้าตั้งค่าไว้
    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      try {
        const res = await fetch(`${gasUrl}?action=get_students`);
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(json.data));
          await IDBEngine.putBulk("students", json.data);
          return json.data;
        }
      } catch (err) {}
    }

    // 3. ดึงจาก IndexedDB
    const idbList = await IDBEngine.getAll("students");
    if (idbList && idbList.length > 0) {
      return idbList;
    }

    // 4. ดึงจาก LocalStorage
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.students);
    return raw ? JSON.parse(raw) : [];
  },

  // บันทึก / แก้ไขข้อมูลนักเรียน
  async saveStudent(studentData) {
    const cleanEmail = (studentData.email || "").trim().toLowerCase();
    const record = {
      student_id: studentData.student_id,
      name: studentData.name,
      email: cleanEmail,
      grade: studentData.grade,
      status: studentData.status || "active",
      pretest_completed: Boolean(studentData.pretest_completed),
      posttest_completed: Boolean(studentData.posttest_completed),
      created_at: studentData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. บันทึกลง SQLite Backend API
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        this.serverAvailable = true;
      }
    } catch (e) {}

    // 2. บันทึกลง IndexedDB และ LocalStorage
    let students = [];
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.students);
      students = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    const existingIndex = students.findIndex((s) => s.email.toLowerCase() === cleanEmail);
    if (existingIndex >= 0) {
      students[existingIndex] = { ...students[existingIndex], ...studentData, email: cleanEmail, updated_at: record.updated_at };
      await IDBEngine.put("students", students[existingIndex]);
    } else {
      students.push(record);
      await IDBEngine.put("students", record);
    }
    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));

    // 3. ส่งไปยัง External Webhook (ถ้ามี)
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

  // ลบนักเรียน
  async deleteStudent(email) {
    const cleanEmail = (email || "").trim().toLowerCase();

    try {
      await fetch(`/api/students?email=${encodeURIComponent(cleanEmail)}`, { method: "DELETE" });
    } catch (e) {}

    await IDBEngine.delete("students", cleanEmail);

    const raw = localStorage.getItem(APP_CONFIG.storageKeys.students);
    let students = raw ? JSON.parse(raw) : [];
    students = students.filter((s) => s.email.toLowerCase() !== cleanEmail);
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

    try {
      await fetch("/api/students/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail })
      });
    } catch (e) {}

    const students = await this.getStudents();
    const target = students.find((s) => s.email.toLowerCase() === cleanEmail);
    if (target) {
      target.pretest_completed = false;
      target.posttest_completed = false;
      await IDBEngine.put("students", target);
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
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

    // 1. ลองดึงจาก SQLite Backend API
    try {
      const res = await fetch(`/api/assessments?grade=${encodeURIComponent(gradeFilter)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          this.serverAvailable = true;
          assessments = json.data;
          if (gradeFilter === "all") {
            localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
            await IDBEngine.putBulk("assessments", assessments);
          }
          return assessments;
        }
      }
    } catch (e) {
      this.serverAvailable = false;
    }

    // 2. ดึงจาก External Webhook (ถ้ามี)
    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      try {
        const res = await fetch(`${gasUrl}?action=get_assessments&grade=${encodeURIComponent(gradeFilter)}`);
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          assessments = json.data;
          localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
          await IDBEngine.putBulk("assessments", assessments);
        }
      } catch (err) {}
    }

    // 3. ดึงจาก IndexedDB
    if (assessments.length === 0) {
      const idbList = await IDBEngine.getAll("assessments");
      if (idbList && idbList.length > 0) {
        assessments = idbList.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
      }
    }

    // 4. ดึงจาก LocalStorage
    if (assessments.length === 0) {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
      assessments = raw ? JSON.parse(raw) : [];
    }

    if (gradeFilter && gradeFilter !== "all") {
      return assessments.filter((a) => a.grade === gradeFilter);
    }
    return assessments;
  },

  // ดึงประวัติการสอบของนักเรียนคนใดคนหนึ่ง
  async getStudentHistory(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const all = await this.getAssessments("all");
    return all.filter((a) => a.email && a.email.toLowerCase() === cleanEmail);
  },

  // บันทึกผลการสอบใหม่ลงฐานข้อมูล
  async saveAssessment(resultData) {
    const newRecord = {
      test_id: "T-" + Date.now(),
      student_id: resultData.student_id || "",
      student_name: resultData.student_name || "",
      email: (resultData.email || "").trim().toLowerCase(),
      grade: resultData.grade,
      test_type: resultData.test_type,
      score_total: resultData.score_total,
      max_score: resultData.max_score,
      score_percent: resultData.score_percent,
      domain_scores: resultData.domain_scores,
      time_spent_seconds: resultData.time_spent_seconds,
      violations_count: resultData.violations_count || 0,
      passed: resultData.passed,
      submitted_at: new Date().toISOString()
    };

    // 1. บันทึกลง SQLite Backend API
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord)
      });
      if (res.ok) {
        this.serverAvailable = true;
      }
    } catch (e) {}

    // 2. บันทึกลง IndexedDB และ LocalStorage
    await IDBEngine.put("assessments", newRecord);
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
    const assessments = raw ? JSON.parse(raw) : [];
    assessments.unshift(newRecord);
    localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));

    // อัปเดตสถานะในตารางนักเรียน
    const students = await this.getStudents();
    const student = students.find((s) => s.email.toLowerCase() === newRecord.email);
    if (student) {
      if (resultData.test_type === "Pre-test") student.pretest_completed = true;
      if (resultData.test_type === "Post-test") student.posttest_completed = true;
      await IDBEngine.put("students", student);
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
    }

    // 3. ซิงก์ขึ้น External Webhook / Google Sheets (ถ้ามี)
    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      const payload = {
        action: "submit_assessment",
        data: {
          ...newRecord,
          d1_score: newRecord.domain_scores?.D1 || 0,
          d2_score: newRecord.domain_scores?.D2 || 0,
          d3_score: newRecord.domain_scores?.D3 || 0,
          d4_score: newRecord.domain_scores?.D4 || 0,
          d5_score: newRecord.domain_scores?.D5 || 0,
          d6_score: newRecord.domain_scores?.D6 || 0
        }
      };
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }

    return newRecord;
  },

  // ส่งออกฐานข้อมูลทั้งหมดเป็นไฟล์ JSON (.json)
  async exportDatabaseJSON() {
    const status = await this.getDatabaseStatus();
    const students = await this.getStudents();
    const assessments = await this.getAssessments("all");

    const dump = {
      database: "PSUWIT_IT_Competency_Database",
      exported_at: new Date().toISOString(),
      engine: status.engine,
      tables: {
        students,
        assessments
      }
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

  // ส่งออกฐานข้อมูลเป็นไฟล์ SQL Dump (.sql)
  async exportDatabaseSQL() {
    const students = await this.getStudents();
    const assessments = await this.getAssessments("all");
    const esc = (val) => String(val ?? "").replace(/'/g, "''");

    let sql = `-- ============================================================================\n`;
    sql += `-- PSU WIT IT Competency Assessment System - SQL Database Dump\n`;
    sql += `-- Generated at: ${new Date().toISOString()}\n`;
    sql += `-- ============================================================================\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS students (\n`;
    sql += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    sql += `  student_id VARCHAR(32) NOT NULL,\n`;
    sql += `  name VARCHAR(255) NOT NULL,\n`;
    sql += `  email VARCHAR(255) NOT NULL UNIQUE,\n`;
    sql += `  grade VARCHAR(20) NOT NULL,\n`;
    sql += `  status VARCHAR(20) NOT NULL DEFAULT 'active',\n`;
    sql += `  pretest_completed INTEGER NOT NULL DEFAULT 0,\n`;
    sql += `  posttest_completed INTEGER NOT NULL DEFAULT 0,\n`;
    sql += `  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n\n`;

    students.forEach((s) => {
      sql += `INSERT INTO students (student_id, name, email, grade, status, pretest_completed, posttest_completed, created_at) VALUES ('${esc(s.student_id)}', '${esc(s.name)}', '${esc(s.email)}', '${esc(s.grade)}', '${esc(s.status || "active")}', ${s.pretest_completed ? 1 : 0}, ${s.posttest_completed ? 1 : 0}, '${esc(s.created_at || new Date().toISOString())}');\n`;
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
      sql += `INSERT INTO assessments (test_id, student_id, student_name, email, grade, test_type, score_total, max_score, score_percent, d1_score, d2_score, d3_score, d4_score, d5_score, d6_score, domain_scores_json, time_spent_seconds, violations_count, passed, submitted_at) VALUES ('${esc(a.test_id)}', '${esc(a.student_id)}', '${esc(a.student_name)}', '${esc(a.email)}', '${esc(a.grade)}', '${esc(a.test_type)}', ${Number(a.score_total || 0)}, ${Number(a.max_score || 30)}, ${Number(a.score_percent || 0)}, ${Number(d.D1 || 0)}, ${Number(d.D2 || 0)}, ${Number(d.D3 || 0)}, ${Number(d.D4 || 0)}, ${Number(d.D5 || 0)}, ${Number(d.D6 || 0)}, '${esc(JSON.stringify(d))}', ${Number(a.time_spent_seconds || 0)}, ${Number(a.violations_count || 0)}, ${a.passed ? 1 : 0}, '${esc(a.submitted_at || new Date().toISOString())}');\n`;
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

  // นำเข้าข้อมูลฐานข้อมูลจากไฟล์ JSON
  async importDatabaseJSON(jsonData) {
    const students = jsonData?.tables?.students || jsonData?.students || [];
    const assessments = jsonData?.tables?.assessments || jsonData?.assessments || [];

    try {
      await fetch("/api/database/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students, assessments })
      });
    } catch (e) {}

    if (students.length > 0) {
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));
      await IDBEngine.putBulk("students", students);
    }
    if (assessments.length > 0) {
      localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
      await IDBEngine.putBulk("assessments", assessments);
    }
    return true;
  },

  // รีเซ็ตฐานข้อมูลกลับเป็นค่าเริ่มต้น (Seed Data)
  async resetDatabaseToSeed() {
    try {
      await fetch("/api/database/seed", { method: "POST" });
    } catch (e) {}

    await IDBEngine.clear("students");
    await IDBEngine.clear("assessments");
    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(INITIAL_SEED_STUDENTS));
    localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(INITIAL_SEED_ASSESSMENTS));
    await IDBEngine.putBulk("students", INITIAL_SEED_STUDENTS);
    await IDBEngine.putBulk("assessments", INITIAL_SEED_ASSESSMENTS);
    return true;
  }
};

// เริ่มต้นฐานข้อมูลเมื่อโหลดสคริปต์
DB.initMockData();
DB.loadServerSettings();

if (typeof window !== "undefined") {
  window.DB = DB;
}
