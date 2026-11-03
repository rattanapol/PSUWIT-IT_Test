/**
 * แอปพลิเคชันหลักและการควบคุมการเปลี่ยนหน้า (Main App & State Controller)
 * จัดการกระบวนการเข้าสู่ระบบ, การตรวจสอบอีเมล @psuwit.ac.th, และการนำทางระหว่างหน้าจอ
 */

const App = {
  currentUser: null,       // { student_id, name, email, grade, role }
  currentSession: null,    // Instance ของ AssessmentSession
  currentResult: null,     // ผลการสอบล่าสุด
  activeView: "view-auth",

  async init() {
    this.bindGlobalEvents();
    this.checkSession();
  },

  bindGlobalEvents() {
    // สลับแท็บในหน้าเข้าสู่ระบบ (Student / Admin)
    document.querySelectorAll(".auth-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const role = e.currentTarget.dataset.role;
        document.querySelectorAll(".auth-tab-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        document.getElementById("studentLoginForm").classList.toggle("hidden", role !== "student");
        document.getElementById("adminLoginForm").classList.toggle("hidden", role !== "admin");
      });
    });

    // ฟอร์มเข้าสู่ระบบของนักเรียน
    const studentForm = document.getElementById("studentLoginForm");
    if (studentForm) {
      studentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleStudentLogin();
      });
    }

    // ฟอร์มเข้าสู่ระบบของแอดมิน
    const adminForm = document.getElementById("adminLoginForm");
    if (adminForm) {
      adminForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAdminLogin();
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

  // ตรวจสอบเซสชันเดิมที่เคยเข้าสู่ระบบไว้
  checkSession() {
    const rawUser = localStorage.getItem(APP_CONFIG.storageKeys.currentUser);
    if (rawUser) {
      try {
        this.currentUser = JSON.parse(rawUser);
        if (this.currentUser.role === "admin") {
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
  switchView(viewId) {
    this.activeView = viewId;
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === viewId);
    });

    // ปรับ Header ผู้ใช้งาน
    const userBadge = document.getElementById("headerUserBadge");
    if (this.currentUser && viewId !== "view-auth") {
      if (userBadge) {
        userBadge.classList.remove("hidden");
        document.getElementById("headerUserName").textContent = this.currentUser.name || this.currentUser.email;
        document.getElementById("headerUserRole").textContent = this.currentUser.role === "admin" ? "ผู้ดูแลระบบ (Admin)" : `${this.currentUser.grade || ""}`;
      }
    } else {
      if (userBadge) userBadge.classList.add("hidden");
    }
  },

  // เข้าสู่ระบบนักเรียน
  async handleStudentLogin() {
    const emailInput = document.getElementById("loginStudentEmail").value.trim().toLowerCase();
    const nameInput = document.getElementById("loginStudentName").value.trim();
    const gradeInput = document.getElementById("loginStudentGrade").value;

    // ตรวจสอบรูปแบบอีเมลโรงเรียน
    if (!APP_CONFIG.emailRegex.test(emailInput)) {
      alert("⚠️ รูปแบบอีเมลไม่ถูกต้อง! ต้องลงท้ายด้วย @psuwit.ac.th เท่านั้น\nตัวอย่าง: s641001@psuwit.ac.th หรือ somchai@psuwit.ac.th");
      return;
    }

    if (!nameInput) {
      alert("กรุณากรอกชื่อ-นามสกุลของนักเรียน");
      return;
    }

    // ดึงรหัสนักเรียนจากอีเมล (หากขึ้นต้นด้วย s และตามด้วยตัวเลข เช่น s641001)
    let extractedId = "";
    const match = emailInput.match(/^([sS]?[0-9]{5,8})@/);
    if (match) {
      extractedId = match[1];
    }

    // ตรวจสอบในฐานข้อมูลว่ามีอยู่แล้วหรือไม่
    const students = await DB.getStudents();
    let existing = students.find((s) => s.email.toLowerCase() === emailInput);

    if (existing && existing.status === "suspended") {
      alert("บัญชีของคุณถูกระงับการเข้าถึงชั่วคราว กรุณาติดต่อครูผู้สอนหรือผู้ดูแลระบบ");
      return;
    }

    const studentRecord = {
      student_id: (existing && existing.student_id) || extractedId || `ID-${Date.now().toString().slice(-4)}`,
      name: nameInput,
      email: emailInput,
      grade: gradeInput,
      role: "student",
      status: "active"
    };

    // บันทึก/อัปเดตลงฐานข้อมูล
    await DB.saveStudent(studentRecord);

    this.currentUser = studentRecord;
    localStorage.setItem(APP_CONFIG.storageKeys.currentUser, JSON.stringify(studentRecord));

    this.switchView("view-student-portal");
    this.renderStudentPortal();
  },

  // เข้าสู่ระบบแอดมิน
  handleAdminLogin() {
    const passcode = document.getElementById("loginAdminPasscode").value;
    if (passcode === APP_CONFIG.defaultAdminPasscode) {
      this.currentUser = {
        name: "อาจารย์ผู้ดูแลระบบ IT",
        email: "admin@psuwit.ac.th",
        role: "admin"
      };
      localStorage.setItem(APP_CONFIG.storageKeys.currentUser, JSON.stringify(this.currentUser));
      this.switchView("view-admin");
      AdminController.init();
    } else {
      alert("รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง (รหัสเริ่มต้นสำหรับการทดสอบ: " + APP_CONFIG.defaultAdminPasscode + ")");
    }
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
    document.getElementById("portalStudentEmail").textContent = this.currentUser.email;
    document.getElementById("portalStudentGrade").textContent = this.currentUser.grade;
    document.getElementById("portalStudentId").textContent = this.currentUser.student_id || "-";

    // ดึงประวัติการสอบของนักเรียน
    const history = await DB.getStudentHistory(this.currentUser.email);
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

      // เพิ่มปุ่มสอบใหม่หากต้องการ
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

      // เพิ่มปุ่มสอบใหม่หากต้องการ
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

    if (!confirm(`คุณกำลังจะเริ่มทำแบบทดสอบ ${testType} สำหรับระดับชั้น ${this.currentUser.grade}\n\n⚠️ กฎการสอบสำคัญ:\n1. มีการจับเวลา 15 นาที\n2. ห้ามสลับหน้าต่างหรือแท็บเบราว์เซอร์เด็ดขาด (เตือนได้สูงสุด 3 ครั้ง)\n3. ข้อสอบและตัวเลือกจะถูกสลับลำดับอัตโนมัติ\n\nพร้อมแล้วกด ตกลง เพื่อเริ่มสอบ`)) {
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
        const violationCountEl = document.getElementById("examViolationCount");
        if (violationBanner) {
          violationBanner.classList.remove("hidden");
          violationBanner.innerHTML = `
            <div>
              🚨 คำเตือนความปลอดภัย (ครั้งที่ <strong>${data.violationsCount} / ${data.maxViolations}</strong>): ${data.reason}
            </div>
            <div class="text-xs mt-1">หากตรวจพบครบ ${data.maxViolations} ครั้ง ระบบจะส่งข้อสอบและยุติการสอบทันที!</div>
          `;
          // กระพริบแถบเตือนเพื่อดึงดูดสายตาแทนการใช้ alert() ที่ขัดขวางเบราว์เซอร์
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

    // สลับหน้าจอและเรนเดอร์ข้อสอบก่อนเริ่มจับเวลาและตรวจจับความปลอดภัย (ป้องกัน false positive จาก modal)
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

    // หาข้อมูล Pre-test หรือ Post-test รอบก่อนหน้าเพื่อเปรียบเทียบในกราฟ
    const history = await DB.getStudentHistory(this.currentUser.email);
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

    // การแสดงเกียรติบัตร
    const certCard = document.getElementById("resultCertificateCard");
    const certNotice = document.getElementById("resultCertificateNotice");

    if (result.passed) {
      if (certCard) certCard.classList.remove("hidden");
      if (certNotice) certNotice.classList.add("hidden");

      // วาดตัวอย่างเกียรติบัตรขนาดพรีวิวลง Canvas บนหน้าจอ
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

    // เรนเดอร์สรุปรายด้าน (D1 - D6)
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

    // วาดกราฟใยแมงมุม Spider Radar Chart
    setTimeout(() => {
      AssessmentCharts.renderRadarChart("resultRadarChartCanvas", result, previousResult);
    }, 150);
  },

  // แสดงผลการสอบย้อนหลัง
  showPastResult(result, otherTest = null) {
    this.currentResult = result;
    this.switchView("view-results");
    this.renderResultsView(result, otherTest);
  }
};

// เริ่มต้นแอปเมื่อ DOM พร้อม
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

if (typeof window !== "undefined") {
  window.App = App;
}
