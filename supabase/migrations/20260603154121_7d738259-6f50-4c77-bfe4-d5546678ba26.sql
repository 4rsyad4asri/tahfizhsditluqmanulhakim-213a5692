
-- Restrict classes write to admins
DROP POLICY IF EXISTS "Authenticated users can insert classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated users can update classes" ON public.classes;
CREATE POLICY "Admins can insert classes" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update classes" ON public.classes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Class-assignment enforcement for setoran INSERT
DROP POLICY IF EXISTS "Authenticated users can insert setoran" ON public.setoran;
CREATE POLICY "Admin or assigned penguji can insert setoran" ON public.setoran FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.class_penguji cp ON cp.class_id = s.class_id
      JOIN public.penguji p ON p.id = cp.penguji_id
      WHERE s.id = setoran.student_id AND p.user_id = auth.uid()
    )
  );

-- Class-assignment enforcement for setoran UPDATE / DELETE
DROP POLICY IF EXISTS "Authenticated users can update setoran" ON public.setoran;
DROP POLICY IF EXISTS "Authenticated users can delete setoran" ON public.setoran;
CREATE POLICY "Admin or assigned penguji can update setoran" ON public.setoran FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.class_penguji cp ON cp.class_id = s.class_id
      JOIN public.penguji p ON p.id = cp.penguji_id
      WHERE s.id = setoran.student_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.class_penguji cp ON cp.class_id = s.class_id
      JOIN public.penguji p ON p.id = cp.penguji_id
      WHERE s.id = setoran.student_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin or assigned penguji can delete setoran" ON public.setoran FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.class_penguji cp ON cp.class_id = s.class_id
      JOIN public.penguji p ON p.id = cp.penguji_id
      WHERE s.id = setoran.student_id AND p.user_id = auth.uid()
    )
  );

-- Class-assignment enforcement for ujian INSERT
DROP POLICY IF EXISTS "Authenticated users can insert ujian" ON public.ujian;
CREATE POLICY "Admin or assigned penguji can insert ujian" ON public.ujian FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.class_penguji cp ON cp.class_id = s.class_id
      JOIN public.penguji p ON p.id = cp.penguji_id
      WHERE s.id = ujian.student_id AND p.user_id = auth.uid()
    )
  );

-- Class-assignment enforcement for students UPDATE (admin or assigned penguji)
DROP POLICY IF EXISTS "Authenticated users can update students" ON public.students;
CREATE POLICY "Admin or assigned penguji can update students" ON public.students FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.class_penguji cp
      JOIN public.penguji p ON p.id = cp.penguji_id
      WHERE cp.class_id = students.class_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.class_penguji cp
      JOIN public.penguji p ON p.id = cp.penguji_id
      WHERE cp.class_id = students.class_id AND p.user_id = auth.uid()
    )
  );

-- Restrict students INSERT to admin
DROP POLICY IF EXISTS "Authenticated users can insert students" ON public.students;
CREATE POLICY "Admins can insert students" ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Hide penguji.user_id (auth UUIDs) from anonymous users — keep authenticated read
DROP POLICY IF EXISTS "Public can read penguji" ON public.penguji;
CREATE POLICY "Public can read penguji names" ON public.penguji FOR SELECT TO anon
  USING (true);
REVOKE SELECT ON public.penguji FROM anon;
GRANT SELECT (id, name, created_at) ON public.penguji TO anon;
