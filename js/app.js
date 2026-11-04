/**
 * แอปพลิเคชันหลักและการควบคุมการเปลี่ยนหน้า (Main App & State Controller)
 * จัดการกระบวนการเข้าสู่ระบบด้วย Username & Password (จากฐานข้อมูล user.xlsx),
 * การเปลี่ยนรหัสผ่านด้วยตนเองของทุกคน และการนำทางระหว่างหน้าจอ
 */

const App = {
  currentUser: null,       // { student_id, class_no, name, email, username, grade, room, role }
  currentSession: null,    // Instance ของ AssessmentSession
  currentResult: null,     // ผลการสอบล่าสุด
  activeView: "view-auth",

  async init() {
    this.bindGlobalEvents();
    await this.checkSession();
  },

  bindGlobalEvents() {
    // สลับแท็บในหน้าเข้าสู่ระบบ (Student / Admin)
    document.querySelectorAll(".auth-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const role = e.currentTarget.dataset.role;
        document.querySelectorAll(".auth-tab-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        const studentContainer = document.getElementById("studentLoginContainer");
        if (studentContainer) {
          studentContainer.classList.toggle("hidden", role !== "student");
        }
        const adminForm = document.getElementById("adminLoginForm");
        if (adminForm) {
          adminForm.classList.toggle("hidden", role !== "admin");
        }
      });
    });

    // ฟอร์มเข้าสู่ระบบสำหรับนักเรียน (Username & Password)
    const studentLoginForm = document.getElementById("studentCredentialsForm");
    if (studentLoginForm) {
      studentLoginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleStudentCredentialsLogin();
      });
    }

    // ฟอร์มเข้าสู่ระบบสำหรับผู้ดูแลระบบ (Username & Password)
    const adminLoginForm = document.getElementById("adminCredentialsForm");
    if (adminLoginForm) {
      adminLoginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAdminCredentialsLogin();
      });
    }

    // ฟอร์มแก้ไขรหัสผ่านด้วยตนเอง (สำหรับทุกคน)
    const changePwdForm = document.getElementById("changePasswordForm");
    if (changePwdForm) {
      changePwdForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleChangePasswordSubmit();
      });
    }

    // ปุ่มลิงก์เข้าสู่หน้าผู้ดูแลระบบบน Header (แสดงเฉพาะอีเมลที่มีสิทธิ์ Admin)
    const headerAdminBtn = document.getElementById("btnHeaderAdminLink");
    if (headerAdminBtn) {
      headerAdminBtn.addEventListener("click", async () => {
        if (!this.currentUser) return;
        const adminRecord = await DB.findAdmin(this.currentUser.email || this.currentUser.username);
        if (!adminRecord) {
          alert("🚫 เฉพาะบัญชีผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น");
          return;
        }
        this.switchView("view-admin");
        AdminController.init();
      });
    }

    // ปุ่มออกจากระบบ
    document.querySelectorAll(".btn-logout").forEach((btn) => {
      btn.addEventListener("click", () => this.logout());
    });

    // ปุ่มเริ่มทำแบบทดสอบ
    const startPreBtn = document.getElementById("btnStartPretest");
    if (startPreBtn) {
      startPreBtn.addEventListener("click", () => this.startAssessment("Pre-test"));
    }

    const startPostBtn = document.getElementById("btnStartPosttest");
    if (startPostBtn) {
      startPostBtn.addEventListener("click", () => this.startAssessment("Post-test"));
    }

    // ปุ่มส่งคำตอบในหน้าสอบ
    const submitBtn = document.getElementById("btnSubmitAssessment");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const answered = this.currentSession.getAnsweredCount();
        const total = this.currentSession.getTotalQuestions();
        if (answered < total) {
          if (!confirm(`คุณตอบไปแล้ว ${answered}/${total} ข้อ ยังมีข้อที่ยังไม่ได้ตอบ ต้องการยืนยันส่งข้อสอบหรือไม่?`)) {
            return;
          }
        } else {
          if (!confirm("คุณต้องการส่งแบบทดสอบเพื่อบันทึกผลและดูคะแนนใช่หรือไม่?")) {
            return;
          }
        }
        this.currentSession.submit();
      });
    }

    // ปุ่มดาวน์โหลดเกียรติบัตรในหน้ารายงานผล
    const downloadCertBtn = document.getElementById("btnDownloadCertificate");
    if (downloadCertBtn) {
      downloadCertBtn.addEventListener("click", () => {
        if (this.currentResult) {
          CertificateEngine.downloadCertificatePDF(this.currentResult);
        }
      });
    }

    // ปุ่มกลับหน้าหลักนักเรียน
    const backPortalBtn = document.getElementById("btnBackToPortal");
    if (backPortalBtn) {
      backPortalBtn.addEventListener("click", () => {
        this.switchView("view-student-portal");
        this.renderStudentPortal();
      });
    }
  },

  // สลับการแสดง/ซ่อนรหัสผ่านในช่อง Input
  togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      if (btnEl) btnEl.textContent = "🙈 ซ่อน";
    } else {
      input.type = "password";
      if (btnEl) btnEl.textContent = "👁️ แสดง";
    }
  },

  // ตรวจสอบเซสชันเดิมที่เคยเข้าสู่ระบบไว้
  async checkSession() {
    const rawUser = localStorage.getItem(APP_CONFIG.storageKeys.currentUser);
    if (rawUser) {
      try {
        this.currentUser = JSON.parse(rawUser);
        if (this.currentUser.role === "admin") {
          const adminRecord = await DB.findAdmin(this.currentUser.email || this.currentUser.username);
          if (!adminRecord) {
            this.currentUser = null;
            localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
            this.switchView("view-auth");
            return;
          }
          this.switchView("view-admin");
          AdminController.init();
        } else {
          this.switchView("view-student-portal");
          this.renderStudentPortal();
        }
        return;
      } catch (e) {
        localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
      }
    }
    this.switchView("view-auth");
  },

  // สลับการแสดงผล View
  async switchView(viewId) {
    this.activeView = viewId;
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === viewId);
    });

    const userBadge = document.getElementById("headerUserBadge");
    const headerAdminBtn = document.getElementById("btnHeaderAdminLink");
    if (this.currentUser && viewId !== "view-auth") {
      if (userBadge) {
        userBadge.classList.remove("hidden");
        document.getElementById("headerUserName").textContent = this.currentUser.name || this.currentUser.username || this.currentUser.email;
        const roomLabel = this.currentUser.room && this.currentUser.room !== "-" ? `/${this.currentUser.room}` : "";
        document.getElementById("headerUserRole").textContent =
          this.currentUser.role === "admin"
            ? `ผู้ดูแลระบบ (${this.currentUser.username || this.currentUser.email})`
            : `${this.currentUser.grade || ""}${roomLabel} (${this.currentUser.student_id || ""})`;
      }
      if (headerAdminBtn) {
        const isAdmin = await DB.findAdmin(this.currentUser.email || this.currentUser.username);
        headerAdminBtn.classList.toggle("hidden", !isAdmin || viewId === "view-admin");
      }
    } else {
      if (userBadge) userBadge.classList.add("hidden");
      if (headerAdminBtn) headerAdminBtn.classList.add("hidden");
    }
  },

  // ล็อกอินฝั่งนักเรียนด้วย Username และ Password
  async handleStudentCredentialsLogin() {
    const usernameInput = document.getElementById("loginStudentUsername").value.trim();
    const passwordInput = document.getElementById("loginStudentPassword").value;
    const errBanner = document.getElementById("studentAuthErrorBanner");
    if (errBanner) errBanner.classList.add("hidden");

    const res = await DB.authenticateUser(usernameInput, passwordInput, "student");
    if (!res.success) {
      if (errBanner) {
        errBanner.textContent = res.message;
        errBanner.classList.remove("hidden");
      } else {
        alert(res.message);
      }
      return;
    }

    this.currentUser = res.user;
    localStorage.setItem(APP_CONFIG.storageKeys.currentUser, JSON.stringify(this.currentUser));
    document.getElementById("loginStudentPassword").value = "";

    if (this.currentUser.role === "admin") {
      this.switchView("view-admin");
      AdminController.init();
    } else {
      this.switchView("view-student-portal");
      this.renderStudentPortal();
    }
  },

  // ล็อกอินฝั่งผู้ดูแลระบบด้วย Username และ Password
  async handleAdminCredentialsLogin() {
    const usernameInput = document.getElementById("loginAdminUsername").value.trim();
    const passwordInput = document.getElementById("loginAdminPassword").value;
    const errBanner = document.getElementById("adminAuthErrorBanner");
    if (errBanner) errBanner.classList.add("hidden");

    const res = await DB.authenticateUser(usernameInput, passwordInput, "admin");
    if (!res.success) {
      if (errBanner) {
        errBanner.textContent = res.message;
        errBanner.classList.remove("hidden");
      } else {
        alert(res.message);
      }
      return;
    }

    this.currentUser = res.user;
    localStorage.setItem(APP_CONFIG.storageKeys.currentUser, JSON.stringify(this.currentUser));
    document.getElementById("loginAdminPassword").value = "";

    this.switchView("view-admin");
    AdminController.init();
  },

  // เปิดหน้าต่างแก้ไขรหัสผ่านของตนเอง (ใช้งานได้ทั้งก่อนล็อกอินและหลังล็อกอิน)
  openChangePasswordModal(prefillUsername = "") {
    const modal = document.getElementById("changePasswordModal");
    if (!modal) return;

    const unameInput = document.getElementById("changePwdUsername");
    const curInput = document.getElementById("changePwdCurrent");
    const newInput = document.getElementById("changePwdNew");
    const confInput = document.getElementById("changePwdConfirm");
    const feedback = document.getElementById("changePwdFeedback");

    if (feedback) feedback.classList.add("hidden");
    if (curInput) curInput.value = "";
    if (newInput) newInput.value = "";
    if (confInput) confInput.value = "";

    if (this.currentUser) {
      unameInput.value = this.currentUser.username || this.currentUser.email || "";
      unameInput.readOnly = true;
    } else {
      const typedStudent = document.getElementById("loginStudentUsername")?.value.trim() || "";
      const typedAdmin = document.getElementById("loginAdminUsername")?.value.trim() || "";
      unameInput.value = prefillUsername || typedStudent || typedAdmin || "";
      unameInput.readOnly = false;
    }

    modal.classList.add("active");
    setTimeout(() => {
      if (unameInput.value) {
        curInput.focus();
      } else {
        unameInput.focus();
      }
    }, 100);
  },

  closeChangePasswordModal() {
    const modal = document.getElementById("changePasswordModal");
    if (modal) modal.classList.remove("active");
  },

  // บันทึกการเปลี่ยนรหัสผ่านของตนเอง
  async handleChangePasswordSubmit() {
    const username = document.getElementById("changePwdUsername").value.trim();
    const currentPwd = document.getElementById("changePwdCurrent").value;
    const newPwd = document.getElementById("changePwdNew").value.trim();
    const confirmPwd = document.getElementById("changePwdConfirm").value.trim();
    const feedback = document.getElementById("changePwdFeedback");

    const showMsg = (msg, isSuccess = false) => {
      if (!feedback) {
        alert(msg);
        return;
      }
      feedback.textContent = msg;
      feedback.className = isSuccess
        ? "p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold"
        : "p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold";
      feedback.classList.remove("hidden");
    };

    if (!username || !currentPwd || !newPwd || !confirmPwd) {
      showMsg("⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (newPwd.length < 4) {
      showMsg("⚠️ รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร");
      return;
    }

    if (newPwd !== confirmPwd) {
      showMsg("❌ รหัสผ่านใหม่และการยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    const res = await DB.changePassword(username, currentPwd, newPwd, false);
    if (!res.success) {
      showMsg(res.message, false);
      return;
    }

    showMsg(res.message || "✅ เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว!", true);
    document.getElementById("changePwdCurrent").value = "";
    document.getElementById("changePwdNew").value = "";
    document.getElementById("changePwdConfirm").value = "";

    setTimeout(() => {
      this.closeChangePasswordModal();
    }, 1200);
  },

  // ออกจากระบบ
  logout() {
    if (this.currentSession && !this.currentSession.isSubmitted) {
      if (!confirm("ขณะนี้กำลังอยู่ในระหว่างการสอบ หากออกจากระบบการสอบจะสิ้นสุดทันที ต้องการออกหรือไม่?")) {
        return;
      }
      this.currentSession.detachAntiCheatListeners();
    }
    this.currentUser = null;
    this.currentSession = null;
    localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
    this.switchView("view-auth");
  },

  // เรนเดอร์หน้าพอร์ทัลของนักเรียน
  async renderStudentPortal() {
    if (!this.currentUser) return;

    document.getElementById("portalStudentName").textContent = this.currentUser.name;
    document.getElementById("portalStudentEmail").textContent = this.currentUser.username || this.currentUser.email;
    const roomPart = this.currentUser.room ? `/${this.currentUser.room}` : "";
    const noPart = this.currentUser.class_no ? ` (เลขที่ ${this.currentUser.class_no})` : "";
    document.getElementById("portalStudentGrade").textContent = `${this.currentUser.grade}${roomPart}${noPart}`;
    document.getElementById("portalStudentId").textContent = this.currentUser.student_id || "-";

    // ดึงประวัติการสอบของนักเรียน
    const history = await DB.getStudentHistory(this.currentUser.email || this.currentUser.username);
    const preTest = history.find((h) => h.test_type === "Pre-test");
    const postTest = history.find((h) => h.test_type === "Post-test");

    // อัปเดตการ์ดสถานะ Pre-test
    const preStatusBadge = document.getElementById("portalPreStatusBadge");
    const preScoreText = document.getElementById("portalPreScoreText");
    const btnStartPre = document.getElementById("btnStartPretest");

    if (preTest) {
      preStatusBadge.innerHTML = `<span class="badge badge-success">ทำเสร็จแล้ว</span>`;
      preScoreText.textContent = `${preTest.score_total}/${preTest.max_score} (${preTest.score_percent}%)`;
      btnStartPre.textContent = "🔍 ดูผลคะแนน Pre-test";
      btnStartPre.onclick = () => this.showPastResult(preTest, postTest);

      let retakePreBtn = document.getElementById("btnRetakePretest");
      if (!retakePreBtn) {
        retakePreBtn = document.createElement("button");
        retakePreBtn.id = "btnRetakePretest";
        retakePreBtn.className = "btn btn-secondary btn-sm mt-2";
        retakePreBtn.style.width = "100%";
        retakePreBtn.textContent = "🔄 ทำแบบทดสอบ Pre-test อีกครั้ง";
        retakePreBtn.onclick = () => this.startAssessment("Pre-test");
        btnStartPre.parentNode.appendChild(retakePreBtn);
      }
    } else {
      preStatusBadge.innerHTML = `<span class="badge badge-warning">ยังไม่ได้ทำ</span>`;
      preScoreText.textContent = "ยังไม่มีคะแนน";
      btnStartPre.textContent = "🚀 เริ่มทำแบบทดสอบก่อนเรียน (Pre-test)";
      btnStartPre.onclick = () => this.startAssessment("Pre-test");
      const retakePreBtn = document.getElementById("btnRetakePretest");
      if (retakePreBtn) retakePreBtn.remove();
    }

    // อัปเดตการ์ดสถานะ Post-test
    const postStatusBadge = document.getElementById("portalPostStatusBadge");
    const postScoreText = document.getElementById("portalPostScoreText");
    const btnStartPost = document.getElementById("btnStartPosttest");

    if (postTest) {
      postStatusBadge.innerHTML = `<span class="badge badge-success">ทำเสร็จแล้ว</span>`;
      postScoreText.textContent = `${postTest.score_total}/${postTest.max_score} (${postTest.score_percent}%)`;
      btnStartPost.textContent = "🔍 ดูผลและดาวน์โหลดเกียรติบัตร";
      btnStartPost.onclick = () => this.showPastResult(postTest, preTest);

      let retakePostBtn = document.getElementById("btnRetakePosttest");
      if (!retakePostBtn) {
        retakePostBtn = document.createElement("button");
        retakePostBtn.id = "btnRetakePosttest";
        retakePostBtn.className = "btn btn-secondary btn-sm mt-2";
        retakePostBtn.style.width = "100%";
        retakePostBtn.textContent = "🔄 ทำแบบทดสอบ Post-test อีกครั้ง";
        retakePostBtn.onclick = () => this.startAssessment("Post-test");
        btnStartPost.parentNode.appendChild(retakePostBtn);
      }
    } else {
      postStatusBadge.innerHTML = `<span class="badge badge-secondary">รอทำหลังเรียน</span>`;
      postScoreText.textContent = "ยังไม่มีคะแนน";
      btnStartPost.textContent = "🎯 เริ่มทำแบบทดสอบหลังเรียน (Post-test)";
      btnStartPost.onclick = () => this.startAssessment("Post-test");
      const retakePostBtn = document.getElementById("btnRetakePosttest");
      if (retakePostBtn) retakePostBtn.remove();
    }

    // แสดงกราฟเปรียบเทียบในหน้าพอร์ทัล หากเคยสอบแล้ว
    const historyContainer = document.getElementById("portalHistorySection");
    if (preTest || postTest) {
      historyContainer.classList.remove("hidden");
      setTimeout(() => {
        AssessmentCharts.renderRadarChart("portalRadarChartCanvas", postTest || preTest, postTest ? preTest : null);
      }, 100);
    } else {
      historyContainer.classList.add("hidden");
    }
  },

  // เริ่มต้นเข้าสู่ห้องสอบ
  startAssessment(testType) {
    if (!this.currentUser) return;

    if (!confirm(`คุณกำลังจะเริ่มทำแบบทดสอบ ${testType} สำหรับระดับชั้น ${this.currentUser.grade}\n\n⚠️ กฎการสอบสำคัญ:\n1. มีการจับเวลา 15 นาที (จำนวน 15 ข้อ คะแนนเต็ม 75 คะแนน)\n2. ห้ามสลับหน้าต่างหรือแท็บเบราว์เซอร์เด็ดขาด (เตือนได้สูงสุด 3 ครั้ง)\n3. ข้อสอบและตัวเลือกจะถูกสลับลำดับอัตโนมัติ\n\nพร้อมแล้วกด ตกลง เพื่อเริ่มสอบ`)) {
      return;
    }

    this.currentSession = new AssessmentSession({
      student: this.currentUser,
      grade: this.currentUser.grade,
      testType: testType,
      durationMinutes: APP_CONFIG.testDurationMinutes,
      onTick: (data) => {
        const timerEl = document.getElementById("examTimerDisplay");
        const progressEl = document.getElementById("examTimeProgress");
        if (timerEl) {
          timerEl.textContent = data.formatted;
          if (data.remaining <= 120) {
            timerEl.classList.add("text-danger-pulse");
          } else {
            timerEl.classList.remove("text-danger-pulse");
          }
        }
        if (progressEl) {
          progressEl.style.width = `${data.percent}%`;
        }
      },
      onViolation: (data) => {
        const violationBanner = document.getElementById("examViolationBanner");
        if (violationBanner) {
          violationBanner.classList.remove("hidden");
          violationBanner.innerHTML = `
            <div>
              🚨 คำเตือนความปลอดภัย (ครั้งที่ <strong>${data.violationsCount} / ${data.maxViolations}</strong>): ${data.reason}
            </div>
            <div class="text-xs mt-1">หากตรวจพบครบ ${data.maxViolations} ครั้ง ระบบจะส่งข้อสอบและยุติการสอบทันที!</div>
          `;
          violationBanner.style.animation = "none";
          setTimeout(() => {
            violationBanner.style.animation = "pulse 1s infinite";
          }, 10);
        }
      },
      onSubmit: async (result) => {
        await this.handleAssessmentSubmission(result);
      }
    });

    this.switchView("view-assessment");
    this.renderAssessmentView();
    setTimeout(() => {
      if (this.currentSession && !this.currentSession.isSubmitted) {
        this.currentSession.start();
      }
    }, 600);
  },

  // เรนเดอร์หน้าจอทำข้อสอบ
  renderAssessmentView() {
    const session = this.currentSession;
    document.getElementById("examHeaderTitle").textContent = `แบบทดสอบสมรรถนะ IT (${session.testType}) - ระดับชั้น ${session.grade}`;
    document.getElementById("examViolationBanner").classList.add("hidden");

    this.renderQuestionList();
    this.renderCurrentQuestion();
  },

  // เรนเดอร์แถบเลขข้อด้านข้าง/ด้านบน
  renderQuestionList() {
    const navContainer = document.getElementById("examQuestionNav");
    if (!navContainer) return;

    navContainer.innerHTML = this.currentSession.questions
      .map((q, idx) => {
        const isAnswered = this.currentSession.getAnswer(q.id) !== undefined;
        const isCurrent = idx === this.currentSession.currentQuestionIndex;
        let cls = "q-nav-btn";
        if (isCurrent) cls += " current";
        if (isAnswered) cls += " answered";

        return `<button class="${cls}" onclick="App.goToQuestion(${idx})">${idx + 1}</button>`;
      })
      .join("");
  },

  goToQuestion(index) {
    if (index >= 0 && index < this.currentSession.questions.length) {
      this.currentSession.currentQuestionIndex = index;
      this.renderCurrentQuestion();
      this.renderQuestionList();
    }
  },

  // เรนเดอร์ข้อสอบปัจจุบัน
  renderCurrentQuestion() {
    const session = this.currentSession;
    const qIndex = session.currentQuestionIndex;
    const q = session.questions[qIndex];
    if (!q) return;

    const domainInfo = IT_DOMAINS[q.domain] || { thai: "สมรรถนะ IT", color: "#4F46E5" };
    const container = document.getElementById("examCurrentQuestionCard");

    const chosenScore = session.getAnswer(q.id);

    container.innerHTML = `
      <div class="q-header flex justify-between items-center mb-4">
        <span class="q-number text-lg font-bold text-slate-800">คำถามข้อที่ ${qIndex + 1} จาก ${session.questions.length}</span>
        <span class="badge" style="background-color: ${domainInfo.color}20; color: ${domainInfo.color}; border: 1px solid ${domainInfo.color};">
          ${domainInfo.thai} (${q.domain})
        </span>
      </div>

      <div class="q-text text-xl font-medium text-slate-900 mb-6 leading-relaxed">
        ${q.question}
      </div>

      <div class="q-options space-y-3">
        ${q.options
          .map((opt, optIdx) => {
            const isChecked = chosenScore === opt.score;
            const letters = ["ก", "ข", "ค", "ง", "จ"];
            return `
              <label class="option-card ${isChecked ? "selected" : ""}" onclick="App.selectOption('${q.id}', ${opt.score})">
                <input type="radio" name="opt_${q.id}" ${isChecked ? "checked" : ""} class="hidden">
                <span class="option-letter font-bold mr-3">${letters[optIdx]}.</span>
                <span class="option-text flex-1">${opt.text}</span>
                <span class="option-check">${isChecked ? "✓" : ""}</span>
              </label>
            `;
          })
          .join("")}
      </div>

      <div class="q-footer flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
        <button class="btn btn-secondary ${qIndex === 0 ? "invisible" : ""}" onclick="App.goToQuestion(${qIndex - 1})">
          ← ข้อก่อนหน้า
        </button>
        <span class="text-sm text-slate-500">ตอบแล้ว ${session.getAnsweredCount()} / ${session.questions.length} ข้อ</span>
        ${
          qIndex === session.questions.length - 1
            ? `<button class="btn btn-primary" onclick="document.getElementById('btnSubmitAssessment').click()">ตรวจทานและส่งคำตอบ 🚀</button>`
            : `<button class="btn btn-primary" onclick="App.goToQuestion(${qIndex + 1})">ข้อถัดไป →</button>`
        }
      </div>
    `;
  },

  selectOption(questionId, score) {
    this.currentSession.selectAnswer(questionId, score);
    this.renderCurrentQuestion();
    this.renderQuestionList();
  },

  // เมื่อส่งแบบทดสอบสำเร็จ
  async handleAssessmentSubmission(result) {
    const saved = await DB.saveAssessment(result);
    this.currentResult = saved;

    const history = await DB.getStudentHistory(this.currentUser.email || this.currentUser.username);
    const otherTest = history.find((h) => h.test_id !== saved.test_id);

    this.switchView("view-results");
    this.renderResultsView(saved, otherTest);
  },

  // เรนเดอร์หน้ารายงานผลสอบและเกียรติบัตร
  renderResultsView(result, previousResult = null) {
    document.getElementById("resStudentName").textContent = result.student_name;
    document.getElementById("resStudentGrade").textContent = result.grade;
    document.getElementById("resTestType").textContent = result.test_type;
    document.getElementById("resTotalScore").textContent = `${result.score_total} / ${result.max_score}`;
    document.getElementById("resPercentScore").textContent = `${result.score_percent}%`;

    const level = CertificateEngine.getProficiencyLevel(result.score_percent);
    document.getElementById("resLevelText").textContent = level;

    const certCard = document.getElementById("resultCertificateCard");
    const certNotice = document.getElementById("resultCertificateNotice");

    if (result.passed) {
      if (certCard) certCard.classList.remove("hidden");
      if (certNotice) certNotice.classList.add("hidden");

      const previewCanvas = document.getElementById("certificatePreviewCanvas");
      if (previewCanvas) {
        CertificateEngine.drawCertificateCanvas(result, previewCanvas);
      }
    } else {
      if (certCard) certCard.classList.add("hidden");
      if (certNotice) {
        certNotice.classList.remove("hidden");
        certNotice.innerHTML = `
          <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            💡 คะแนนการทดสอบอยู่ที่ <strong>${result.score_percent}%</strong> (เกณฑ์รับเกียรติบัตรคือ ${APP_CONFIG.certificatePassingPercent}% ขึ้นไป)
            คุณสามารถทบทวนเนื้อหาและติดต่อครูผู้สอนเพื่อขอสอบใหม่ได้
          </div>
        `;
      }
    }

    const domainCardsContainer = document.getElementById("resultDomainCardsContainer");
    if (domainCardsContainer) {
      domainCardsContainer.innerHTML = Object.keys(IT_DOMAINS)
        .map((domKey) => {
          const dom = IT_DOMAINS[domKey];
          const score = result.domain_scores ? result.domain_scores[domKey] || 0 : 0;
          return `
            <div class="domain-card p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold px-2 py-1 rounded" style="background: ${dom.color}15; color: ${dom.color};">
                  ${domKey}
                </span>
                <span class="text-sm font-bold text-slate-800">${score}%</span>
              </div>
              <div class="text-sm font-semibold text-slate-800 truncate mb-2">${dom.thai}</div>
              <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="h-2 rounded-full" style="width: ${score}%; background-color: ${dom.color};"></div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    setTimeout(() => {
      AssessmentCharts.renderRadarChart("resultRadarChartCanvas", result, previousResult);
    }, 150);
  },

  showPastResult(result, otherTest = null) {
    this.currentResult = result;
    this.switchView("view-results");
    this.renderResultsView(result, otherTest);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

if (typeof window !== "undefined") {
  window.App = App;
}
