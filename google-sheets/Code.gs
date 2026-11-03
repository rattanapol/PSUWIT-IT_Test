/**
 * ==============================================================================
 * ระบบทดสอบสมรรถนะ IT สำหรับนักเรียนระดับมัธยมศึกษา (ม.1 - ม.6)
 * PSU Wittayanusorn IT Competency Assessment System (Google Apps Script Backend)
 * ==============================================================================
 * คำแนะนำการติดตั้ง:
 * 1. สร้าง Google Sheet ใหม่ แล้วไปที่ ส่วนขยาย (Extensions) > Apps Script
 * 2. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้ลงไป
 * 3. กด Deploy > New deployment > เลือกประเภท Web app
 * 4. ตั้งค่า:
 *    - Execute as: Me (อีเมลของคุณ)
 *    - Who has access: Anyone (ทุกคน)
 * 5. กด Deploy แล้วคัดลอก Web App URL ไปใส่ในหน้าตั้งค่า Admin ของระบบ
 * ==============================================================================
 */

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet: Students
  let studentSheet = ss.getSheetByName("Students");
  if (!studentSheet) {
    studentSheet = ss.insertSheet("Students");
    studentSheet.appendRow([
      "student_id",
      "name",
      "email",
      "grade",
      "status",
      "pretest_completed",
      "posttest_completed",
      "created_at"
    ]);
    studentSheet.getRange("A1:H1").setFontWeight("bold").setBackground("#4F46E5").setFontColor("#FFFFFF");
    
    // ข้อมูลตัวอย่างเริ่มต้น
    studentSheet.appendRow(["s641001", "นายสมชาย ใจดี", "s641001@psuwit.ac.th", "ม.1", "active", "true", "false", new Date().toISOString()]);
    studentSheet.appendRow(["s641002", "น.ส.วิภาดา รักเรียน", "wiphada@psuwit.ac.th", "ม.4", "active", "true", "true", new Date().toISOString()]);
  }

  // 2. Sheet: Assessments
  let testSheet = ss.getSheetByName("Assessments");
  if (!testSheet) {
    testSheet = ss.insertSheet("Assessments");
    testSheet.appendRow([
      "test_id",
      "student_id",
      "student_name",
      "email",
      "grade",
      "test_type",
      "score_total",
      "max_score",
      "score_percent",
      "d1_score",
      "d2_score",
      "d3_score",
      "d4_score",
      "d5_score",
      "d6_score",
      "time_spent_seconds",
      "violations_count",
      "passed",
      "submitted_at"
    ]);
    testSheet.getRange("A1:S1").setFontWeight("bold").setBackground("#059669").setFontColor("#FFFFFF");
  }

  // 3. Sheet: Logs
  let logSheet = ss.getSheetByName("Logs");
  if (!logSheet) {
    logSheet = ss.insertSheet("Logs");
    logSheet.appendRow(["timestamp", "email", "action", "details"]);
    logSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#334155").setFontColor("#FFFFFF");
  }

  return "ตั้งค่าฐานข้อมูล Google Sheets สำเร็จเรียบร้อย!";
}

// รับคำขอ GET (สำหรับดึงข้อมูล)
function doGet(e) {
  try {
    const action = e.parameter.action || "get_all";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "ping") {
      return responseJSON({ status: "success", message: "Google Sheets API Connected Successfully" });
    }

    if (action === "get_students") {
      const sheet = ss.getSheetByName("Students");
      const data = sheetToObjects(sheet);
      return responseJSON({ status: "success", data: data });
    }

    if (action === "get_assessments") {
      const sheet = ss.getSheetByName("Assessments");
      const grade = e.parameter.grade;
      let data = sheetToObjects(sheet);
      if (grade && grade !== "all") {
        data = data.filter(item => item.grade === grade);
      }
      return responseJSON({ status: "success", data: data });
    }

    if (action === "get_student_history") {
      const email = e.parameter.email;
      const sheet = ss.getSheetByName("Assessments");
      let data = sheetToObjects(sheet);
      if (email) {
        data = data.filter(item => item.email.toLowerCase() === email.toLowerCase());
      }
      return responseJSON({ status: "success", data: data });
    }

    // Default: ดึงทั้ง students และ assessments
    const studentsSheet = ss.getSheetByName("Students");
    const assessmentsSheet = ss.getSheetByName("Assessments");
    return responseJSON({
      status: "success",
      students: sheetToObjects(studentsSheet),
      assessments: sheetToObjects(assessmentsSheet)
    });
  } catch (error) {
    return responseJSON({ status: "error", message: error.toString() });
  }
}

