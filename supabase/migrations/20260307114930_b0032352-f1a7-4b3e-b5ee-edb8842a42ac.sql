
-- 1. Remove anon SELECT policies from PII tables
DROP POLICY IF EXISTS "Public can read students" ON public.students;
DROP POLICY IF EXISTS "Public can read setoran" ON public.setoran;
DROP POLICY IF EXISTS "Public can read ujian" ON public.ujian;
DROP POLICY IF EXISTS "Public can read class_penguji" ON public.class_penguji;
DROP POLICY IF EXISTS "Public can read penguji" ON public.penguji;
DROP POLICY IF EXISTS "Public can read classes" ON public.classes;

-- 2. Restrict ujian UPDATE/DELETE to admin only
DROP POLICY IF EXISTS "Authenticated users can update ujian" ON public.ujian;
DROP POLICY IF EXISTS "Authenticated users can delete ujian" ON public.ujian;

CREATE POLICY "Admins can update ujian" ON public.ujian
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ujian" ON public.ujian
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3. Restrict students UPDATE to role-based: admin can update all, penguji can update non-status fields
-- Since column-level RLS isn't possible, we restrict students DELETE to admin only
DROP POLICY IF EXISTS "Authenticated users can delete students" ON public.students;

CREATE POLICY "Admins can delete students" ON public.students
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
