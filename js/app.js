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

    // ปุ่มเริ่มล็อกอินด้วย Google Account (@psuwit.ac.th)
    const googleSignInBtn = document.getElementById("btnGoogleSignIn");
    if (googleSignInBtn) {
      googleSignInBtn.addEventListener("click", () => {
        this.triggerGoogleSignIn();
      });
    }

    // ฟอร์มใน Google OAuth Popup Modal (ขั้นตอนที่ 1.1: ป้อนอีเมล @psuwit.ac.th)
    const googleEmailForm = document.getElementById("googleModalEmailForm");
    if (googleEmailForm) {
      googleEmailForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleGoogleModalEmailStep();
      });
    }

    // ฟอร์มใน Google OAuth Popup Modal (ขั้นตอนที่ 1.2: ป้อนรหัสผ่าน Google)
    const googlePasswordForm = document.getElementById("googleModalPasswordForm");
    if (googlePasswordForm) {
      googlePasswordForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleGoogleModalPasswordStep();
      });
    }

    // ขั้นตอนที่ 2: ฟอร์มยืนยันชื่อ-นามสกุล และระดับชั้น หลังผ่าน Google Login แล้ว
    const studentProfileForm = document.getElementById("studentProfileForm");
    if (studentProfileForm) {
      studentProfileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleStudentProfileSubmit();
      });
    }

    // ฟอร์มเข้าสู่ระบบสำหรับผู้ดูแลระบบ (Username & Password)
    const adminLoginForm = document.getElementById("adminLoginForm");
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
          console.warn("🚫 เฉพาะบัญชีผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น");
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

    // เริ่มต้นระบบ Google OAuth 2.0
    this.initGoogleAuth();

    // ปุ่มเริ่มทำแบบทดสอบ (เปิด Modal ยืนยันในหน้าเว็บ แทนการใช้ window.confirm)
    const startPreBtn = document.getElementById("btnStartPretest");
    if (startPreBtn) {
      startPreBtn.addEventListener("click", () => this.openConfirmStartModal("Pre-test"));
    }

    const startPostBtn = document.getElementById("btnStartPosttest");
    if (startPostBtn) {
      startPostBtn.addEventListener("click", () => this.openConfirmStartModal("Post-test"));
    }

    // ปุ่มแอ็กชันใน Modal เริ่มสอบ
    const btnConfirmStart = document.getElementById("btnConfirmStartExamAction");
    if (btnConfirmStart) {
      btnConfirmStart.addEventListener("click", () => {
        this.closeConfirmStartModal();
        if (this._pendingTestType) {
          this.executeStartAssessment(this._pendingTestType);
        }
      });
    }

    // ปุ่มส่งคำตอบในหน้าสอบ (เปิด Modal ยืนยันในหน้าเว็บ แทนการใช้ window.confirm)
    const submitBtn = document.getElementById("btnSubmitAssessment");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (!this.currentSession || this.currentSession.isSubmitted) return;
        this.openConfirmSubmitModal();
      });
    }

    // ปุ่มแอ็กชันใน Modal ส่งข้อสอบ
    const btnConfirmSubmit = document.getElementById("btnConfirmSubmitExamAction");
    if (btnConfirmSubmit) {
      btnConfirmSubmit.addEventListener("click", () => {
        this.closeConfirmSubmitModal();
        if (this.currentSession && !this.currentSession.isSubmitted) {
          this.currentSession.submit();
        }
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

  // ==============================================================
  // GOOGLE OAUTH 2.0 & 2-STEP LOGIN FLOW (@psuwit.ac.th)
  // ==============================================================

  // เริ่มต้นระบบ Google Identity Services (GIS)
  async initGoogleAuth() {
    try {
      const cfg = await DB.getAuthConfig();
      if (cfg && cfg.googleClientId) {
        this.googleClientId = cfg.googleClientId;
      }
    } catch (e) {
      console.warn("Could not fetch auth config:", e);
    }

    const clientId = this.googleClientId || APP_CONFIG.googleClientId;

    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => this.handleGoogleCredentialResponse(res),
          hosted_domain: "psuwit.ac.th",
          auto_select: false,
          cancel_on_tap_outside: true
        });

        const btnContainer = document.getElementById("googleSignInBtnContainer");
        if (btnContainer && clientId && !clientId.includes("YOUR_")) {
          window.google.accounts.id.renderButton(btnContainer, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "pill",
            width: 280
          });
        }
      } catch (err) {
        console.warn("Google ID init error:", err);
      }
    }
  },

  // คลิกปุ่มล็อกอินด้วย Google
  triggerGoogleSignIn() {
    this.resetLoginState();
    const clientId = this.googleClientId || APP_CONFIG.googleClientId;

    // หากมีการกำหนด Google Client ID จริง และมี GIS Token Client
    if (clientId && typeof google !== "undefined" && google.accounts && google.accounts.oauth2) {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          hd: "psuwit.ac.th",
          prompt: "select_account",
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              try {
                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const userInfo = await res.json();
                await this.verifyGoogleAccountAndProceed(userInfo.email, userInfo.name || "");
              } catch (err) {
                this.showDomainRestrictionAlert("ไม่สามารถดึงข้อมูลบัญชีจาก Google ได้ กรุณาลองใหม่อีกครั้ง");
              }
            }
          }
        });
        tokenClient.requestAccessToken();
        return;
      } catch (e) {
        console.warn("Google OAuth init error, opening Google Workspace Sign-In dialog:", e);
      }
    }

    // เปิดหน้าต่างจำลอง/ล็อกอิน Google Workspace (@psuwit.ac.th) ทันที
    this.openGoogleModal();
  },

  // เปิด Modal ลงชื่อเข้าใช้ด้วย Google
  openGoogleModal() {
    const modal = document.getElementById("googleOAuthModal");
    if (!modal) return;

    this._pendingGoogleEmail = "";
    const emailInput = document.getElementById("googleModalEmailInput");
    const pwdInput = document.getElementById("googleModalPasswordInput");
    const emailErr = document.getElementById("googleModalEmailError");
    const pwdErr = document.getElementById("googleModalPasswordError");
    const emailForm = document.getElementById("googleModalEmailForm");
    const pwdForm = document.getElementById("googleModalPasswordForm");

    if (emailInput) emailInput.value = "";
    if (pwdInput) pwdInput.value = "";
    if (emailErr) emailErr.classList.add("hidden");
    if (pwdErr) pwdErr.classList.add("hidden");
    if (emailForm) emailForm.classList.remove("hidden");
    if (pwdForm) pwdForm.classList.add("hidden");

    modal.classList.add("active");
    setTimeout(() => {
      if (emailInput) emailInput.focus();
    }, 100);
  },

  closeGoogleModal() {
    const modal = document.getElementById("googleOAuthModal");
    if (modal) modal.classList.remove("active");
  },

  backToGoogleEmailStep() {
    const emailForm = document.getElementById("googleModalEmailForm");
    const pwdForm = document.getElementById("googleModalPasswordForm");
    const emailInput = document.getElementById("googleModalEmailInput");
    if (pwdForm) pwdForm.classList.add("hidden");
    if (emailForm) emailForm.classList.remove("hidden");
    if (emailInput) emailInput.focus();
  },

  // ตรวจสอบอีเมลใน Modal (ขั้นตอนที่ 1.1)
  handleGoogleModalEmailStep() {
    const input = document.getElementById("googleModalEmailInput");
    const email = (input ? input.value : "").trim().toLowerCase();
    const errEl = document.getElementById("googleModalEmailError");

    // [สำคัญ] ตรวจสอบ Domain Restriction: ปฏิเสธทันทีถ้าไม่ได้ลงท้ายด้วย @psuwit.ac.th
    if (!email.endsWith("@psuwit.ac.th")) {
      const msg = "อนุญาตเฉพาะนักเรียน/บุคลากรภายในองค์กรเท่านั้น";
      if (errEl) {
        errEl.innerHTML = `🚫 <strong>ปฏิเสธการเข้าใช้งาน:</strong> ${msg}<br><span class="text-xs">ต้องเป็นอีเมลที่ลงท้ายด้วย @psuwit.ac.th เท่านั้น (ไม่อนุญาต @gmail.com)</span>`;
        errEl.classList.remove("hidden");
      }
      this.showDomainRestrictionAlert(msg);
      return;
    }

    if (errEl) errEl.classList.add("hidden");
    this._pendingGoogleEmail = email;

    const pill = document.getElementById("googleModalAccountPill");
    if (pill) pill.textContent = email;

    const emailForm = document.getElementById("googleModalEmailForm");
    const pwdForm = document.getElementById("googleModalPasswordForm");
    const pwdInput = document.getElementById("googleModalPasswordInput");

    if (emailForm) emailForm.classList.add("hidden");
    if (pwdForm) pwdForm.classList.remove("hidden");
    if (pwdInput) {
      pwdInput.value = "";
      pwdInput.focus();
    }
  },

  // ตรวจสอบรหัสผ่านใน Modal (ขั้นตอนที่ 1.2) และเข้าสู่ขั้นตอนที่ 2
  async handleGoogleModalPasswordStep() {
    const pwdInput = document.getElementById("googleModalPasswordInput");
    const pwd = pwdInput ? pwdInput.value : "";
    const errEl = document.getElementById("googleModalPasswordError");

    if (!pwd) {
      if (errEl) {
        errEl.textContent = "กรุณาป้อนรหัสผ่านบัญชี Google ของคุณ";
        errEl.classList.remove("hidden");
      }
      return;
    }

    if (errEl) errEl.classList.add("hidden");
    this.closeGoogleModal();
    await this.verifyGoogleAccountAndProceed(this._pendingGoogleEmail, "");
  },

  // จัดการ Credential Response จาก Google Identity Services
  async handleGoogleCredentialResponse(response) {
    this.resetLoginState();
    const res = await DB.authenticateGoogleUser({ credential: response.credential });
    if (!res.success) {
      this.showDomainRestrictionAlert(res.message);
      return;
    }
    await this.verifyGoogleAccountAndProceed(res.user.email, res.user.name || res.user.full_name || "");
  },

  // ตรวจสอบความถูกต้องและส่งต่อเข้าสู่ ขั้นตอนที่ 2 (Step 2: Profile Confirmation)
  async verifyGoogleAccountAndProceed(rawEmail, googleDisplayName = "") {
    const cleanEmail = (rawEmail || "").trim().toLowerCase();

    // 1. ตรวจสอบ Domain Validation
    if (!cleanEmail.endsWith("@psuwit.ac.th")) {
      this.showDomainRestrictionAlert("อนุญาตเฉพาะนักเรียน/บุคลากรภายในองค์กรเท่านั้น");
      return;
    }

    this.resetLoginState();

    // 2. สกัด student_id จากชื่อส่วนหน้าของอีเมล
    const studentId = cleanEmail.split("@")[0];

    // 3. บันทึกข้อมูลลงตาราง users ในฐานข้อมูล (SQLite + Supabase)
    const authRes = await DB.authenticateGoogleUser({ email: cleanEmail, name: googleDisplayName });
    const userRecord = authRes.user || {
      email: cleanEmail,
      full_name: googleDisplayName || cleanEmail.split("@")[0],
      student_id: studentId,
      role: cleanEmail.startsWith("50015") || cleanEmail.includes("winai") ? "admin" : "student"
    };

    // 4. ดึงข้อมูลนักเรียนจากฐานข้อมูลเดิม (ถ้ามี)
    let studentProfile = null;
    try {
      const students = await DB.getStudents();
      studentProfile = students.find((s) => (s.email || "").toLowerCase() === cleanEmail || (s.username || "").toLowerCase() === cleanEmail);
    } catch (e) {}

    this.pendingSsoSession = {
      email: cleanEmail,
      student_id: studentId,
      full_name: (studentProfile && studentProfile.name) || userRecord.full_name || googleDisplayName || "",
      grade: (studentProfile && studentProfile.grade) || userRecord.grade || "ม.1",
      role: userRecord.role || "student"
    };

    // 5. แสดงผลขั้นตอนที่ 2 (Step 2: ยืนยันชื่อ-นามสกุล และระดับชั้น)
    const verifiedEmailDisplay = document.getElementById("verifiedSsoEmailDisplay");
    const verifiedIdDisplay = document.getElementById("verifiedSsoIdDisplay");
    const nameField = document.getElementById("loginStudentName");
    const gradeField = document.getElementById("loginStudentGrade");

    if (verifiedEmailDisplay) verifiedEmailDisplay.textContent = cleanEmail;
    if (verifiedIdDisplay) verifiedIdDisplay.textContent = studentId;
    if (nameField) nameField.value = this.pendingSsoSession.full_name;
    if (gradeField) gradeField.value = this.pendingSsoSession.grade;

    const ssoStep1 = document.getElementById("studentSsoForm");
    const profileStep2 = document.getElementById("studentProfileForm");
    if (ssoStep1) ssoStep1.classList.add("hidden");
    if (profileStep2) profileStep2.classList.remove("hidden");

    if (nameField && !nameField.value) {
      nameField.focus();
    } else if (gradeField) {
      gradeField.focus();
    }
  },

  // ขั้นตอนที่ 2: กดยืนยันข้อมูลและเข้าสู่ระบบการทดสอบ
  async handleStudentProfileSubmit() {
    if (!this.pendingSsoSession) {
      this.resetSsoStep();
      return;
    }

    const nameInput = document.getElementById("loginStudentName")?.value.trim() || "";
    const gradeInput = document.getElementById("loginStudentGrade")?.value || "";

    if (!nameInput) {
      this.showDomainRestrictionAlert("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    if (!gradeInput) {
      this.showDomainRestrictionAlert("กรุณาเลือกระดับชั้นมัธยมศึกษา");
      return;
    }

    this.currentUser = {
      ...this.pendingSsoSession,
      name: nameInput,
      full_name: nameInput,
      grade: gradeInput
    };

    // บันทึก/อัปเดตลงฐานข้อมูล students
    try {
      await DB.saveStudent({
        student_id: this.currentUser.student_id,
        name: this.currentUser.name,
        email: this.currentUser.email,
        username: this.currentUser.email,
        grade: this.currentUser.grade,
        role: this.currentUser.role,
        status: "active"
      });
    } catch (e) {}

    localStorage.setItem(APP_CONFIG.storageKeys.currentUser, JSON.stringify(this.currentUser));

    if (this.currentUser.role === "admin") {
      this.switchView("view-admin");
      AdminController.init();
    } else {
      this.switchView("view-student-portal");
      this.renderStudentPortal();
    }
  },

  // สลับบัญชี SSO (ย้อนกลับไปขั้นตอนที่ 1)
  resetSsoStep() {
    this.pendingSsoSession = null;
    const ssoStep1 = document.getElementById("studentSsoForm");
    const profileStep2 = document.getElementById("studentProfileForm");
    if (ssoStep1) ssoStep1.classList.remove("hidden");
    if (profileStep2) profileStep2.classList.add("hidden");
    this.resetLoginState();
  },

  // แสดงกล่องแจ้งเตือนการปฏิเสธการเข้าใช้งานเนื่องจากโดเมนไม่ถูกต้อง (Domain Restricted)
  showDomainRestrictionAlert(msg) {
    const alertBox = document.getElementById("domainRestrictionAlert");
    const textEl = document.getElementById("domainRestrictionMsg") || document.getElementById("domainAlertText");
    if (textEl && msg) textEl.textContent = msg;
    if (alertBox) {
      alertBox.classList.remove("hidden");
      alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },

  // รีเซ็ตการแจ้งเตือนในหน้า Login
  resetLoginState() {
    const alertBox = document.getElementById("domainRestrictionAlert");
    if (alertBox) alertBox.classList.add("hidden");
    const adminErrBanner = document.getElementById("adminAuthErrorBanner");
    if (adminErrBanner) adminErrBanner.classList.add("hidden");
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
      if (!feedback) return;
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
      this.currentSession.detachAntiCheatListeners();
    }
    this.currentUser = null;
    this.currentSession = null;
    localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
    this.resetLoginState();
    this.switchView("view-auth");
  },

  // เรนเดอร์หน้าพอร์ทัลของนักเรียน (รองรับการเก็บประวัติสะสม ม.1-ม.3 และ ม.4-ม.6)
  async renderStudentPortal() {
    if (!this.currentUser) return;

    // ซิงก์ระดับชั้นและห้องเรียนล่าสุดจากฐานข้อมูล (กรณีผู้ดูแลระบบเลื่อนชั้นให้ เช่น ม.1 -> ม.2)
    try {
      const allStudents = await DB.getStudents();
      const targetEmail = (this.currentUser.email || this.currentUser.username || "").toLowerCase();
      const latestStudent = allStudents.find((s) => (s.email || s.username || "").toLowerCase() === targetEmail);
      if (latestStudent) {
        this.currentUser.grade = latestStudent.grade || this.currentUser.grade;
        this.currentUser.room = latestStudent.room !== undefined ? latestStudent.room : this.currentUser.room;
        this.currentUser.class_no = latestStudent.class_no !== undefined ? latestStudent.class_no : this.currentUser.class_no;
        this.currentUser.name = latestStudent.name || this.currentUser.name;
        localStorage.setItem(APP_CONFIG.storageKeys.currentUser, JSON.stringify(this.currentUser));
        const roomLabel = this.currentUser.room && this.currentUser.room !== "-" ? `/${this.currentUser.room}` : "";
        const roleEl = document.getElementById("headerUserRole");
        if (roleEl && this.currentUser.role !== "admin") {
          roleEl.textContent = `${this.currentUser.grade || ""}${roomLabel} (${this.currentUser.student_id || ""})`;
        }
      }
    } catch (e) {}

    const activeGrade = this.currentUser.grade || "ม.1";

    document.getElementById("portalStudentName").textContent = this.currentUser.name;
    document.getElementById("portalStudentEmail").textContent = this.currentUser.username || this.currentUser.email;
    const roomPart = this.currentUser.room ? `/${this.currentUser.room}` : "";
    const noPart = this.currentUser.class_no ? ` (เลขที่ ${this.currentUser.class_no})` : "";
    document.getElementById("portalStudentGrade").textContent = `${activeGrade}${roomPart}${noPart}`;
    document.getElementById("portalStudentId").textContent = this.currentUser.student_id || "-";

    // ดึงประวัติการสอบทั้งหมดของนักเรียน (ทุกชั้นปีที่เคยสอบ)
    const history = await DB.getStudentHistory(this.currentUser.email || this.currentUser.username);
    this._cachedStudentHistory = history;

    // กรองเฉพาะผลสอบของระดับชั้นปัจจุบัน (เช่น เมื่อเลื่อนขึ้น ม.2 จะได้ทำข้อสอบชุด ม.2 ได้โดยประวัติ ม.1 ยังอยู่ครบ)
    const currentGradeHistory = history.filter((h) => h.grade === activeGrade);
    const preTest = currentGradeHistory.find((h) => h.test_type === "Pre-test");
    const postTest = currentGradeHistory.find((h) => h.test_type === "Post-test");

    // อัปเดตการ์ดสถานะ Pre-test (ของระดับชั้นปัจจุบัน)
    const preStatusBadge = document.getElementById("portalPreStatusBadge");
    const preScoreText = document.getElementById("portalPreScoreText");
    const btnStartPre = document.getElementById("btnStartPretest");

    if (preTest) {
      preStatusBadge.innerHTML = `<span class="badge badge-success">ทำเสร็จแล้ว (${activeGrade})</span>`;
      preScoreText.textContent = `${preTest.score_total}/${preTest.max_score} (${preTest.score_percent}%)`;
      btnStartPre.textContent = `🔍 ดูผลคะแนน Pre-test (${activeGrade})`;
      btnStartPre.onclick = () => this.showPastResult(preTest, postTest);

      let retakePreBtn = document.getElementById("btnRetakePretest");
      if (!retakePreBtn) {
        retakePreBtn = document.createElement("button");
        retakePreBtn.id = "btnRetakePretest";
        retakePreBtn.className = "btn btn-secondary btn-sm mt-2";
        retakePreBtn.style.width = "100%";
        retakePreBtn.textContent = `🔄 ทำแบบทดสอบ Pre-test (${activeGrade}) อีกครั้ง`;
        retakePreBtn.onclick = () => this.startAssessment("Pre-test");
        btnStartPre.parentNode.appendChild(retakePreBtn);
      } else {
        retakePreBtn.textContent = `🔄 ทำแบบทดสอบ Pre-test (${activeGrade}) อีกครั้ง`;
      }
    } else {
      preStatusBadge.innerHTML = `<span class="badge badge-warning">ยังไม่ได้ทำ (${activeGrade})</span>`;
      preScoreText.textContent = `ยังไม่มีคะแนนในระดับชั้น ${activeGrade}`;
      btnStartPre.textContent = `🚀 เริ่มทำแบบทดสอบก่อนเรียน Pre-test (${activeGrade})`;
      btnStartPre.onclick = () => this.startAssessment("Pre-test");
      const retakePreBtn = document.getElementById("btnRetakePretest");
      if (retakePreBtn) retakePreBtn.remove();
    }

    // อัปเดตการ์ดสถานะ Post-test (ของระดับชั้นปัจจุบัน)
    const postStatusBadge = document.getElementById("portalPostStatusBadge");
    const postScoreText = document.getElementById("portalPostScoreText");
    const btnStartPost = document.getElementById("btnStartPosttest");

    if (postTest) {
      postStatusBadge.innerHTML = `<span class="badge badge-success">ทำเสร็จแล้ว (${activeGrade})</span>`;
      postScoreText.textContent = `${postTest.score_total}/${postTest.max_score} (${postTest.score_percent}%)`;
      btnStartPost.textContent = `🔍 ดูผลและดาวน์โหลดเกียรติบัตร (${activeGrade})`;
      btnStartPost.onclick = () => this.showPastResult(postTest, preTest);

      let retakePostBtn = document.getElementById("btnRetakePosttest");
      if (!retakePostBtn) {
        retakePostBtn = document.createElement("button");
        retakePostBtn.id = "btnRetakePosttest";
        retakePostBtn.className = "btn btn-secondary btn-sm mt-2";
        retakePostBtn.style.width = "100%";
        retakePostBtn.textContent = `🔄 ทำแบบทดสอบ Post-test (${activeGrade}) อีกครั้ง`;
        retakePostBtn.onclick = () => this.startAssessment("Post-test");
        btnStartPost.parentNode.appendChild(retakePostBtn);
      } else {
        retakePostBtn.textContent = `🔄 ทำแบบทดสอบ Post-test (${activeGrade}) อีกครั้ง`;
      }
    } else {
      postStatusBadge.innerHTML = `<span class="badge badge-secondary">รอทำหลังเรียน (${activeGrade})</span>`;
      postScoreText.textContent = `ยังไม่มีคะแนนในระดับชั้น ${activeGrade}`;
      btnStartPost.textContent = `🎯 เริ่มทำแบบทดสอบหลังเรียน Post-test (${activeGrade})`;
      btnStartPost.onclick = () => this.startAssessment("Post-test");
      const retakePostBtn = document.getElementById("btnRetakePosttest");
      if (retakePostBtn) retakePostBtn.remove();
    }

    // แสดงกราฟเปรียบเทียบของระดับชั้นปัจจุบันในหน้าพอร์ทัล หากเคยสอบแล้ว
    const historyContainer = document.getElementById("portalHistorySection");
    if (preTest || postTest) {
      historyContainer.classList.remove("hidden");
      setTimeout(() => {
        AssessmentCharts.renderRadarChart("portalRadarChartCanvas", postTest || preTest, postTest ? preTest : null);
      }, 100);
    } else {
      historyContainer.classList.add("hidden");
    }

    // เรนเดอร์ตาราง/การ์ดประวัติการทดสอบสะสมรายระดับชั้น (ม.1 - ม.3 และ ม.4 - ม.6)
    this.renderMultiGradeHistory(history, activeGrade);
  },

  // แสดงประวัติการทดสอบสะสมตั้งแต่มัธยมศึกษาตอนต้น (ม.1-ม.3) และมัธยมศึกษาตอนปลาย (ม.4-ม.6)
  renderMultiGradeHistory(history = [], activeGrade = "ม.1") {
    const container = document.getElementById("portalMultiGradeHistoryContent");
    if (!container) return;

    const groups = [
      {
        title: "🌱 ช่วงชั้นที่ 3 : มัธยมศึกษาตอนต้น (ม.1 - ม.3)",
        grades: ["ม.1", "ม.2", "ม.3"],
        accent: "#4F46E5"
      },
      {
        title: "🚀 ช่วงชั้นที่ 4 : มัธยมศึกษาตอนปลาย (ม.4 - ม.6)",
        grades: ["ม.4", "ม.5", "ม.6"],
        accent: "#059669"
      }
    ];

    container.innerHTML = groups
      .map((grp) => {
        const gradeCardsHtml = grp.grades
          .map((g) => {
            const isCurrent = g === activeGrade;
            const gHistory = history.filter((h) => h.grade === g);
            const pre = gHistory.find((h) => h.test_type === "Pre-test");
            const post = gHistory.find((h) => h.test_type === "Post-test");
            const primaryTest = post || pre;

            const borderStyle = isCurrent
              ? `border: 2px solid ${grp.accent}; background: #F8FAFC;`
              : gHistory.length > 0
              ? `border: 1px solid #CBD5E1; background: #FFFFFF;`
              : `border: 1px dashed #CBD5E1; background: #F8FAFC; opacity: 0.85;`;

            const preBadge = pre
              ? `<span class="font-bold text-indigo-700">${pre.score_total}/${pre.max_score} (${pre.score_percent}%)</span>`
              : `<span class="text-slate-400">ยังไม่มีผลสอบ</span>`;

            const postBadge = post
              ? `<span class="font-bold ${post.passed ? "text-emerald-600" : "text-amber-600"}">${post.score_total}/${post.max_score} (${post.score_percent}%)</span>`
              : `<span class="text-slate-400">ยังไม่มีผลสอบ</span>`;

            let actionBtns = "";
            if (primaryTest) {
              actionBtns = `
                <div class="flex gap-1.5 mt-3 pt-2 border-t border-slate-200 flex-wrap">
                  <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;" onclick="App.openHistoryByGrade('${g}')">
                    📊 ดูผล/กราฟ (${g})
                  </button>
                  ${
                    post && post.passed
                      ? `<button type="button" class="btn btn-gold btn-sm" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;" onclick="App.downloadCertByTestId('${post.test_id}')">
                          🎓 เกียรติบัตร ${g}
                        </button>`
                      : pre && pre.passed
                      ? `<button type="button" class="btn btn-gold btn-sm" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;" onclick="App.downloadCertByTestId('${pre.test_id}')">
                          🎓 เกียรติบัตร ${g}
                        </button>`
                      : ""
                  }
                </div>
              `;
            }

            return `
              <div class="p-3 rounded-xl" style="${borderStyle}">
                <div class="flex justify-between items-center mb-2">
                  <span class="font-bold text-sm text-slate-900">ระดับชั้น ${g}</span>
                  ${
                    isCurrent
                      ? `<span class="badge badge-primary" style="font-size: 0.68rem;">ชั้นปัจจุบัน</span>`
                      : gHistory.length > 0
                      ? `<span class="badge badge-success" style="font-size: 0.68rem;">บันทึกประวัติแล้ว</span>`
                      : `<span class="badge badge-secondary" style="font-size: 0.68rem;">ยังไม่สอบ</span>`
                  }
                </div>
                <div class="text-xs space-y-1">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Pre-test:</span>
                    ${preBadge}
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Post-test:</span>
                    ${postBadge}
                  </div>
                </div>
                ${actionBtns}
              </div>
            `;
          })
          .join("");

        return `
          <div class="mb-4 last:mb-0">
            <div class="text-xs font-bold text-slate-700 mb-2">${grp.title}</div>
            <div class="grid grid-cols-3 gap-3">
              ${gradeCardsHtml}
            </div>
          </div>
        `;
      })
      .join("");
  },

  openHistoryByGrade(grade) {
    const history = this._cachedStudentHistory || [];
    const gHistory = history.filter((h) => h.grade === grade);
    const post = gHistory.find((h) => h.test_type === "Post-test");
    const pre = gHistory.find((h) => h.test_type === "Pre-test");
    if (post) {
      this.showPastResult(post, pre || null);
    } else if (pre) {
      this.showPastResult(pre, null);
    }
  },

  downloadCertByTestId(testId) {
    const history = this._cachedStudentHistory || [];
    const target = history.find((h) => h.test_id === testId);
    if (target) {
      CertificateEngine.downloadCertificatePDF(target);
    }
  },

  // ==============================================================
  // ASSESSMENT MODALS & FLOW (แทนที่ window.confirm & alert)
  // ==============================================================

  // เปิด Modal ยืนยันก่อนเริ่มทำแบบทดสอบ
  openConfirmStartModal(testType) {
    if (!this.currentUser) return;
    this._pendingTestType = testType;
    const titleEl = document.getElementById("confirmStartExamTitle");
    const descEl = document.getElementById("confirmStartExamDesc");
    const grade = this.currentUser.grade || "";

    if (titleEl) {
      titleEl.textContent = `เริ่มทำแบบทดสอบ ${testType} (${grade})`;
    }
    if (descEl) {
      descEl.innerHTML = `
        คุณกำลังจะเริ่มทำแบบทดสอบ <strong>${testType}</strong> สำหรับระดับชั้น <strong>${grade}</strong><br>
        • มีเวลา 15 นาที (จำนวน 15 ข้อ รวม 75 คะแนน)<br>
        • <strong>ไม่อนุญาตให้คัดลอกข้อสอบหรือตัวเลือกคำตอบเพื่อไปค้นหาเฉลย</strong><br>
        • พร้อมแล้วกดปุ่มยืนยันด้านล่างเพื่อเริ่มทำแบบทดสอบ
      `;
    }

    const modal = document.getElementById("modalConfirmStartExam");
    if (modal) modal.classList.add("active");
  },

  closeConfirmStartModal() {
    const modal = document.getElementById("modalConfirmStartExam");
    if (modal) modal.classList.remove("active");
  },

  // เริ่มต้นทำแบบทดสอบ (หลังจากผู้ใช้กดยืนยันใน Modal)
  async executeStartAssessment(testType) {
    if (!this.currentUser) return;
    this.closeConfirmStartModal();

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
      onSubmit: async (result) => {
        await this.handleAssessmentSubmission(result);
      }
    });

    this.switchView("view-assessment");
    this.renderAssessmentView();

    try {
      await this.currentSession.start();
    } catch (err) {
      console.warn("Session start error:", err);
    }
  },

  // คง method startAssessment ไว้เพื่อความเข้ากันได้
  startAssessment(testType) {
    this.openConfirmStartModal(testType);
  },

  // เปิด Modal ยืนยันส่งคำตอบ
  openConfirmSubmitModal() {
    if (!this.currentSession || this.currentSession.isSubmitted) return;
    const answered = this.currentSession.getAnsweredCount();
    const total = this.currentSession.questions.length;
    const descEl = document.getElementById("confirmSubmitExamDesc");

    if (descEl) {
      if (answered < total) {
        descEl.innerHTML = `
          คุณตอบไปแล้ว <strong class="text-indigo-600">${answered}</strong> จาก <strong class="text-indigo-600">${total}</strong> ข้อ<br>
          <span style="color: #D97706; font-weight: 600;">⚠️ ยังมีข้อที่ยังไม่ได้ตอบอีก ${total - answered} ข้อ</span><br>
          ต้องการยืนยันการส่งแบบทดสอบเลยหรือไม่?
        `;
      } else {
        descEl.innerHTML = `
          คุณตอบครบทั้งหมด <strong>${total} / ${total}</strong> ข้อแล้ว 🎉<br>
          ต้องการส่งแบบทดสอบเพื่อบันทึกผลและดูคะแนนใช่หรือไม่?
        `;
      }
    }

    const modal = document.getElementById("modalConfirmSubmitExam");
    if (modal) modal.classList.add("active");
  },

  closeConfirmSubmitModal() {
    const modal = document.getElementById("modalConfirmSubmitExam");
    if (modal) modal.classList.remove("active");
  },

  // เรนเดอร์หน้าจอทำข้อสอบ
  renderAssessmentView() {
    const session = this.currentSession;
    document.getElementById("examHeaderTitle").textContent = `แบบทดสอบสมรรถนะ IT (${session.testType}) - ระดับชั้น ${session.grade}`;
    const noticeBanner = document.getElementById("examNoticeBanner");
    if (noticeBanner) noticeBanner.classList.remove("hidden");

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
    try {
      // 1. ปิด Modal ยืนยันส่งคำตอบ (ถ้าเปิดค้างอยู่)
      this.closeConfirmSubmitModal();

      // 2. สลับไปหน้ารายงานผลทันที (Instant Transition) ไม่ต้องรอเน็ตเวิร์ก
      this.currentResult = result;
      this.switchView("view-results");
      window.scrollTo({ top: 0, behavior: "smooth" });
      this.renderResultsView(result, null);

      // 3. บันทึกผลสอบเข้าฐานข้อมูล (Supabase + LocalStorage)
      let saved = result;
      try {
        saved = await DB.saveAssessment(result);
        this.currentResult = saved;
      } catch (saveErr) {
        console.warn("DB.saveAssessment error (non-fatal):", saveErr);
      }

      // 4. ดึงประวัติผลสอบเพื่อนำมาวาดกราฟเปรียบเทียบ (Pre vs Post)
      try {
        const studentEmail = (this.currentUser && (this.currentUser.email || this.currentUser.username)) || result.email || "";
        const history = (await DB.getStudentHistory(studentEmail)) || [];
        this._cachedStudentHistory = Array.isArray(history) ? history : [];
        const otherTest = this._cachedStudentHistory.find(
          (h) => h && h.grade === saved.grade && h.test_id !== saved.test_id
        );
        // อัปเดตผลสอบและกราฟเปรียบเทียบเมื่อได้ข้อมูลประวัติแล้ว
        this.renderResultsView(saved, otherTest || null);
      } catch (histErr) {
        console.warn("Could not fetch comparison history (non-fatal):", histErr);
      }
    } catch (criticalErr) {
      console.error("Critical error in handleAssessmentSubmission:", criticalErr);
      // Fallback: รับประกันว่าสลับไปหน้ารายงานผล 100%
      this.currentResult = result;
      this.switchView("view-results");
      window.scrollTo({ top: 0, behavior: "smooth" });
      this.renderResultsView(result, null);
    }
  },

  // เรนเดอร์หน้ารายงานผลสอบและเกียรติบัตร
  renderResultsView(result, previousResult = null) {
    if (!result) return;

    const elName = document.getElementById("resStudentName");
    const elGrade = document.getElementById("resStudentGrade");
    const elType = document.getElementById("resTestType");
    const elTotal = document.getElementById("resTotalScore");
    const elPercent = document.getElementById("resPercentScore");
    const elLevel = document.getElementById("resLevelText");

    if (elName) elName.textContent = result.student_name || "นักเรียน";
    if (elGrade) elGrade.textContent = result.grade || "-";
    if (elType) elType.textContent = result.test_type || "-";
    if (elTotal) elTotal.textContent = `${result.score_total || 0} / ${result.max_score || 75} คะแนน`;
    if (elPercent) elPercent.textContent = `${result.score_percent || 0}%`;

    const level = CertificateEngine.getProficiencyLevel(result.score_percent || 0);
    if (elLevel) elLevel.textContent = level;

    const certCard = document.getElementById("resultCertificateCard");
    const certNotice = document.getElementById("resultCertificateNotice");

    if (result.passed) {
      if (certCard) certCard.classList.remove("hidden");
      if (certNotice) certNotice.classList.add("hidden");

      const previewCanvas = document.getElementById("certificatePreviewCanvas");
      if (previewCanvas) {
        try {
          CertificateEngine.drawCertificateCanvas(result, previewCanvas);
        } catch (canvasErr) {
          console.warn("Certificate draw error:", canvasErr);
        }
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
    if (domainCardsContainer && typeof IT_DOMAINS !== "undefined") {
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
      try {
        if (typeof AssessmentCharts !== "undefined" && AssessmentCharts.renderRadarChart) {
          AssessmentCharts.renderRadarChart("resultRadarChartCanvas", result, previousResult);
        }
      } catch (chartErr) {
        console.warn("Radar chart error:", chartErr);
      }
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