// รับคำขอ POST (สำหรับบันทึกข้อมูล)
function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const body = JSON.parse(rawData);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "submit_assessment") {
      const sheet = ss.getSheetByName("Assessments");
      const test = body.data;
      
      const newRow = [
        test.test_id || ("T-" + new Date().getTime()),
        test.student_id || "",
        test.student_name || "",
        test.email || "",
        test.grade || "",
        test.test_type || "Pre-test",
        test.score_total || 0,
        test.max_score || 0,
        test.score_percent || 0,
        test.d1_score || 0,
        test.d2_score || 0,
        test.d3_score || 0,
        test.d4_score || 0,
        test.d5_score || 0,
        test.d6_score || 0,
        test.time_spent_seconds || 0,
        test.violations_count || 0,
        test.passed ? "TRUE" : "FALSE",
        new Date().toISOString()
      ];
      sheet.appendRow(newRow);

      // อัปเดตสถานะในตาราง Students ด้วย
      updateStudentProgress(ss, test.email, test.test_type);

      return responseJSON({ status: "success", message: "บันทึกผลการทดสอบสำเร็จ", test_id: newRow[0] });
    }

    if (action === "save_student") {
      const sheet = ss.getSheetByName("Students");
      const student = body.data;
      const data = sheetToObjects(sheet);
      const existingIndex = data.findIndex(s => s.email.toLowerCase() === student.email.toLowerCase());

      if (existingIndex >= 0) {
        // แก้ไข
        const row = existingIndex + 2;
        sheet.getRange(row, 1, 1, 5).setValues([[
          student.student_id,
          student.name,
          student.email,
          student.grade,
          student.status || "active"
        ]]);
        return responseJSON({ status: "success", message: "แก้ไขข้อมูลนักเรียนสำเร็จ" });
      } else {
        // เพิ่มใหม่
        sheet.appendRow([
          student.student_id,
          student.name,
          student.email,
          student.grade,
          student.status || "active",
          "false",
          "false",
          new Date().toISOString()
        ]);
        return responseJSON({ status: "success", message: "เพิ่มนักเรียนใหม่สำเร็จ" });
      }
    }

    if (action === "delete_student") {
      const sheet = ss.getSheetByName("Students");
      const email = body.email;
      const data = sheetToObjects(sheet);
      const existingIndex = data.findIndex(s => s.email.toLowerCase() === email.toLowerCase());
      if (existingIndex >= 0) {
        sheet.deleteRow(existingIndex + 2);
        return responseJSON({ status: "success", message: "ลบผู้ใช้สำเร็จ" });
      }
      return responseJSON({ status: "error", message: "ไม่พบผู้ใช้ที่ต้องการลบ" });
    }

    if (action === "reset_attempts") {
      const sheet = ss.getSheetByName("Students");
      const email = body.email;
      const data = sheetToObjects(sheet);
      const existingIndex = data.findIndex(s => s.email.toLowerCase() === email.toLowerCase());
      if (existingIndex >= 0) {
        const row = existingIndex + 2;
        sheet.getRange(row, 6, 1, 2).setValues([["false", "false"]]);
        return responseJSON({ status: "success", message: "รีเซ็ตสิทธิ์การสอบสำเร็จ" });
      }
      return responseJSON({ status: "error", message: "ไม่พบผู้ใช้" });
    }

    return responseJSON({ status: "error", message: "ไม่พบคำสั่งที่ระบุ: " + action });
  } catch (error) {
    return responseJSON({ status: "error", message: error.toString() });
  }
}

// ฟังก์ชันแปลง Sheet เป็น Object Array
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0];
  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    results.push(obj);
  }
  return results;
}

// อัปเดตสถานะการทำแบบทดสอบ
function updateStudentProgress(ss, email, testType) {
  const sheet = ss.getSheetByName("Students");
  if (!sheet) return;
  const data = sheetToObjects(sheet);
  const index = data.findIndex(s => s.email.toLowerCase() === email.toLowerCase());
  if (index >= 0) {
    const row = index + 2;
    if (testType === "Pre-test") {
      sheet.getRange(row, 6).setValue("true");
    } else {
      sheet.getRange(row, 7).setValue("true");
    }
  }
}

// ช่วยส่ง Response กลับเป็น JSON และรองรับ CORS
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
