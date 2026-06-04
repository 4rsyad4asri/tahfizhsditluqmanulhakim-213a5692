CREATE POLICY "Admin and all penguji can read tahfizh ujian"
ON public.ujian
FOR SELECT
TO authenticated
USING (
  mode = 'Tahfizh'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'penguji'::public.app_role)
  )
);