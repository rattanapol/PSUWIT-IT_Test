/**
 * ระบบจัดการและรายงานผลสำหรับผู้ดูแลระบบ (Admin Module)
 * - Dashboard ภาพรวมสถิติการทดสอบและกราฟเปรียบเทียบ
 * - ตารางบันทึกการสอบแบบ Real-time พร้อมตัวกรองรายระดับชั้น (ม.1 - ม.6) และค้นหา
 * - Export ข้อมูลผลการสอบแยกตามระดับชั้นเป็นไฟล์ CSV (รองรับภาษาไทย UTF-8 BOM สำหรับ Excel)
 * - การจัดการข้อมูลนักเรียนจากฐานข้อมูล user.xlsx (1,465 คน) พร้อมตัวกรอง ค้นหา แบ่งหน้า และเปลี่ยนรหัสผ่าน
 * - การจัดการผู้ดูแลระบบ (Admin) และการสำรองฐานข้อมูล
 */

const AdminController = {
  currentFilterGrade: "all",
  searchKeyword: "",
  studentFilterGrade: "all",
  studentSearchKeyword: "",
  studentPage: 1,
  studentPageSize: 50,
  activeTab: "dashboard", // "dashboard" | "assessments" | "students" | "admins" | "settings"
  cachedAssessments: [],
  cachedStudents: [],
  cachedAdmins: [],
  _eventsBound: false,

  async init() {
    if (!this._eventsBound) {
      this.bindEvents();
      this._eventsBound = true;
    }
    await this.refreshData();
  },

  bindEvents() {
    // แท็บสลับหน้าจอ Admin
    document.querySelectorAll(".admin-nav-item").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // ตัวกรองระดับชั้นในตารางบันทึกผล
    const gradeSelect = document.getElementById("adminGradeFilter");
    if (gradeSelect) {
      gradeSelect.addEventListener("change", (e) => {
        this.currentFilterGrade = e.target.value;
        this.renderAssessmentsTable();
      });
    }

    // ช่องค้นหานักเรียนในตารางบันทึกผล
    const searchInput = document.getElementById("adminSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchKeyword = e.target.value.trim().toLowerCase();
        this.renderAssessmentsTable();
      });
    }

    // ตัวกรองระดับชั้นในตารางรายชื่อนักเรียน (1,465 คน)
    const studentGradeFilter = document.getElementById("adminStudentGradeFilter");
    if (studentGradeFilter) {
      studentGradeFilter.addEventListener("change", (e) => {
        this.studentFilterGrade = e.target.value;
        this.studentPage = 1;
        this.renderStudentsTable();
      });
    }

    // ช่องค้นหารายชื่อนักเรียน
    const studentSearchInput = document.getElementById("adminStudentSearchInput");
    if (studentSearchInput) {
      studentSearchInput.addEventListener("input", (e) => {
        this.studentSearchKeyword = e.target.value.trim().toLowerCase();
        this.studentPage = 1;
        this.renderStudentsTable();
      });
    }

    // ปุ่ม Export CSV
    const exportBtn = document.getElementById("btnExportCsv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportAssessmentsCSV();
      });
    }

    // ฟอร์มเพิ่ม/แก้ไขนักเรียน
    const studentForm = document.getElementById("studentManageForm");
    if (studentForm) {
      studentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveStudent();
      });
    }

    // ฟอร์มเพิ่มผู้ดูแลระบบใหม่
    const adminAddForm = document.getElementById("adminAddManageForm");
    if (adminAddForm) {
      adminAddForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAddAdmin();
      });
    }

    // การเชื่อมต่อฐานข้อมูลและจัดการ Backup/Restore
    const btnExportSql = document.getElementById("btnExportDbSql");
    if (btnExportSql) {
      btnExportSql.addEventListener("click", () => DB.exportDatabaseSQL());
    }

    const btnExportJson = document.getElementById("btnExportDbJson");
    if (btnExportJson) {
      btnExportJson.addEventListener("click", () => DB.exportDatabaseJSON());
    }

    const inputImportJson = document.getElementById("inputImportDbJson");
    if (inputImportJson) {
      inputImportJson.addEventListener("change", (e) => this.handleImportDatabase(e));
    }

    const btnResetSeed = document.getElementById("btnResetSeedDb");
    if (btnResetSeed) {
      btnResetSeed.addEventListener("click", () => this.handleResetSeedDatabase());
    }

    // การเชื่อมต่อ External Cloud / Google Sheets
    const gasTestBtn = document.getElementById("btnTestGas");
    if (gasTestBtn) {
      gasTestBtn.addEventListener("click", () => this.handleTestGasConnection());
    }

    const gasSaveBtn = document.getElementById("btnSaveGas");
    if (gasSaveBtn) {
      gasSaveBtn.addEventListener("click", () => this.handleSaveGasUrl());
    }
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll(".admin-nav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabName);
    });
    document.querySelectorAll(".admin-tab-pane").forEach((p) => {
      p.classList.toggle("active", p.id === `adminPane-${tabName}`);
    });

    if (tabName === "dashboard") {
      this.renderDashboard();
    } else if (tabName === "assessments") {
      this.renderAssessmentsTable();
    } else if (tabName === "students") {
      this.renderStudentsTable();
    } else if (tabName === "admins") {
      this.renderAdminsTable();
    } else if (tabName === "settings") {
      this.renderSettings();
    }
  },

  async refreshData() {
    this.cachedStudents = await DB.getStudents();
    this.cachedAssessments = await DB.getAssessments();
    this.cachedAdmins = await DB.getAdmins();
    this.renderDashboard();
    this.renderAssessmentsTable();
    this.renderStudentsTable();
    this.renderAdminsTable();
    this.renderSettings();
  },

  // 1. เรนเดอร์ Dashboard สถิติ
  renderDashboard() {
    const totalStudents = this.cachedStudents.length;
    const totalTests = this.cachedAssessments.length;

    const preTests = this.cachedAssessments.filter((a) => a.test_type === "Pre-test");
    const postTests = this.cachedAssessments.filter((a) => a.test_type === "Post-test");

    const preAvg = preTests.length ? Math.round(preTests.reduce((acc, c) => acc + Number(c.score_percent || 0), 0) / preTests.length) : 0;
    const postAvg = postTests.length ? Math.round(postTests.reduce((acc, c) => acc + Number(c.score_percent || 0), 0) / postTests.length) : 0;
    const passCount = postTests.filter((a) => a.passed).length;
    const passRate = postTests.length ? Math.round((passCount / postTests.length) * 100) : 0;

    const elTotalStudents = document.getElementById("statTotalStudents");
    const elTotalTests = document.getElementById("statTotalTests");
    const elPreAvg = document.getElementById("statPreAvg");
    const elPostAvg = document.getElementById("statPostAvg");
    const elPassRate = document.getElementById("statPassRate");

    if (elTotalStudents) elTotalStudents.textContent = totalStudents.toLocaleString();
    if (elTotalTests) elTotalTests.textContent = totalTests.toLocaleString();
    if (elPreAvg) elPreAvg.textContent = `${preAvg}%`;
    if (elPostAvg) elPostAvg.textContent = `${postAvg}%`;
    if (elPassRate) elPassRate.textContent = `${passRate}%`;

    AssessmentCharts.renderAdminOverviewChart("adminOverviewChartCanvas", this.cachedAssessments);
  },

  // 2. เรนเดอร์ ตารางบันทึกผลการสอบ
  renderAssessmentsTable() {
    const tbody = document.getElementById("adminAssessmentsTableBody");
    if (!tbody) return;

    let filtered = [...this.cachedAssessments];

    if (this.currentFilterGrade !== "all") {
      filtered = filtered.filter((a) => a.grade === this.currentFilterGrade);
    }

    if (this.searchKeyword) {
      filtered = filtered.filter((a) =>
        (a.student_name && a.student_name.toLowerCase().includes(this.searchKeyword)) ||
        (a.email && a.email.toLowerCase().includes(this.searchKeyword)) ||
        (a.student_id && a.student_id.toLowerCase().includes(this.searchKeyword))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8 text-slate-400">
            <div class="empty-state">
              <span class="empty-icon">🔍</span>
              <p>ไม่พบรายการผลการทดสอบที่ตรงกับเงื่อนไข</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map((item, idx) => {
        const typeBadge = item.test_type === "Post-test"
          ? `<span class="badge badge-success">Post-test</span>`
          : `<span class="badge badge-primary">Pre-test</span>`;

        const passBadge = item.passed
          ? `<span class="badge badge-pass">ผ่านเกณฑ์</span>`
          : `<span class="badge badge-fail">ต้องพัฒนา</span>`;

        const formattedDate = item.submitted_at
          ? new Date(item.submitted_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
          : "-";

        const violations = item.violations_count > 0
          ? `<span class="text-amber-500 font-semibold">${item.violations_count} ครั้ง</span>`
          : `<span class="text-emerald-500 font-medium">0 ครั้ง</span>`;

        return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>
              <div class="student-cell">
                <span class="student-name font-semibold">${item.student_name || "ไม่ระบุ"}</span>
                <span class="student-email text-xs text-slate-400">${item.email || "-"}</span>
              </div>
            </td>
            <td><span class="badge badge-outline">${item.grade || "-"}</span></td>
            <td>${typeBadge}</td>
            <td class="font-bold text-center">
              <span class="${item.score_percent >= 60 ? 'text-emerald-600' : 'text-amber-600'}">
                ${item.score_total}/${item.max_score} (${item.score_percent}%)
              </span>
            </td>
            <td class="text-center">${passBadge}</td>
            <td class="text-center">${violations}</td>
            <td class="text-center text-xs text-slate-500">${formattedDate}</td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline" onclick="AdminController.viewAssessmentDetail('${item.test_id}')">
                ดูผลละเอียด
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  },

  viewAssessmentDetail(testId) {
    const item = this.cachedAssessments.find((a) => a.test_id === testId);
    if (!item) return;

    const otherTest = this.cachedAssessments.find(
      (a) => a.email.toLowerCase() === item.email.toLowerCase() && a.test_id !== item.test_id
    );

    const modal = document.getElementById("assessmentDetailModal");
    const container = document.getElementById("assessmentDetailModalContent");
    if (!modal || !container) return;

    container.innerHTML = `
      <div class="modal-header">
        <h3 class="text-xl font-bold">รายงานผลการทดสอบละเอียด</h3>
        <button class="modal-close" onclick="document.getElementById('assessmentDetailModal').classList.remove('active')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="grid grid-cols-2 gap-4 mb-4 bg-slate-50 p-4 rounded-xl">
          <div><strong>ชื่อ-สกุล:</strong> ${item.student_name}</div>
          <div><strong>รหัสนักเรียน:</strong> ${item.student_id || "-"}</div>
          <div><strong>Username:</strong> ${item.email}</div>
          <div><strong>ระดับชั้น:</strong> ${item.grade} (${item.test_type})</div>
          <div><strong>คะแนนรวม:</strong> ${item.score_total} / ${item.max_score} (${item.score_percent}%)</div>
          <div><strong>ตรวจจับการสลับจอ:</strong> ${item.violations_count} ครั้ง</div>
        </div>

        <div style="height: 320px; position: relative;">
          <canvas id="modalRadarChartCanvas"></canvas>
        </div>

        <div class="mt-4 flex justify-end gap-2">
          ${item.passed ? `
            <button class="btn btn-gold" onclick="CertificateEngine.downloadCertificatePDF(${JSON.stringify(item).replace(/"/g, '&quot;')})">
              📥 ดาวน์โหลดเกียรติบัตร (PDF)
            </button>
          ` : ''}
          <button class="btn btn-secondary" onclick="document.getElementById('assessmentDetailModal').classList.remove('active')">
            ปิด
          </button>
        </div>
      </div>
    `;

    modal.classList.add("active");

    setTimeout(() => {
      AssessmentCharts.renderRadarChart("modalRadarChartCanvas", item, otherTest);
    }, 100);
  },

  // 3. เรนเดอร์ ตารางจัดการข้อมูลนักเรียน (พร้อมกรอง ค้นหา และแบ่งหน้าสำหรับ 1,465 คน)
  renderStudentsTable() {
    const tbody = document.getElementById("adminStudentsTableBody");
    const countLabel = document.getElementById("adminStudentsCountLabel");
    const paginationEl = document.getElementById("adminStudentsPagination");
    if (!tbody) return;

    let filtered = [...this.cachedStudents];

    if (this.studentFilterGrade !== "all") {
      filtered = filtered.filter((s) => s.grade === this.studentFilterGrade);
    }

    if (this.studentSearchKeyword) {
      const kw = this.studentSearchKeyword;
      filtered = filtered.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(kw)) ||
          (s.email && s.email.toLowerCase().includes(kw)) ||
          (s.username && s.username.toLowerCase().includes(kw)) ||
          (s.student_id && String(s.student_id).toLowerCase().includes(kw))
      );
    }

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / this.studentPageSize));
    if (this.studentPage > totalPages) this.studentPage = totalPages;

    const startIdx = (this.studentPage - 1) * this.studentPageSize;
    const pageItems = filtered.slice(startIdx, startIdx + this.studentPageSize);

    if (countLabel) {
      countLabel.textContent = `พบนักเรียน ${totalCount.toLocaleString()} คน (จากทั้งหมด ${this.cachedStudents.length.toLocaleString()} คน) — หน้า ${this.studentPage} / ${totalPages}`;
    }

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-6 text-slate-400">ไม่พบรายชื่อนักเรียนที่ตรงกับเงื่อนไข</td>
        </tr>
      `;
      if (paginationEl) paginationEl.innerHTML = "";
      return;
    }

    tbody.innerHTML = pageItems
      .map((student, idx) => {
        const rowNum = startIdx + idx + 1;
        const isSuspended = student.status === "suspended";
        const statusBadge = isSuspended
          ? `<span class="badge badge-fail">ระงับชั่วคราว</span>`
          : `<span class="badge badge-success">พร้อมใช้งาน</span>`;

        const preChecked = student.pretest_completed ? `<span class="text-emerald-500 font-bold">✓ ทำแล้ว</span>` : `<span class="text-slate-400">-</span>`;
        const postChecked = student.posttest_completed ? `<span class="text-emerald-500 font-bold">✓ ทำแล้ว</span>` : `<span class="text-slate-400">-</span>`;
        const roomStr = student.room ? `/${student.room}` : "";
        const classNoStr = student.class_no ? ` (#${student.class_no})` : "";

        return `
          <tr>
            <td class="text-center">${rowNum}</td>
            <td><strong>${student.student_id || "-"}</strong></td>
            <td>${student.name}</td>
            <td class="text-xs font-medium text-indigo-700">${student.username || student.email}</td>
            <td class="text-center"><span class="badge badge-outline">${student.grade}${roomStr}${classNoStr}</span></td>
            <td class="text-center">${preChecked} / ${postChecked}</td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center">
              <div class="flex items-center justify-center gap-1">
                <button class="btn-icon" title="แก้ไขข้อมูล" onclick="AdminController.openEditStudent('${student.email}')">✏️</button>
                <button class="btn-icon" title="ตั้งรหัสผ่านใหม่" onclick="AdminController.handleResetUserPassword('${student.email}')">🔑</button>
                <button class="btn-icon" title="รีเซ็ตสิทธิ์การสอบ" onclick="AdminController.handleResetAttempts('${student.email}')">🔄</button>
                <button class="btn-icon" title="สลับสถานะ" onclick="AdminController.toggleStudentStatus('${student.email}')">⚡</button>
                <button class="btn-icon text-red-500" title="ลบ" onclick="AdminController.handleDeleteStudent('${student.email}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    if (paginationEl) {
      paginationEl.innerHTML = `
        <div>แสดงรายการที่ ${startIdx + 1} - ${Math.min(startIdx + this.studentPageSize, totalCount)} จาก ${totalCount.toLocaleString()} คน</div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            ${this.studentPage <= 1 ? "disabled" : ""}
            onclick="AdminController.goToStudentPage(${this.studentPage - 1})"
          >
            ← หน้าก่อนหน้า
          </button>
          <span class="font-semibold">หน้า ${this.studentPage} / ${totalPages}</span>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            ${this.studentPage >= totalPages ? "disabled" : ""}
            onclick="AdminController.goToStudentPage(${this.studentPage + 1})"
          >
            หน้าถัดไป →
          </button>
        </div>
      `;
    }
  },

  goToStudentPage(page) {
    this.studentPage = Math.max(1, page);
    this.renderStudentsTable();
  },

  async handleResetUserPassword(username) {
    const newPwd = prompt(`🔑 กำหนดรหัสผ่านใหม่สำหรับบัญชี ${username} (อย่างน้อย 4 ตัวอักษร):`, "123456");
    if (newPwd === null) return;
    if (newPwd.trim().length < 4) {
      alert("⚠️ รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร");
      return;
    }
    const res = await DB.changePassword(username, "", newPwd.trim(), true);
    if (res.success) {
      await this.refreshData();
      alert(`✅ เปลี่ยนรหัสผ่านของ ${username} เป็น "${newPwd.trim()}" เรียบร้อยแล้ว`);
    } else {
      alert("❌ " + res.message);
    }
  },

  openEditStudent(email) {
    const student = this.cachedStudents.find((s) => (s.email || "").toLowerCase() === email.toLowerCase());
    if (!student) return;

    const modal = document.getElementById("studentModal");
    if (!modal) return;

    document.getElementById("formStudentId").value = student.student_id || "";
    const classNoEl = document.getElementById("formStudentClassNo");
    if (classNoEl) classNoEl.value = student.class_no || "";
    document.getElementById("formStudentName").value = student.name || "";
    document.getElementById("formStudentEmail").value = student.email || "";
    document.getElementById("formStudentEmail").readOnly = true;
    const pwdEl = document.getElementById("formStudentPassword");
    if (pwdEl) pwdEl.value = student.password || "123456";
    document.getElementById("formStudentGrade").value = student.grade || "ม.1";
    const roomEl = document.getElementById("formStudentRoom");
    if (roomEl) roomEl.value = student.room || "";
    document.getElementById("formStudentStatus").value = student.status || "active";
    document.getElementById("studentModalTitle").textContent = "แก้ไขข้อมูลนักเรียน";

    modal.classList.add("active");
  },

  openAddStudent() {
    const modal = document.getElementById("studentModal");
    if (!modal) return;

    document.getElementById("formStudentId").value = "";
    const classNoEl = document.getElementById("formStudentClassNo");
    if (classNoEl) classNoEl.value = "";
    document.getElementById("formStudentName").value = "";
    document.getElementById("formStudentEmail").value = "";
    document.getElementById("formStudentEmail").readOnly = false;
    const pwdEl = document.getElementById("formStudentPassword");
    if (pwdEl) pwdEl.value = "123456";
    document.getElementById("formStudentGrade").value = "ม.1";
    const roomEl = document.getElementById("formStudentRoom");
    if (roomEl) roomEl.value = "1";
    document.getElementById("formStudentStatus").value = "active";
    document.getElementById("studentModalTitle").textContent = "เพิ่มนักเรียนใหม่";

    modal.classList.add("active");
  },

  async handleSaveStudent() {
    const studentData = {
      student_id: document.getElementById("formStudentId").value.trim(),
      class_no: document.getElementById("formStudentClassNo")?.value.trim() || "",
      name: document.getElementById("formStudentName").value.trim(),
      email: document.getElementById("formStudentEmail").value.trim().toLowerCase(),
      username: document.getElementById("formStudentEmail").value.trim().toLowerCase(),
      password: document.getElementById("formStudentPassword")?.value.trim() || "123456",
      grade: document.getElementById("formStudentGrade").value,
      room: document.getElementById("formStudentRoom")?.value.trim() || "",
      status: document.getElementById("formStudentStatus").value
    };

    if (!studentData.email) {
      alert("⚠️ กรุณากรอก Username / อีเมล");
      return;
    }

    await DB.saveStudent(studentData);
    document.getElementById("studentModal").classList.remove("active");
    await this.refreshData();
    alert("บันทึกข้อมูลนักเรียนเรียบร้อยแล้ว");
  },

  async handleDeleteStudent(email) {
    if (confirm(`คุณต้องการลบนักเรียนบัญชี ${email} ใช่หรือไม่?`)) {
      await DB.deleteStudent(email);
      await this.refreshData();
    }
  },

  async handleResetAttempts(email) {
    if (confirm(`คุณต้องการรีเซ็ตสิทธิ์การทำแบบทดสอบ (Pre-test และ Post-test) ของ ${email} ให้สามารถสอบใหม่ได้ใช่หรือไม่?`)) {
      await DB.resetAttempts(email);
      await this.refreshData();
      alert("รีเซ็ตสิทธิ์การสอบเรียบร้อยแล้ว");
    }
  },

  async toggleStudentStatus(email) {
    const student = this.cachedStudents.find((s) => (s.email || "").toLowerCase() === email.toLowerCase());
    if (student) {
      const newStatus = student.status === "active" ? "suspended" : "active";
      await DB.saveStudent({ ...student, status: newStatus });
      await this.refreshData();
    }
  },

  // 3.5 เรนเดอร์ตารางจัดการผู้ดูแลระบบ (Admins Management)
  renderAdminsTable() {
    const tbody = document.getElementById("adminAdminsTableBody");
    if (!tbody) return;

    if (!this.cachedAdmins || this.cachedAdmins.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-6 text-slate-400">ไม่พบรายชื่อผู้ดูแลระบบ</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.cachedAdmins
      .map((adm, idx) => {
        const isProtected = adm.email.toLowerCase() === "winai@psuwit.ac.th";
        const isSuper = isProtected || adm.role === "super_admin";
        const roleBadge = isSuper
          ? `<span class="badge badge-warning font-bold">👑 Super Admin</span>`
          : `<span class="badge badge-primary">🛡️ Admin</span>`;

        const formattedDate = adm.created_at
          ? new Date(adm.created_at).toLocaleDateString("th-TH", { dateStyle: "medium" })
          : "-";

        const deleteBtn = isProtected
          ? `<span class="text-xs text-slate-400 font-semibold">สิทธิ์หลักถาวร</span>`
          : `<button class="btn btn-sm btn-secondary text-red-500" onclick="AdminController.handleDeleteAdmin('${adm.email}')">🗑️ ลบ</button>`;

        return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${adm.name || "-"}</strong></td>
            <td class="text-xs font-semibold text-indigo-700">${adm.username || adm.email}</td>
            <td class="text-center">${roleBadge}</td>
            <td class="text-center text-xs text-slate-500">${formattedDate}</td>
            <td class="text-center">
              <div class="flex items-center justify-center gap-2">
                <button class="btn btn-sm btn-secondary" onclick="AdminController.handleResetUserPassword('${adm.email}')">🔑 เปลี่ยนรหัสผ่าน</button>
                ${deleteBtn}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  },

  async handleAddAdmin() {
    const emailInput = document.getElementById("newAdminEmail").value.trim().toLowerCase();
    const nameInput = document.getElementById("newAdminName").value.trim();
    const pwdInput = document.getElementById("newAdminPassword")?.value.trim() || "123456";

    if (!emailInput) {
      alert("⚠️ กรุณากรอก Username / อีเมลของผู้ดูแลระบบ");
      return;
    }

    if (!nameInput) {
      alert("กรุณากรอกชื่อ - นามสกุลของผู้ดูแลระบบ");
      return;
    }

    await DB.saveAdmin({
      email: emailInput,
      username: emailInput,
      name: nameInput,
      password: pwdInput,
      role: emailInput === "winai@psuwit.ac.th" ? "super_admin" : "admin"
    });

    document.getElementById("newAdminEmail").value = "";
    document.getElementById("newAdminName").value = "";
    if (document.getElementById("newAdminPassword")) {
      document.getElementById("newAdminPassword").value = "123456";
    }
    await this.refreshData();
    alert(`✅ เพิ่มสิทธิ์ผู้ดูแลระบบให้กับ ${emailInput} เรียบร้อยแล้ว`);
  },

  async handleDeleteAdmin(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (cleanEmail === "winai@psuwit.ac.th") {
      alert("⚠️ ไม่สามารถลบผู้ดูแลระบบหลัก (winai@psuwit.ac.th) ได้");
      return;
    }

    if (!confirm(`คุณต้องการยกเลิกสิทธิ์ผู้ดูแลระบบของ ${cleanEmail} ใช่หรือไม่?`)) {
      return;
    }

    try {
      await DB.deleteAdmin(cleanEmail);
      await this.refreshData();
      alert(`🗑️ ลบสิทธิ์ผู้ดูแลระบบของ ${cleanEmail} เรียบร้อยแล้ว`);
    } catch (err) {
      alert("❌ " + err.message);
    }
  },

  // 4. หน้าจัดการฐานข้อมูล (Database System & Cloud Sync)
  async renderSettings() {
    const input = document.getElementById("settingsGasUrl");
    if (input) {
      input.value = DB.getGasUrl();
    }

    const dbStatus = await DB.getDatabaseStatus();
    const elEngine = document.getElementById("dbInfoEngine");
    const elFile = document.getElementById("dbInfoFile");
    const elStudentsCount = document.getElementById("dbInfoStudentsCount");
    const elAssessmentsCount = document.getElementById("dbInfoAssessmentsCount");
    const elBadge = document.getElementById("dbStatusBadge");

    if (elEngine) elEngine.textContent = dbStatus.engine;
    if (elFile) elFile.textContent = dbStatus.file;
    if (elStudentsCount) elStudentsCount.textContent = `${dbStatus.tables.students.toLocaleString()} รายการ`;
    if (elAssessmentsCount) elAssessmentsCount.textContent = `${dbStatus.tables.assessments.toLocaleString()} รายการ`;
    if (elBadge) {
      elBadge.textContent = dbStatus.mode === "server_sqlite"
        ? "SQLite Server Active"
        : "IndexedDB Browser Active";
    }
  },

  async handleImportDatabase(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await DB.importDatabaseJSON(json);
      await this.refreshData();
      alert("✅ นำเข้าและอัปเดตฐานข้อมูลเรียบร้อยแล้ว");
    } catch (err) {
      alert("❌ ไฟล์ฐานข้อมูล (.json) ไม่ถูกต้อง: " + err.message);
    } finally {
      event.target.value = "";
    }
  },

  async handleResetSeedDatabase() {
    if (!confirm("⚠️ คุณต้องการรีเซ็ตฐานข้อมูลทั้งหมดกลับเป็นข้อมูลเริ่มต้นจาก user.xlsx (นักเรียน 1,465 คน + ผู้ดูแล 3 คน) ใช่หรือไม่?")) {
      return;
    }
    await DB.resetDatabaseToSeed();
    await this.refreshData();
    alert("🔄 รีเซ็ตฐานข้อมูลกลับสู่ค่าเริ่มต้นจาก user.xlsx เรียบร้อยแล้ว");
  },

  async handleTestGasConnection() {
    const url = document.getElementById("settingsGasUrl").value.trim();
    const statusEl = document.getElementById("gasStatusFeedback");
    if (statusEl) {
      statusEl.textContent = "⏳ กำลังทดสอบการเชื่อมต่อ...";
      statusEl.className = "text-sm text-blue-500 font-semibold";
    }

    const res = await DB.testConnection(url);
    if (statusEl) {
      statusEl.textContent = res.success ? `✅ ${res.message}` : `❌ ${res.message}`;
      statusEl.className = `text-sm font-semibold ${res.success ? "text-emerald-600" : "text-red-500"}`;
    }
  },

  handleSaveGasUrl() {
    const url = document.getElementById("settingsGasUrl").value.trim();
    DB.setGasUrl(url);
    alert("บันทึกการตั้งค่า Web App URL เรียบร้อยแล้ว ระบบจะซิงก์กับ Google Sheets");
    this.refreshData();
  },

  // 5. ส่งออกไฟล์ CSV แยกตามระดับชั้น พร้อม UTF-8 BOM สำหรับเปิดใน Excel ภาษาไทยไม่เพี้ยน
  exportAssessmentsCSV() {
    let list = [...this.cachedAssessments];
    const grade = this.currentFilterGrade;

    if (grade !== "all") {
      list = list.filter((a) => a.grade === grade);
    }

    if (list.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งออกตามเงื่อนไขที่เลือก");
      return;
    }

    const headers = [
      "รหัสการทดสอบ",
      "รหัสนักเรียน",
      "ชื่อ-นามสกุล",
      "Username",
      "ระดับชั้น",
      "ประเภทแบบทดสอบ",
      "คะแนนที่ได้",
      "คะแนนเต็ม",
      "เปอร์เซ็นต์ (%)",
      "การรู้เท่าทันดิจิทัล (D1)",
      "ฮาร์ดแวร์และเครือข่าย (D2)",
      "การคิดเชิงคำนวณและโค้ด (D3)",
      "การจัดการข้อมูล (D4)",
      "ความมั่นคงไซเบอร์ (D5)",
      "AI และเทคโนโลยีใหม่ (D6)",
      "เวลาที่ใช้ (วินาที)",
      "จำนวนครั้งที่สลับหน้าต่าง",
      "ผลการผ่านเกณฑ์",
      "วันเวลาที่ส่ง"
    ];

    const rows = list.map((a) => [
      `"${a.test_id || ""}"`,
      `"${a.student_id || ""}"`,
      `"${a.student_name || ""}"`,
      `"${a.email || ""}"`,
      `"${a.grade || ""}"`,
      `"${a.test_type || ""}"`,
      a.score_total || 0,
      a.max_score || 0,
      a.score_percent || 0,
      a.domain_scores?.D1 || 0,
      a.domain_scores?.D2 || 0,
      a.domain_scores?.D3 || 0,
      a.domain_scores?.D4 || 0,
      a.domain_scores?.D5 || 0,
      a.domain_scores?.D6 || 0,
      a.time_spent_seconds || 0,
      a.violations_count || 0,
      a.passed ? "ผ่านเกณฑ์" : "ต้องพัฒนา",
      `"${a.submitted_at || ""}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const gradeName = grade === "all" ? "All_Grades" : grade.replace(/\s+/g, "");
    link.setAttribute("href", url);
    link.setAttribute("download", `IT_Assessment_Report_${gradeName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

if (typeof window !== "undefined") {
  window.AdminController = AdminController;
}
