/**
 * การตั้งค่าระบบ (Application Configuration)
 * ระบบทดสอบสมรรถนะ IT - PSU Wittayanusorn
 */

const APP_CONFIG = {
  appName: "PSU WIT IT Competency Assessment System",
  schoolName: "โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)",
  domainRequirement: "@psuwit.ac.th",
  emailRegex: /^[a-zA-Z0-9._%+-]+@psuwit\.ac\.th$/i,
  adminEmails: ["admin@psuwit.ac.th", "itadmin@psuwit.ac.th"],
  defaultAdminPasscode: "admin1234",
  
  // การตั้งค่าการสอบ
  testDurationMinutes: 15, // 15 นาที
  maxViolations: 3,        // จำนวนครั้งการสลับหน้าต่างสูงสุดก่อนส่งข้อสอบอัตโนมัติ
  certificatePassingPercent: 60, // เกณฑ์ผ่านเพื่อรับเกียรติบัตร (60% ขึ้นไปใน Post-test)
  
  gradeLevels: ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"],

  // คีย์สำหรับบันทึกลง LocalStorage
  storageKeys: {
    gasUrl: "psu_wit_gas_webapp_url",
    students: "psu_wit_students_db",
    assessments: "psu_wit_assessments_db",
    currentUser: "psu_wit_current_user",
    currentRole: "psu_wit_current_role",
    systemSettings: "psu_wit_system_settings"
  }
};

if (typeof window !== "undefined") {
  window.APP_CONFIG = APP_CONFIG;
}
