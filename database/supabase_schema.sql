-- ============================================================================
-- PSU WIT IT Competency Assessment System
-- Supabase PostgreSQL Schema, Indexes, Grants & Row-Level Security (RLS)
-- วิธีใช้งาน: คัดลอกโค้ดทั้งหมดนี้ไปวางในเมนู "SQL Editor" บน Supabase Dashboard แล้วกด Run
-- ============================================================================

-- 1. ตารางข้อมูลนักเรียน (students - รองรับผู้ใช้งาน 1,465 คนจาก user.xlsx)
CREATE TABLE IF NOT EXISTS public.students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_no TEXT DEFAULT '',
  title TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT '123456',
  grade TEXT NOT NULL CHECK (grade IN ('ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6')),
  room TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  pretest_completed BOOLEAN NOT NULL DEFAULT FALSE,
  posttest_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_grade_room ON public.students (grade, room);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students (student_id);

-- 2. ตารางประวัติผลการทดสอบสมรรถนะ IT (assessments - เก็บสะสมรายระดับชั้น ม.1-ม.3 และ ม.4-ม.6)
CREATE TABLE IF NOT EXISTS public.assessments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  test_id TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6')),
  test_type TEXT NOT NULL CHECK (test_type IN ('Pre-test', 'Post-test')),
  score_total INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 75,
  score_percent INTEGER NOT NULL DEFAULT 0,
  d1_score INTEGER NOT NULL DEFAULT 0,
  d2_score INTEGER NOT NULL DEFAULT 0,
  d3_score INTEGER NOT NULL DEFAULT 0,
  d4_score INTEGER NOT NULL DEFAULT 0,
  d5_score INTEGER NOT NULL DEFAULT 0,
  d6_score INTEGER NOT NULL DEFAULT 0,
  domain_scores_json JSONB DEFAULT '{}'::jsonb,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  violations_count INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_email_grade ON public.assessments (email, grade);
CREATE INDEX IF NOT EXISTS idx_assessments_grade ON public.assessments (grade);
CREATE INDEX IF NOT EXISTS idx_assessments_submitted_at ON public.assessments (submitted_at DESC);

-- 3. ตารางข้อมูลผู้ดูแลระบบ (admins)
CREATE TABLE IF NOT EXISTS public.admins (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT DEFAULT '',
  title TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT '123456',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ตารางตั้งค่าระบบ (system_settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. กำหนดสิทธิ์การเข้าถึงผ่าน Supabase Data API (PostgREST) สำหรับ role anon และ authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 6. เปิดใช้งาน Row Level Security (RLS) และสร้าง Policy สำหรับเว็บแอปพลิเคชัน
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psuwit_students_access" ON public.students;
CREATE POLICY "psuwit_students_access" ON public.students
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "psuwit_assessments_access" ON public.assessments;
CREATE POLICY "psuwit_assessments_access" ON public.assessments
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "psuwit_admins_access" ON public.admins;
CREATE POLICY "psuwit_admins_access" ON public.admins
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "psuwit_settings_access" ON public.system_settings;
CREATE POLICY "psuwit_settings_access" ON public.system_settings
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 7. เพิ่มข้อมูลผู้ดูแลระบบเริ่มต้น 3 ท่าน (จาก user.xlsx)
INSERT INTO public.admins (student_id, title, first_name, last_name, name, email, username, password, role)
VALUES
  ('50015', 'นาย', 'วินัย', 'รัตนพล', 'นายวินัย รัตนพล', 'winai@psuwit.ac.th', 'winai@psuwit.ac.th', '123456', 'super_admin'),
  ('53001', 'นางสาว', 'กนก', 'กล่อมขจิต', 'นางสาวกนก กล่อมขจิต', 'knok@psuwit.ac.th', 'knok@psuwit.ac.th', '123456', 'admin'),
  ('1', 'นาย', 'ดูแลระบบ', 'เทพสุดสุด', 'นายดูแลระบบ เทพสุดสุด', '00001@psuwit.ac.th', '00001@psuwit.ac.th', '123456', 'super_admin')
ON CONFLICT (email) DO NOTHING;
