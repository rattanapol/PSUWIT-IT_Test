/**
 * ระบบออกและดาวน์โหลดเกียรติบัตรอิเล็กทรอนิกส์ (Certificate Engine & PDF Generator)
 * สร้างเกียรติบัตรความละเอียดสูง (300 DPI A4 แนวนอน) ด้วย HTML5 Canvas และดาวน์โหลดผ่าน jsPDF
 */

const CertificateEngine = {
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
    const canvas = targetCanvas || document.createElement("canvas");
    // อัตราส่วน A4 แนวนอน (1920 x 1357 px สำหรับความคมชัดสูง)
    canvas.width = 1920;
    canvas.height = 1357;
    const ctx = canvas.getContext("2d");

    // 1. พื้นหลังสีขาวงาช้างนวลตา
    ctx.fillStyle = "#F8FAFC";
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

    // 4. แถบสีน้ำเงิน/ทองด้านบน
    ctx.fillStyle = "#1E1B4B";
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, -180, 700, 350, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. โลโก้ตราสัญลักษณ์โรงเรียน / ตราประจำระบบ
    ctx.save();
    ctx.fillStyle = "#F59E0B";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 185, 55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1E1B4B";
    ctx.font = "bold 26px 'Prompt', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PSU", canvas.width / 2, 180);
    ctx.font = "bold 18px 'Prompt', sans-serif";
    ctx.fillText("WIT", canvas.width / 2, 204);
    ctx.restore();

    // 6. ข้อความส่วนหัว
    ctx.textAlign = "center";
    ctx.fillStyle = "#1E293B";
    ctx.font = "600 34px 'Prompt', sans-serif";
    ctx.fillText("โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)", canvas.width / 2, 290);

    ctx.font = "300 24px 'Prompt', sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน กระทรวงศึกษาธิการ", canvas.width / 2, 335);

    // 7. ชื่อเกียรติบัตร (Certificate Title)
    ctx.fillStyle = "#4338CA";
    ctx.font = "bold 46px 'Prompt', sans-serif";
    ctx.fillText("เกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า", canvas.width / 2, 425);

    // 8. ชื่อผู้รับเกียรติบัตร (Student Name)
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 56px 'Prompt', sans-serif";
    const studentTitleName = result.student_name || "นักเรียนผู้เข้าทดสอบ";
    ctx.fillText(studentTitleName, canvas.width / 2, 535);

    // เส้นคั่นสีทองใต้ชื่อ
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 350, 565);
    ctx.lineTo(canvas.width / 2 + 350, 565);
    ctx.stroke();

    // 9. รายละเอียดการทดสอบ
    ctx.fillStyle = "#334155";
    ctx.font = "400 30px 'Prompt', sans-serif";
    const gradeText = result.grade || "มัธยมศึกษา";
    const idText = result.student_id ? `(รหัสนักเรียน: ${result.student_id})` : "";
    ctx.fillText(`นักเรียนระดับชั้น${gradeText} ${idText}`, canvas.width / 2, 625);

    ctx.font = "500 32px 'Prompt', sans-serif";
    ctx.fillText(`ได้ผ่านการทดสอบวัดสมรรถนะทางเทคโนโลยีสารสนเทศ (IT Competency Assessment)`, canvas.width / 2, 680);

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

    // 10. วันที่ออกเกียรติบัตร
    ctx.fillStyle = "#475569";
    ctx.font = "400 24px 'Prompt', sans-serif";
    const thaiDate = this.formatThaiDate(result.submitted_at);
    ctx.fillText(`ให้ไว้ ณ วันที่ ${thaiDate}`, canvas.width / 2, 875);

    // 11. ตราประทับดิจิทัล (Digital Gold Seal)
    this.drawGoldSeal(ctx, canvas.width / 2, 1010, percent);

    // 12. ลายเซ็นผู้อำนวยการและหัวหน้ากลุ่มสาระฯ
    // ลายเซ็นซ้าย
    ctx.textAlign = "center";
    ctx.font = "italic 26px 'Prompt', cursive, sans-serif";
    ctx.fillStyle = "#1E293B";
    ctx.fillText("วิสุทธิ์ จิตมั่นคง", 420, 1025);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(270, 1045);
    ctx.lineTo(570, 1045);
    ctx.stroke();
    ctx.font = "500 22px 'Prompt', sans-serif";
    ctx.fillText("(นายวิสุทธิ์ จิตมั่นคง)", 420, 1080);
    ctx.font = "400 18px 'Prompt', sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("หัวหน้ากลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี", 420, 1110);

    // ลายเซ็นขวา
    ctx.font = "italic 26px 'Prompt', cursive, sans-serif";
    ctx.fillStyle = "#1E293B";
    ctx.fillText("สุรชาติ พิทักษ์ธานี", 1500, 1025);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1350, 1045);
    ctx.lineTo(1650, 1045);
    ctx.stroke();
    ctx.font = "500 22px 'Prompt', sans-serif";
    ctx.fillText("(ดร.สุรชาติ พิทักษ์ธานี)", 1500, 1080);
    ctx.font = "400 18px 'Prompt', sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("ผู้อำนวยการโรงเรียน ม.อ. วิทยานุสรณ์", 1500, 1110);

    // 13. รหัสตรวจสอบเกียรติบัตร (Certificate Verification Code)
    const certCode = this.generateCertificateCode(result.test_id, result.student_id);
    ctx.textAlign = "center";
    ctx.font = "500 18px monospace";
    ctx.fillStyle = "#64748B";
    ctx.fillText(`Certificate ID: ${certCode}  |  ตรวจสอบความถูกต้องผ่านระบบ PSU WIT IT System`, canvas.width / 2, 1260);

    return canvas;
  },

  // วาดสัญลักษณ์ประดับมุม
  drawCornerAccents(ctx, x, y, w, h) {
    const size = 35;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#D97706";

    // Top Left
    ctx.strokeRect(x + 10, y + 10, size, size);
    // Top Right
    ctx.strokeRect(x + w - size - 10, y + 10, size, size);
    // Bottom Left
    ctx.strokeRect(x + 10, y + h - size - 10, size, size);
    // Bottom Right
    ctx.strokeRect(x + w - size - 10, y + h - size - 10, size, size);
  },

  // วาดตราประทับสีทองกลางล่าง
  drawGoldSeal(ctx, cx, cy, percent) {
    ctx.save();
    // ริบบิ้น
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

    // ตรากลมทอง
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
    ctx.fillText("2026", cx, cy + 36);

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

  // ฟังก์ชันดาวน์โหลดเกียรติบัตรเป็นไฟล์ PDF คุณภาพสูง
  async downloadCertificatePDF(result) {
    try {
      const canvas = this.drawCertificateCanvas(result);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      // ตรวจสอบว่า jsPDF พร้อมใช้งานหรือไม่ หากไม่พร้อมให้ดาวน์โหลดเป็นรูปภาพเกียรติบัตรความละเอียดสูงแทน
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
      // แนวนอน (landscape), หน่วย mm, ขนาด a4 (297 x 210 mm)
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

if (typeof window !== "undefined") {
  window.CertificateEngine = CertificateEngine;
}
