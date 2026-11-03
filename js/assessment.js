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

  // เริ่มต้นการสอบและเปิดระบบจับตาความปลอดภัย
  start() {
    this.startTimer();
    this.attachAntiCheatListeners();
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
        this.autoSubmit("หมดเวลาในการทำแบบทดสอบ");
      }
    }, 1000);
  }

  formatTime(totalSeconds) {
    const m = Math.floor(Math.max(0, totalSeconds) / 60);
    const s = Math.max(0, totalSeconds) % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // ระบบตรวจจับการโกง (Anti-Cheat)
  attachAntiCheatListeners() {
    this._lastViolationTime = 0;

    this._visibilityHandler = () => {
      if (document.hidden && !this.isSubmitted) {
        this.handleViolation("ตรวจพบการสลับหน้าต่างโปรแกรม หรือเปิดแท็บอื่น");
      }
    };

    this._blurHandler = () => {
      // ตรวจสอบว่าไม่ได้อยู่ในระหว่างแสดง dialog หรือหน่วงเวลา
      if (!this.isSubmitted && !this._isShowingDialog) {
        this.handleViolation("หน้าต่างแบบทดสอบสูญเสียการโฟกัส");
      }
    };

    this._contextMenuHandler = (e) => {
      e.preventDefault();
      return false;
    };

    this._keyHandler = (e) => {
      // ดักจับคีย์ลัด เช่น PrintScreen, Ctrl+C, Ctrl+V, F12
      if (
        (e.ctrlKey && (e.key === "c" || e.key === "v" || e.key === "u" || e.key === "a")) ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", this._visibilityHandler);
    window.addEventListener("blur", this._blurHandler);
    document.addEventListener("contextmenu", this._contextMenuHandler);
    document.addEventListener("keydown", this._keyHandler);
  }

  detachAntiCheatListeners() {
    document.removeEventListener("visibilitychange", this._visibilityHandler);
    window.removeEventListener("blur", this._blurHandler);
    document.removeEventListener("contextmenu", this._contextMenuHandler);
    document.removeEventListener("keydown", this._keyHandler);
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  handleViolation(reason) {
    if (this.isSubmitted) return;

    // หน่วงเวลาป้องกันการตรวจจับซ้ำซ้อนจาก alert/modal (cooldown 3 วินาที)
    const now = Date.now();
    if (now - this._lastViolationTime < 3000) {
      return;
    }
    this._lastViolationTime = now;

    this.violationsCount++;
    this.onViolation({
      violationsCount: this.violationsCount,
      maxViolations: this.maxViolations,
      reason: reason
    });

    if (this.violationsCount >= this.maxViolations) {
      this.autoSubmit("ตรวจพบการสลับหน้าต่างเกินกำหนด (" + this.maxViolations + " ครั้ง) ระบบส่งข้อสอบโดยอัตโนมัติ");
    }
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

  autoSubmit(message) {
    if (this.isSubmitted) return;
    alert("⚠️ " + message);
    this.submit();
  }
}

if (typeof window !== "undefined") {
  window.AssessmentSession = AssessmentSession;
}
