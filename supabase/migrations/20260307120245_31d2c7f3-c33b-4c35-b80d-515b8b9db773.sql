
-- Re-add public/anon SELECT policies for read-only access
CREATE POLICY "Public can read classes" ON public.classes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read students" ON public.students
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read setoran" ON public.setoran
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read ujian" ON public.ujian
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read class_penguji" ON public.class_penguji
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read penguji" ON public.penguji
  FOR SELECT TO anon USING (true);
