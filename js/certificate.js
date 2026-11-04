/**
 * ระบบออกและดาวน์โหลดเกียรติบัตรอิเล็กทรอนิกส์ (Certificate Engine & PDF Generator)
 * สร้างเกียรติบัตรความละเอียดสูง (300 DPI A4 แนวนอน) ด้วย HTML5 Canvas และดาวน์โหลดผ่าน jsPDF
 * ใช้โลโก้โรงเรียน PSUWIT_Logo.jpg
 */

const PSUWIT_LOGO_DATA_URI = "data:image/jpeg;base64,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";

const CertificateEngine = {
  _logoImg: null,
  _logoLoaded: false,

  initLogo() {
    if (typeof Image === "undefined") return;
    if (this._logoImg) return;
    const img = new Image();
    img.onload = () => {
      this._logoLoaded = true;
    };
    img.onerror = () => {
      if (img.src !== "PSUWIT_Logo.jpg") {
        img.src = "PSUWIT_Logo.jpg";
      }
    };
    img.src = PSUWIT_LOGO_DATA_URI.startsWith("data:") ? PSUWIT_LOGO_DATA_URI : "PSUWIT_Logo.jpg";
    this._logoImg = img;
  },

  // แปลงวันที่เป็นรูปแบบภาษาไทย
  formatThaiDate(dateString) {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const d = dateString ? new Date(dateString) : new Date();
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} พ.ศ. ${year}`;
  },

  // สร้างรหัสเกียรติบัตรที่ไม่ซ้ำ
  generateCertificateCode(testId, studentId) {
    const raw = `${testId || ""}-${studentId || ""}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const cleanHash = Math.abs(hash).toString(36).toUpperCase().padStart(6, "0");
    return `PSUWIT-IT-2026-${cleanHash}`;
  },

  // ประเมินระดับผลการเรียนรู้
  getProficiencyLevel(percent) {
    if (percent >= 85) return "ระดับดีเยี่ยม (Distinction)";
    if (percent >= 70) return "ระดับดีมาก (Very Good)";
    if (percent >= 60) return "ระดับผ่านเกณฑ์มาตรฐาน (Passed)";
    return "ระดับพัฒนาการ (Developing)";
  },

  // วาดเกียรติบัตรลงใน Canvas ด้วยความละเอียดสูง
  drawCertificateCanvas(result, targetCanvas) {
    this.initLogo();
    const canvas = targetCanvas || document.createElement("canvas");
    // อัตราส่วน A4 แนวนอน (1920 x 1357 px สำหรับความคมชัดสูง)
    canvas.width = 1920;
    canvas.height = 1357;
    const ctx = canvas.getContext("2d");

    // 1. พื้นหลังสีขาวสะอาด
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. ลวดลายกรอบชั้นนอก (Outer Navy Border)
    ctx.strokeStyle = "#0B132B";
    ctx.lineWidth = 18;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    // 3. กรอบสีทองพรีเมียม (Gold Inner Border)
    const goldGrad = ctx.createLinearGradient(60, 60, canvas.width - 60, canvas.height - 60);
    goldGrad.addColorStop(0, "#D97706");
    goldGrad.addColorStop(0.5, "#FDE68A");
    goldGrad.addColorStop(1, "#B45309");

    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 6;
    ctx.strokeRect(55, 55, canvas.width - 110, canvas.height - 110);

    // ลวดลายประดับมุมกรอบทั้ง 4 ด้าน
    this.drawCornerAccents(ctx, 55, 55, canvas.width - 110, canvas.height - 110);

    // 4. วาดโลโก้โรงเรียน PSUWIT_Logo.jpg ด้านบนตรงกลาง
    if (this._logoImg && (this._logoLoaded || this._logoImg.complete) && this._logoImg.naturalWidth > 0) {
      const targetH = 195;
      const ratio = this._logoImg.naturalWidth / this._logoImg.naturalHeight;
      const targetW = targetH * ratio;
      ctx.drawImage(this._logoImg, (canvas.width - targetW) / 2, 75, targetW, targetH);
    } else if (this._logoImg) {
      this._logoImg.onload = () => {
        this._logoLoaded = true;
        if (targetCanvas) {
          this.drawCertificateCanvas(result, targetCanvas);
        }
      };
    }

    // 5. ข้อความส่วนหัวโรงเรียน
    ctx.textAlign = "center";
    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 36px 'Prompt', sans-serif";
    ctx.fillText("โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)", canvas.width / 2, 315);

    ctx.font = "400 24px 'Prompt', sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("โครงการประเมินสมรรถนะทางเทคโนโลยีสารสนเทศ (IT Competency Assessment)", canvas.width / 2, 358);

    // 6. ชื่อเกียรติบัตร (Certificate Title)
    ctx.fillStyle = "#4338CA";
    ctx.font = "bold 44px 'Prompt', sans-serif";
    ctx.fillText("เกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า", canvas.width / 2, 438);

    // 7. ชื่อผู้รับเกียรติบัตร (Student Name)
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 54px 'Prompt', sans-serif";
    const studentTitleName = result.student_name || "นักเรียนผู้เข้าทดสอบ";
    ctx.fillText(studentTitleName, canvas.width / 2, 540);

    // เส้นคั่นสีทองใต้ชื่อ
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 350, 568);
    ctx.lineTo(canvas.width / 2 + 350, 568);
    ctx.stroke();

    // 8. รายละเอียดการทดสอบ
    ctx.fillStyle = "#334155";
    ctx.font = "400 30px 'Prompt', sans-serif";
    const gradeText = result.grade || "มัธยมศึกษา";
    const idText = result.student_id ? `(รหัสนักเรียน: ${result.student_id})` : "";
    ctx.fillText(`นักเรียนระดับชั้นมัธยมศึกษาปีที่ ${gradeText.replace("ม.", "")} (${gradeText}) ${idText}`, canvas.width / 2, 628);

    ctx.font = "500 32px 'Prompt', sans-serif";
    ctx.fillText("ได้ผ่านการทดสอบวัดสมรรถนะทางเทคโนโลยีสารสนเทศ (IT Competency Assessment)", canvas.width / 2, 682);

    // กล่องแสดงคะแนนและระดับ
    ctx.fillStyle = "#EEF2FF";
    ctx.strokeStyle = "#C7D2FE";
    ctx.lineWidth = 2;
    this.roundRect(ctx, canvas.width / 2 - 380, 725, 760, 85, 14, true, true);

    const percent = result.score_percent || 0;
    const level = this.getProficiencyLevel(percent);
    ctx.fillStyle = "#312E81";
    ctx.font = "bold 34px 'Prompt', sans-serif";
    ctx.fillText(`ผลการประเมิน: ${percent}%  •  ${level}`, canvas.width / 2, 780);

    // 9. วันที่ออกเกียรติบัตร
    ctx.fillStyle = "#475569";
    ctx.font = "400 24px 'Prompt', sans-serif";
    const thaiDate = this.formatThaiDate(result.submitted_at);
    ctx.fillText(`ให้ไว้ ณ วันที่ ${thaiDate}`, canvas.width / 2, 875);

    // 10. ตราประทับดิจิทัล (Digital Gold Seal)
    this.drawGoldSeal(ctx, canvas.width / 2, 1015, percent);

    // 11. ลายเซ็นหัวหน้ากลุ่มสาระฯ และผู้อำนวยการโรงเรียน
    // ลายเซ็นซ้าย: นายวีระวัฒน์ วงศ์เมฆ (หัวหน้ากลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี)
    ctx.textAlign = "center";
    ctx.font = "italic 26px 'Prompt', cursive, sans-serif";
    ctx.fillStyle = "#1E293B";
    ctx.fillText("วีระวัฒน์ วงศ์เมฆ", 430, 1025);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(260, 1045);
    ctx.lineTo(600, 1045);
    ctx.stroke();
    ctx.font = "600 22px 'Prompt', sans-serif";
    ctx.fillStyle = "#0F172A";
    ctx.fillText("(นายวีระวัฒน์ วงศ์เมฆ)", 430, 1082);
    ctx.font = "400 18px 'Prompt', sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText("หัวหน้ากลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี", 430, 1114);

    // ลายเซ็นขวา: นายสุชาติ สุขะพันธ์ (ผู้อำนวยการโรงเรียน มอ.วิทยานุสรณ์)
    ctx.font = "italic 26px 'Prompt', cursive, sans-serif";
    ctx.fillStyle = "#1E293B";
    ctx.fillText("สุชาติ สุขะพันธ์", 1490, 1025);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1320, 1045);
    ctx.lineTo(1660, 1045);
    ctx.stroke();
    ctx.font = "600 22px 'Prompt', sans-serif";
    ctx.fillStyle = "#0F172A";
    ctx.fillText("(นายสุชาติ สุขะพันธ์)", 1490, 1082);
    ctx.font = "400 18px 'Prompt', sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText("ผู้อำนวยการโรงเรียน มอ.วิทยานุสรณ์", 1490, 1114);

    // 12. รหัสตรวจสอบเกียรติบัตร (Certificate Verification Code)
    const certCode = this.generateCertificateCode(result.test_id, result.student_id);
    ctx.textAlign = "center";
    ctx.font = "500 18px monospace";
    ctx.fillStyle = "#64748B";
    ctx.fillText(`Certificate ID: ${certCode}  |  ตรวจสอบความถูกต้องผ่านระบบ PSU WIT IT System`, canvas.width / 2, 1260);

    return canvas;
  },

  drawCornerAccents(ctx, x, y, w, h) {
    const size = 35;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#D97706";

    ctx.strokeRect(x + 10, y + 10, size, size);
    ctx.strokeRect(x + w - size - 10, y + 10, size, size);
    ctx.strokeRect(x + 10, y + h - size - 10, size, size);
    ctx.strokeRect(x + w - size - 10, y + h - size - 10, size, size);
  },

  drawGoldSeal(ctx, cx, cy, percent) {
    ctx.save();
    ctx.fillStyle = "#DC2626";
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy + 30);
    ctx.lineTo(cx - 50, cy + 110);
    ctx.lineTo(cx - 20, cy + 90);
    ctx.lineTo(cx, cy + 110);
    ctx.lineTo(cx + 20, cy + 90);
    ctx.lineTo(cx + 50, cy + 110);
    ctx.lineTo(cx + 25, cy + 30);
    ctx.closePath();
    ctx.fill();

    const sealGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 60);
    sealGrad.addColorStop(0, "#FDE68A");
    sealGrad.addColorStop(0.7, "#F59E0B");
    sealGrad.addColorStop(1, "#B45309");

    ctx.fillStyle = sealGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#78350F";
    ctx.font = "bold 16px 'Prompt', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CERTIFIED", cx, cy - 10);
    ctx.font = "bold 22px 'Prompt', sans-serif";
    ctx.fillText("PASSED", cx, cy + 16);
    ctx.font = "bold 14px 'Prompt', sans-serif";
    ctx.fillText("PSU WIT", cx, cy + 36);

    ctx.restore();
  },

  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  },

  async downloadCertificatePDF(result) {
    try {
      this.initLogo();
      if (this._logoImg && !this._logoLoaded && !this._logoImg.complete) {
        await new Promise((res) => {
          this._logoImg.onload = () => {
            this._logoLoaded = true;
            res();
          };
          this._logoImg.onerror = () => res();
        });
      }
      const canvas = this.drawCertificateCanvas(result);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (!window.jspdf || !window.jspdf.jsPDF) {
        const link = document.createElement("a");
        const studentNameClean = (result.student_name || "student").replace(/\s+/g, "_");
        link.download = `Certificate_${studentNameClean}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        alert("กำลังดาวน์โหลดเกียรติบัตรเป็นภาพความละเอียดสูง (PNG)");
        return true;
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      pdf.addImage(imgData, "JPEG", 0, 0, 297, 210);
      const studentNameClean = (result.student_name || "student").replace(/\s+/g, "_");
      const gradeClean = (result.grade || "grade").replace(/\s+/g, "");
      const fileName = `Certificate_${gradeClean}_${studentNameClean}.pdf`;
      pdf.save(fileName);
      return true;
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: " + err.message);
      return false;
    }
  }
};

CertificateEngine.initLogo();

if (typeof window !== "undefined") {
  window.CertificateEngine = CertificateEngine;
}
