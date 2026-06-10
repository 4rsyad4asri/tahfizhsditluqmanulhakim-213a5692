DROP POLICY IF EXISTS "Exam staff can insert shared raport signature layout"
ON public.app_settings;

CREATE POLICY "Exam staff can insert shared raport signature layout"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  id = 'raport-global-signature-layout-v1'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'penguji'::public.app_role)
    OR public.has_role(auth.uid(), 'guru'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Exam staff can update shared raport signature layout"
ON public.app_settings;

CREATE POLICY "Exam staff can update shared raport signature layout"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  id = 'raport-global-signature-layout-v1'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'penguji'::public.app_role)
    OR public.has_role(auth.uid(), 'guru'::public.app_role)
  )
)
WITH CHECK (
  id = 'raport-global-signature-layout-v1'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'penguji'::public.app_role)
    OR public.has_role(auth.uid(), 'guru'::public.app_role)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
  END IF;
END
$$;
