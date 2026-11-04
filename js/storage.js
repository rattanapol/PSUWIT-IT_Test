/**
 * ระบบจัดการฐานข้อมูล (Multi-Tier Database Engine)
 * 1. Primary: SQLite 3 Relational Database ผ่าน Backend REST API (/api/*)
 * 2. Browser DB: IndexedDB (PSUWIT_IT_Database) ตาราง students, assessments, admins พร้อม Index
 * 3. Fallback Cache: LocalStorage สำหรับการเข้าถึงแบบ Offline / Static Hosting (เช่น GitHub Pages)
 * 4. รองรับฐานข้อมูลผู้ใช้งานจากไฟล์ user.xlsx (นักเรียน 1,465 คน + ผู้ดูแลระบบ 3 คน = 1,468 คน)
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

// ============================================================================
// IndexedDB Browser Relational Store
// ============================================================================
const IDBEngine = {
  dbName: "PSUWIT_IT_Database",
  dbVersion: 3,
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
        if (!db.objectStoreNames.contains("admins")) {
          db.createObjectStore("admins", { keyPath: "email" });
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

  // ตรวจสอบการเข้าสู่ระบบด้วย Username และ Password
  async authenticateUser(rawUsername, rawPassword, loginRole = "any") {
    const candidates = this.normalizeUsernameCandidates(rawUsername);
    const pwd = String(rawPassword ?? "");

    if (candidates.length === 0 || !pwd) {
      return { success: false, message: "กรุณากรอก Username และ Password ให้ครบถ้วน" };
    }

    // 1. ลองตรวจสอบผ่าน Backend SQLite API ก่อน
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: rawUsername, password: pwd, loginRole })
      });
      const json = await res.json();
      if (res.ok && json.status === "success" && json.data) {
        this.serverAvailable = true;
        return { success: true, user: json.data };
      } else if (json && json.message) {
        return { success: false, message: json.message };
      }
    } catch (e) {
      this.serverAvailable = false;
    }

    // 2. Fallback ตรวจสอบจากฐานข้อมูลในเบราว์เซอร์ (IndexedDB / LocalStorage)
    const admins = await this.getAdmins();
    const students = await this.getStudents();

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

    // 1. ส่งคำขอเปลี่ยนรหัสผ่านไปยัง SQLite Backend API
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
      const json = await res.json();
      apiHandled = true;
      apiSuccess = res.ok && json.status === "success";
      apiMessage = json.message || "";
      if (!apiSuccess) {
        return { success: false, message: apiMessage || "ไม่สามารถเปลี่ยนรหัสผ่านได้" };
      }
    } catch (e) {
      this.serverAvailable = false;
    }

    // 2. อัปเดตใน IndexedDB และ LocalStorage ให้ตรงกันเสมอ
    let updatedLocal = false;
    const students = await this.getStudents();
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
      await IDBEngine.put("students", students[sIdx]);
      updatedLocal = true;
    }

    const admins = await this.getAdmins();
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
      await IDBEngine.put("admins", admins[aIdx]);
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

    const students = await this.getStudents();
    const assessments = await this.getAssessments("all");
    return {
      connected: true,
      mode: "browser_indexeddb",
      engine: "IndexedDB (PSUWIT_IT_Database) + LocalStorage",
      file: "Browser IndexedDB Storage (user.xlsx)",
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

  // เตรียมข้อมูลเริ่มต้นจากไฟล์ user.xlsx สำหรับ IndexedDB และ LocalStorage
  async initMockData() {
    let rawStudents = localStorage.getItem(APP_CONFIG.storageKeys.students);
    let parsedStudents = [];
    try {
      parsedStudents = rawStudents ? JSON.parse(rawStudents) : [];
    } catch (e) {
      parsedStudents = [];
    }

    // หากยังไม่มีข้อมูล หรือเป็นข้อมูลตัวอย่างเดิมที่มีน้อยกว่า 100 คน ให้โหลดฐานข้อมูลจริงจาก user.xlsx (1,465 คน)
    if (!Array.isArray(parsedStudents) || parsedStudents.length < 100) {
      localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(INITIAL_SEED_STUDENTS));
      localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(INITIAL_SEED_ASSESSMENTS));
      await IDBEngine.clear("students");
      await IDBEngine.clear("assessments");
      await IDBEngine.putBulk("students", INITIAL_SEED_STUDENTS);
    } else {
      const idbStudents = await IDBEngine.getAll("students");
      if (idbStudents.length < 100) {
        await IDBEngine.putBulk("students", parsedStudents);
      }
    }

    let rawAssessments = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
    if (!rawAssessments || rawAssessments.includes("T-1715320000001")) {
      localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify([]));
      await IDBEngine.clear("assessments");
    }

    // เตรียมข้อมูลผู้ดูแลระบบเริ่มต้นจาก user.xlsx (winai@psuwit.ac.th, knok@psuwit.ac.th, 00001@psuwit.ac.th)
    let rawAdmins = localStorage.getItem(APP_CONFIG.storageKeys.admins);
    let parsedAdmins = [];
    try {
      parsedAdmins = rawAdmins ? JSON.parse(rawAdmins) : [];
    } catch (e) {
      parsedAdmins = [];
    }

    let adminsChanged = false;
    for (const seedAdmin of INITIAL_SEED_ADMINS) {
      const idx = parsedAdmins.findIndex((a) => (a.email || "").toLowerCase() === seedAdmin.email.toLowerCase());
      if (idx < 0) {
        parsedAdmins.push({ ...seedAdmin });
        adminsChanged = true;
      } else if (!parsedAdmins[idx].password) {
        parsedAdmins[idx] = { ...seedAdmin, ...parsedAdmins[idx], password: parsedAdmins[idx].password || seedAdmin.password || "123456" };
        adminsChanged = true;
      }
    }

    if (!rawAdmins || adminsChanged) {
      localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(parsedAdmins));
      await IDBEngine.putBulk("admins", parsedAdmins);
    }
  },

  // ดึงรายชื่อผู้ดูแลระบบทั้งหมด
  async getAdmins() {
    try {
      const res = await fetch("/api/admins");
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(json.data));
          await IDBEngine.putBulk("admins", json.data);
          return json.data;
        }
      }
    } catch (e) {}

    let list = await IDBEngine.getAll("admins");
    if (!list || list.length === 0) {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.admins);
      list = raw ? JSON.parse(raw) : [...INITIAL_SEED_ADMINS];
    }
    for (const seedAdmin of INITIAL_SEED_ADMINS) {
      if (!list.some((a) => (a.email || "").toLowerCase() === seedAdmin.email.toLowerCase())) {
        list.push({ ...seedAdmin });
      }
    }
    return list;
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

    try {
      await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
    } catch (e) {}

    const admins = await this.getAdmins();
    const idx = admins.findIndex((a) => (a.email || "").toLowerCase() === cleanEmail);
    if (idx >= 0) {
      admins[idx] = { ...admins[idx], ...record };
    } else {
      admins.push(record);
    }
    localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(admins));
    await IDBEngine.put("admins", record);
    return record;
  },

  // ลบผู้ดูแลระบบ (ไม่อนุญาตให้ลบ winai@psuwit.ac.th)
  async deleteAdmin(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (cleanEmail === "winai@psuwit.ac.th") {
      throw new Error("ไม่สามารถลบผู้ดูแลระบบหลัก (winai@psuwit.ac.th) ได้");
    }

    try {
      await fetch(`/api/admins?email=${encodeURIComponent(cleanEmail)}`, { method: "DELETE" });
    } catch (e) {}

    await IDBEngine.delete("admins", cleanEmail);
    const admins = (await this.getAdmins()).filter((a) => (a.email || "").toLowerCase() !== cleanEmail);
    localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(admins));
    return true;
  },

  // ดึงรายชื่อนักเรียนทั้งหมด
  async getStudents() {
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

    const idbList = await IDBEngine.getAll("students");
    if (idbList && idbList.length >= 100) {
      return idbList;
    }

    const raw = localStorage.getItem(APP_CONFIG.storageKeys.students);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.length > 0 ? parsed : [...INITIAL_SEED_STUDENTS];
  },

  // บันทึก / แก้ไขข้อมูลนักเรียน
  async saveStudent(studentData) {
    const cleanEmail = (studentData.email || studentData.username || "").trim().toLowerCase();
    let students = [];
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.students);
      students = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    const existingIndex = students.findIndex((s) => (s.email || "").toLowerCase() === cleanEmail);
    const existing = existingIndex >= 0 ? students[existingIndex] : null;

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
      grade: studentData.grade || (existing ? existing.grade : "ม.1"),
      room: studentData.room !== undefined ? studentData.room : (existing ? existing.room : ""),
      role: "student",
      status: studentData.status || (existing ? existing.status : "active"),
      pretest_completed: studentData.pretest_completed !== undefined ? Boolean(studentData.pretest_completed) : (existing ? Boolean(existing.pretest_completed) : false),
      posttest_completed: studentData.posttest_completed !== undefined ? Boolean(studentData.posttest_completed) : (existing ? Boolean(existing.posttest_completed) : false),
      created_at: (existing && existing.created_at) || studentData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

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

    if (existingIndex >= 0) {
      students[existingIndex] = record;
    } else {
      students.push(record);
    }
    await IDBEngine.put("students", record);
    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(students));

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
    students = students.filter((s) => (s.email || "").toLowerCase() !== cleanEmail);
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
    const target = students.find((s) => (s.email || "").toLowerCase() === cleanEmail);
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

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      try {
        const res = await fetch(`${gasUrl}?action=get_assessments&grade=${encodeURIComponent(gradeFilter)}`);
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          assessments = json.data;
          if (gradeFilter === "all") {
            localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
            await IDBEngine.putBulk("assessments", assessments);
          }
          return assessments;
        }
      } catch (err) {}
    }

    assessments = await IDBEngine.getAll("assessments");
    if (!assessments || assessments.length === 0) {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
      assessments = raw ? JSON.parse(raw) : [];
    }

    if (gradeFilter !== "all") {
      assessments = assessments.filter((a) => a.grade === gradeFilter);
    }

    return assessments.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  },

  async getStudentHistory(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
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

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        this.serverAvailable = true;
      }
    } catch (e) {}

    let assessments = [];
    try {
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.assessments);
      assessments = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    assessments.unshift(record);
    localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(assessments));
    await IDBEngine.put("assessments", record);

    const students = await this.getStudents();
    const studentIndex = students.findIndex((s) => (s.email || "").toLowerCase() === cleanEmail);

    if (studentIndex >= 0) {
      if (record.test_type === "Pre-test") {
        students[studentIndex].pretest_completed = true;
      } else if (record.test_type === "Post-test") {
        students[studentIndex].posttest_completed = true;
      }
      students[studentIndex].name = record.student_name || students[studentIndex].name;
      students[studentIndex].grade = record.grade || students[studentIndex].grade;
      await IDBEngine.put("students", students[studentIndex]);
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
      await IDBEngine.put("students", newStudent);
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

  async resetDatabaseToSeed() {
    try {
      await fetch("/api/database/seed", { method: "POST" });
    } catch (e) {}

    await IDBEngine.clear("students");
    await IDBEngine.clear("assessments");
    await IDBEngine.clear("admins");
    localStorage.setItem(APP_CONFIG.storageKeys.students, JSON.stringify(INITIAL_SEED_STUDENTS));
    localStorage.setItem(APP_CONFIG.storageKeys.assessments, JSON.stringify(INITIAL_SEED_ASSESSMENTS));
    localStorage.setItem(APP_CONFIG.storageKeys.admins, JSON.stringify(INITIAL_SEED_ADMINS));
    await IDBEngine.putBulk("students", INITIAL_SEED_STUDENTS);
    await IDBEngine.putBulk("admins", INITIAL_SEED_ADMINS);
    return true;
  }
};

DB.initMockData();
DB.loadServerSettings();

if (typeof window !== "undefined") {
  window.DB = DB;
}
