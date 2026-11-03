/**
 * การตั้งค่าระบบ (Application Configuration)
 * ระบบทดสอบสมรรถนะ IT - PSU Wittayanusorn
 */

const APP_CONFIG = {
  appName: "PSU WIT IT Competency Assessment System",
  schoolName: "โรงเรียน ม.อ. วิทยานุสรณ์ (PSU Wittayanusorn School)",
  domainRequirement: "@psuwit.ac.th",
  hostedDomain: "psuwit.ac.th",

  // Google OAuth 2.0 Client ID (สามารถตั้งค่าได้ที่นี่ หรือตั้งค่าผ่านหน้า Admin Dashboard)
  // ตัวอย่าง: "1234567890-abcdefg.apps.googleusercontent.com"
  googleClientId: "",

  // รูปแบบอีเมลองค์กรของนักเรียน: รหัสนักเรียน 4 หลัก@psuwit.ac.th (หรืออีเมลองค์กร @psuwit.ac.th)
  studentSsoRegex: /^[0-9]{4}@psuwit\.ac\.th$/i,
  orgEmailRegex: /^[a-zA-Z0-9._%+-]+@psuwit\.ac\.th$/i,
  emailRegex: /^[a-zA-Z0-9._%+-]+@psuwit\.ac\.th$/i,
  primaryAdminEmail: "winai@psuwit.ac.th",
  adminEmails: ["winai@psuwit.ac.th"],
  defaultAdminPasscode: "admin1234",
  
  // การตั้งค่าการสอบ
  testDurationMinutes: 15, // 15 นาที
  maxViolations: 3,        // จำนวนครั้งการสลับหน้าต่างสูงสุดก่อนส่งข้อสอบอัตโนมัติ
  certificatePassingPercent: 60, // เกณฑ์ผ่านเพื่อรับเกียรติบัตร (60% ขึ้นไป)
  
  gradeLevels: ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"],

  // คีย์สำหรับบันทึกลง LocalStorage
  storageKeys: {
    gasUrl: "psu_wit_gas_webapp_url",
    googleClientId: "psu_wit_google_client_id",
    strictFourDigitId: "psu_wit_strict_4digit_id",
    students: "psu_wit_students_db",
    assessments: "psu_wit_assessments_db",
    admins: "psu_wit_admins_db",
    currentUser: "psu_wit_current_user",
    currentRole: "psu_wit_current_role",
    systemSettings: "psu_wit_system_settings"
  }
};

if (typeof window !== "undefined") {
  window.APP_CONFIG = APP_CONFIG;
}
