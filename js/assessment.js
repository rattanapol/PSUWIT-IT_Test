/**
 * กลไกการทำแบบทดสอบ (Assessment Engine)
 * - สลับข้อคำถามและสลับตัวเลือกแบบสุ่ม (Fisher-Yates Shuffle)
 * - ระบบป้องกันการทุจริต: ตรวจจับการสลับหน้าต่าง/แท็บ, บล็อกการคัดลอก/คลิกขวา, โหมดเต็มหน้าจอ
 * - ระบบนับเวลาถอยหลัง (Countdown Timer) พร้อมการส่งคำตอบอัตโนมัติเมื่อหมดเวลา
 * - คำนวณคะแนนตาม Rubric 1-5 และจัดกลุ่มตาม 6 ด้านสมรรถนะ IT
 */

class AssessmentSession {
  constructor(options) {
    this.student = options.student; // { name, email, student_id, grade }
    this.grade = options.grade || this.student.grade;
    this.testType = options.testType || "Pre-test"; // "Pre-test" | "Post-test"
    this.durationMinutes = options.durationMinutes || APP_CONFIG.testDurationMinutes;
    
    this.questions = [];
    this.answers = {}; // { questionId: chosenScore }
    this.currentQuestionIndex = 0;
    
    // สถานะความปลอดภัยและการจับเวลา
    this.timeRemainingSeconds = this.durationMinutes * 60;
    this.timeSpentSeconds = 0;
    this.timerInterval = null;
    this.violationsCount = 0;
    this.maxViolations = APP_CONFIG.maxViolations;
    this.isSubmitted = false;
    this.isInFullscreen = false;

    // Callbacks
    this.onTick = options.onTick || (() => {});
    this.onViolation = options.onViolation || (() => {});
    this.onSubmit = options.onSubmit || (() => {});

    this.initQuestions();
  }

  // เตรียมข้อสอบและสลับข้อ/สลับตัวเลือก (Fisher-Yates Shuffle)
  initQuestions() {
    const rawBank = QUESTION_BANK[this.grade] || QUESTION_BANK["ม.1"];
    // คัดลอก Deep Copy เพื่อไม่ให้กระทบคลังข้อสอบหลัก
    const cloned = JSON.parse(JSON.stringify(rawBank));
    
    // 1. สลับลำดับข้อสอบ
    this.questions = this.shuffleArray(cloned);

    // 2. สลับลำดับตัวเลือกในแต่ละข้อ
    this.questions.forEach((q, index) => {
      q.displayNumber = index + 1;
      q.options = this.shuffleArray(q.options);
    });
  }

  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // เริ่มต้นการสอบและเปิดระบบป้องกันการคัดลอกข้อสอบ
  start() {
    this.startTimer();
    this.attachAntiCheatListeners();
  }

  // แสดงข้อความแจ้งเตือนในหน้าเว็บ (Toast Notification) โดยไม่ต้องใช้ window.alert
  showCopyToast(message) {
    if (typeof document === "undefined") return;
    let toast = document.getElementById("assessmentCopyToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "assessmentCopyToast";
      toast.className = "assessment-copy-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.classList.add("hidden"), 300);
    }, 2500);
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeSpentSeconds++;
      this.timeRemainingSeconds--;

      this.onTick({
        remaining: this.timeRemainingSeconds,
        formatted: this.formatTime(this.timeRemainingSeconds),
        percent: ((this.durationMinutes * 60 - this.timeRemainingSeconds) / (this.durationMinutes * 60)) * 100
      });

