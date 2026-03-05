
-- ===== CLASSES: Drop public policies, add authenticated =====
DROP POLICY IF EXISTS "Classes are publicly readable" ON classes;
DROP POLICY IF EXISTS "Classes are publicly insertable" ON classes;
DROP POLICY IF EXISTS "Classes are publicly updatable" ON classes;

CREATE POLICY "Authenticated users can read classes" ON classes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert classes" ON classes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update classes" ON classes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ===== STUDENTS: Drop public policies, add authenticated =====
DROP POLICY IF EXISTS "Students are publicly readable" ON students;
DROP POLICY IF EXISTS "Students are publicly insertable" ON students;
DROP POLICY IF EXISTS "Students are publicly updatable" ON students;
DROP POLICY IF EXISTS "Students are publicly deletable" ON students;

CREATE POLICY "Authenticated users can read students" ON students
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert students" ON students
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update students" ON students
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete students" ON students
  FOR DELETE TO authenticated USING (true);

-- ===== SETORAN: Drop public policies, add authenticated =====
DROP POLICY IF EXISTS "Setoran is publicly readable" ON setoran;
DROP POLICY IF EXISTS "Setoran is publicly insertable" ON setoran;
DROP POLICY IF EXISTS "Setoran is publicly updatable" ON setoran;
DROP POLICY IF EXISTS "Setoran is publicly deletable" ON setoran;

CREATE POLICY "Authenticated users can read setoran" ON setoran
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert setoran" ON setoran
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update setoran" ON setoran
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete setoran" ON setoran
  FOR DELETE TO authenticated USING (true);

-- ===== UJIAN: Drop public policies, add authenticated =====
DROP POLICY IF EXISTS "Ujian is publicly readable" ON ujian;
DROP POLICY IF EXISTS "Ujian is publicly insertable" ON ujian;
DROP POLICY IF EXISTS "Ujian is publicly updatable" ON ujian;
DROP POLICY IF EXISTS "Ujian is publicly deletable" ON ujian;

CREATE POLICY "Authenticated users can read ujian" ON ujian
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ujian" ON ujian
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ujian" ON ujian
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ujian" ON ujian
  FOR DELETE TO authenticated USING (true);

-- ===== INPUT VALIDATION: ayat range constraint =====
ALTER TABLE setoran ADD CONSTRAINT check_ayat_range CHECK (ayat_akhir >= ayat_mulai);
