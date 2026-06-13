CREATE POLICY "Exam staff can insert own raport signature layout"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  id = 'raport-examiner-signature-layout-v1:' || auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'penguji'::public.app_role)
    OR public.has_role(auth.uid(), 'guru'::public.app_role)
  )
);

CREATE POLICY "Exam staff can update own raport signature layout"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  id = 'raport-examiner-signature-layout-v1:' || auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'penguji'::public.app_role)
    OR public.has_role(auth.uid(), 'guru'::public.app_role)
  )
)
WITH CHECK (
  id = 'raport-examiner-signature-layout-v1:' || auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'penguji'::public.app_role)
    OR public.has_role(auth.uid(), 'guru'::public.app_role)
  )
);