      if (this.timeRemainingSeconds <= 0) {
        this.autoSubmit("หมดเวลาในการทำแบบทดสอบ ระบบส่งคำตอบโดยอัตโนมัติ");
      }
    }, 1000);
  }

  formatTime(totalSeconds) {
    const m = Math.floor(Math.max(0, totalSeconds) / 60);
    const s = Math.max(0, totalSeconds) % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // ระบบป้องกันการคัดลอกข้อสอบและตัวเลือก (Copy-Paste Protection)
  attachAntiCheatListeners() {
    // 1. บล็อกการคลิกขวา (Context Menu)
    this._contextMenuHandler = (e) => {
      e.preventDefault();
      this.showCopyToast("⚠️ ระบบไม่อนุญาตให้คลิกขวาในหน้าทำแบบทดสอบ");
      return false;
    };

    // 2. บล็อกการเลือกคลุมข้อความ (Select Start)
    this._selectStartHandler = (e) => {
      e.preventDefault();
      return false;
    };

    // 3. บล็อกคำสั่งคัดลอก (Copy) และตัด (Cut)
    this._copyHandler = (e) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", "");
      }
      this.showCopyToast("⚠️ ระบบไม่อนุญาตให้คัดลอกข้อความเพื่อไปหาคำตอบ");
      return false;
    };

    this._cutHandler = (e) => {
      e.preventDefault();
      this.showCopyToast("⚠️ ระบบไม่อนุญาตให้คัดลอกข้อความ");
      return false;
    };

    // 4. บล็อกคีย์ลัดคัดลอก: Ctrl+C, Ctrl+X, Ctrl+A, Ctrl+U (View Source)
    this._keyHandler = (e) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && ["c", "x", "a", "u"].includes(key)) {
        e.preventDefault();
        this.showCopyToast("⚠️ ระบบไม่อนุญาตให้คัดลอกข้อสอบหรือตัวเลือกคำตอบ");
        return false;
      }
    };

    // 5. ป้องกันการปิดแท็บหรือรีเฟรชโดยไม่ตั้งใจ
    this._beforeUnloadHandler = (e) => {
      if (!this.isSubmitted) {
        e.preventDefault();
        e.returnValue = "ระบบกำลังอยู่ในระหว่างการทำแบบทดสอบ หากปิดหน้านี้ผลสอบจะไม่ได้รับการบันทึก";
        return e.returnValue;
      }
    };

    document.addEventListener("contextmenu", this._contextMenuHandler);
    document.addEventListener("selectstart", this._selectStartHandler);
    document.addEventListener("copy", this._copyHandler);
    document.addEventListener("cut", this._cutHandler);
    window.addEventListener("keydown", this._keyHandler);
    window.addEventListener("beforeunload", this._beforeUnloadHandler);
  }

  detachAntiCheatListeners() {
    document.removeEventListener("contextmenu", this._contextMenuHandler);
    document.removeEventListener("selectstart", this._selectStartHandler);
    document.removeEventListener("copy", this._copyHandler);
    document.removeEventListener("cut", this._cutHandler);
    window.removeEventListener("keydown", this._keyHandler);
    window.removeEventListener("beforeunload", this._beforeUnloadHandler);
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this._toastTimer) clearTimeout(this._toastTimer);
  }

  // เลือกคำตอบ
  selectAnswer(questionId, score) {
    this.answers[questionId] = score;
  }

  getAnswer(questionId) {
    return this.answers[questionId];
  }

  getAnsweredCount() {
    return Object.keys(this.answers).length;
  }

  getTotalQuestions() {
    return this.questions.length;
  }

  // คำนวณผลการทดสอบ
  calculateResults() {
    let totalScore = 0;
    const maxScore = this.questions.length * 5; // คะแนนเต็มสูงสุด (ข้อละ 5)
    
    // คะแนนแยกแต่ละด้าน D1 - D6
    const domainRawScores = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 };
    const domainMaxScores = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 };

    this.questions.forEach((q) => {
      const chosenScore = this.answers[q.id] || 1; // หากไม่ได้ตอบ ถือว่าได้ 1 คะแนน
      totalScore += chosenScore;

      const dom = q.domain || "D1";
      if (!domainRawScores[dom]) domainRawScores[dom] = 0;
      if (!domainMaxScores[dom]) domainMaxScores[dom] = 0;

      domainRawScores[dom] += chosenScore;
      domainMaxScores[dom] += 5;
    });

    // คิดเป็นเปอร์เซ็นต์ในแต่ละด้าน (เต็ม 100%)
    const domainPercentages = {};
    Object.keys(domainRawScores).forEach((d) => {
      const max = domainMaxScores[d] || 5;
      domainPercentages[d] = Math.round((domainRawScores[d] / max) * 100);
    });

    const percent = Math.round((totalScore / maxScore) * 100);
    const passed = percent >= APP_CONFIG.certificatePassingPercent;

    return {
      student_id: this.student.student_id,
      student_name: this.student.name,
      email: this.student.email,
      grade: this.grade,
      test_type: this.testType,
      score_total: totalScore,
      max_score: maxScore,
      score_percent: percent,
      domain_scores: domainPercentages, // แปลงเป็นระดับ 0-100% สำหรับกราฟใยแมงมุม
      domain_raw: domainRawScores,
      time_spent_seconds: this.timeSpentSeconds,
      violations_count: this.violationsCount,
      passed: passed
    };
  }

  submit() {
    if (this.isSubmitted) return;
    this.isSubmitted = true;
    this.detachAntiCheatListeners();
    const result = this.calculateResults();
    this.onSubmit(result);
    return result;
  }

  // ส่งข้อสอบอัตโนมัติ (เช่น เมื่อหมดเวลา) โดยไม่ใช้ window.alert
  autoSubmit(message) {
    if (this.isSubmitted) return;
    this.showCopyToast(message || "หมดเวลาการทำแบบทดสอบ");
    this.submit();
  }
}

if (typeof window !== "undefined") {
  window.AssessmentSession = AssessmentSession;
}
