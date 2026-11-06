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
  async start() {
    this.startTimer();
    this.attachAntiCheatListeners();
    await this.requestExamFullscreen();
  }

  // ร้องขอโหมดเต็มหน้าจอและล็อกคีย์บอร์ด
  async requestExamFullscreen() {
    const docEl = document.documentElement;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      this.isInFullscreen = true;
      await this.lockKeyboard();
    } catch (err) {
      console.warn("Fullscreen request not permitted or blocked:", err);
    }
  }

  // ออกจากโหมดเต็มหน้าจอและปลดล็อกคีย์บอร์ด
  async exitExamFullscreen() {
    this.unlockKeyboard();
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Exit fullscreen error:", err);
    }
    this.isInFullscreen = false;
  }

  // ระบบล็อกคีย์บอร์ดระดับเบราว์เซอร์ (Keyboard Lock API - Chrome / Edge)
  async lockKeyboard() {
    if (navigator.keyboard && typeof navigator.keyboard.lock === "function") {
      try {
        await navigator.keyboard.lock(["Escape", "Tab", "AltLeft", "AltRight", "MetaLeft", "MetaRight"]);
      } catch (err) {
        console.warn("Keyboard lock failed:", err);
      }
    }
  }

  unlockKeyboard() {
    if (navigator.keyboard && typeof navigator.keyboard.unlock === "function") {
      try {
        navigator.keyboard.unlock();
      } catch (err) {
        console.warn("Keyboard unlock failed:", err);
      }
    }
  }

  // สัญญาณเสียงเตือนภัยเมื่อพยายามสลับหน้าต่าง (Web Audio API Synthesizer)
  playAlarmBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {
      // AudioContext might be blocked until user gesture, safely ignore
    }
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

  // ระบบตรวจจับการโกงและการสลับหน้าต่าง (Strict Anti-Cheat & Lockdown Trap)
  attachAntiCheatListeners() {
    this._lastViolationTime = 0;
    this._isLockedOut = false;

    // 1. ตรวจจับการซ่อนแท็บ / สลับหน้าต่าง
    this._visibilityHandler = () => {
      if (document.hidden && !this.isSubmitted) {
        this.handleViolation("ตรวจพบการสลับหน้าต่างโปรแกรม หรือเปิดแท็บอื่น");
      }
    };

    // 2. ตรวจจับการสูญเสียโฟกัสของหน้าต่าง (Window Blur)
    this._blurHandler = () => {
      if (!this.isSubmitted && !this._isShowingDialog) {
        this.handleViolation("ตรวจพบการคลิกออกจากหน้าต่างแบบทดสอบ หรือสลับโปรแกรม");
      }
    };

    // 3. เมื่อหน้าต่างกลับมาโฟกัส
    this._focusHandler = () => {
      if (this.isSubmitted) return;
      const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      if (isFull && this._isLockedOut) {
        this.resolveLockdown();
      }
    };

    // 4. ตรวจจับการออกจากโหมดเต็มหน้าจอ (Fullscreen Break)
    this._fullscreenHandler = () => {
      if (this.isSubmitted) return;
      const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      this.isInFullscreen = isFull;
      if (!isFull) {
        this.handleViolation("ออกจากโหมดเต็มหน้าจอ (Fullscreen Exited)");
      } else {
        if (this._isLockedOut) {
          this.resolveLockdown();
        }
      }
    };

    // 5. บล็อกคลิกขวา (Context Menu)
    this._contextMenuHandler = (e) => {
      e.preventDefault();
      return false;
    };

    // 6. บล็อกการเลือกข้อความ (Select Start)
    this._selectStartHandler = (e) => {
      e.preventDefault();
      return false;
    };

    // 7. ดักจับและบล็อกปุ่มคีย์ลัดระบบทั้งหมด (Capture Phase)
    this._keyHandler = (e) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const isAlt = e.altKey || key === "alt";
      const isMeta = e.metaKey || key === "meta";
      const isCtrl = e.ctrlKey || key === "control";

      // บล็อก Alt, Windows/Command keys ทุกกรณี (ป้องกัน Alt+Tab, Alt+F4)
      if (isAlt || isMeta) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // บล็อกเบราว์เซอร์ช็อตคัต: Ctrl+T, Ctrl+N, Ctrl+W, Ctrl+R, Ctrl+U, Ctrl+S, Ctrl+P, Ctrl+H, Ctrl+J
      if (isCtrl && ["t", "n", "w", "r", "u", "s", "p", "h", "j"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // บล็อก DevTools: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (key === "f12" || (isCtrl && e.shiftKey && ["i", "j", "c"].includes(key))) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // บล็อก F11 (Fullscreen toggle) และ F5 (Reload)
      if (key === "f11" || key === "f5") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // บล็อก Escape key จากการยกเลิก Fullscreen
      if (key === "escape") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // บล็อกการคัดลอก/ตัด/วาง: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A
      if (isCtrl && ["c", "v", "x", "a"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // บล็อก PrintScreen
      if (key === "printscreen") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 8. ป้องกันการปิดแท็บหรือรีเฟรชโดยไม่ตั้งใจ (BeforeUnload)
    this._beforeUnloadHandler = (e) => {
      if (!this.isSubmitted) {
        e.preventDefault();
        e.returnValue = "ระบบกำลังอยู่ในโหมดทำแบบทดสอบ หากปิดหน้านี้ผลสอบจะไม่ได้รับการบันทึก";
        return e.returnValue;
      }
    };

    document.addEventListener("visibilitychange", this._visibilityHandler);
    window.addEventListener("blur", this._blurHandler);
    window.addEventListener("focus", this._focusHandler);
    document.addEventListener("fullscreenchange", this._fullscreenHandler);
    document.addEventListener("webkitfullscreenchange", this._fullscreenHandler);
    document.addEventListener("mozfullscreenchange", this._fullscreenHandler);
    document.addEventListener("MSFullscreenChange", this._fullscreenHandler);
    document.addEventListener("contextmenu", this._contextMenuHandler);
    document.addEventListener("selectstart", this._selectStartHandler);
    window.addEventListener("keydown", this._keyHandler, { capture: true });
    window.addEventListener("beforeunload", this._beforeUnloadHandler);
  }

  detachAntiCheatListeners() {
    document.removeEventListener("visibilitychange", this._visibilityHandler);
    window.removeEventListener("blur", this._blurHandler);
    window.removeEventListener("focus", this._focusHandler);
    document.removeEventListener("fullscreenchange", this._fullscreenHandler);
    document.removeEventListener("webkitfullscreenchange", this._fullscreenHandler);
    document.removeEventListener("mozfullscreenchange", this._fullscreenHandler);
    document.removeEventListener("MSFullscreenChange", this._fullscreenHandler);
    document.removeEventListener("contextmenu", this._contextMenuHandler);
    document.removeEventListener("selectstart", this._selectStartHandler);
    window.removeEventListener("keydown", this._keyHandler, { capture: true });
    window.removeEventListener("beforeunload", this._beforeUnloadHandler);
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  // ปลดล็อกหน้าจอเมื่อนักเรียนกลับเข้าสู่โหมดเต็มหน้าจออย่างถูกต้อง หรือส่งข้อสอบ
  resolveLockdown() {
    this._isLockedOut = false;
    document.body.classList.remove("exam-blurred");
    document.body.classList.remove("exam-lockdown-active");
    const overlay = document.getElementById("examLockdownOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  }

  handleViolation(reason) {
    if (this.isSubmitted) return;

    // ส่งเสียงเตือนภัยทันที
    this.playAlarmBeep();

    // ล็อกหน้าจอทันทีและเบลอคำถามข้างหลัง
    this._isLockedOut = true;
    document.body.classList.add("exam-blurred");

    // หน่วงเวลาป้องกันการตรวจจับซ้ำซ้อนของ blur + visibilitychange (cooldown 2 วินาที)
    const now = Date.now();
    if (now - this._lastViolationTime >= 2000) {
      this.violationsCount++;
      this._lastViolationTime = now;
    }

    this.onViolation({
      violationsCount: this.violationsCount,
      maxViolations: this.maxViolations,
      reason: reason,
      isLockedOut: true
    });

    if (this.violationsCount >= this.maxViolations) {
      this.autoSubmit("ตรวจพบการสลับหน้าต่างหรือออกจากโหมดล็อกเกินกำหนด (" + this.maxViolations + " ครั้ง) ระบบส่งข้อสอบโดยอัตโนมัติ");
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
    this.resolveLockdown();
    this.exitExamFullscreen();
    const result = this.calculateResults();
    this.onSubmit(result);
    return result;
  }

  autoSubmit(message) {
    if (this.isSubmitted) return;
    this._isShowingDialog = true;
    try {
      alert("⚠️ " + message);
    } finally {
      this._isShowingDialog = false;
      this.submit();
    }
  }
}

if (typeof window !== "undefined") {
  window.AssessmentSession = AssessmentSession;
}
