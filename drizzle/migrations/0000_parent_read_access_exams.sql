CREATE POLICY "Parents can read their children ujian"
ON public.ujian
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_students ps
  WHERE ps.student_id = ujian.student_id
    AND ps.parent_user_id = auth.uid()
));

CREATE POLICY "Parents can read their children setoran"
ON public.setoran
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_students ps
  WHERE ps.student_id = setoran.student_id
    AND ps.parent_user_id = auth.uid()
));

CREATE POLICY "Parents can read their children certificate layout overrides"
ON public.tahfizh_certificate_layout_overrides
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_students ps
  WHERE ps.parent_user_id = auth.uid()
    AND (
      ps.student_id = tahfizh_certificate_layout_overrides.student_id
      OR EXISTS (
        SELECT 1 FROM public.ujian u
        WHERE u.id = tahfizh_certificate_layout_overrides.ujian_id
          AND u.student_id = ps.student_id
      )
    )
));
