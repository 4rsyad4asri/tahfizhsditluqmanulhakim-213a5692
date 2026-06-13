CREATE TABLE IF NOT EXISTS public.certificate_layouts (
  id TEXT PRIMARY KEY,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.certificate_layouts
  ADD COLUMN IF NOT EXISTS layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.certificate_layouts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.certificate_layouts TO authenticated;
GRANT ALL ON TABLE public.certificate_layouts TO service_role;
REVOKE ALL ON TABLE public.certificate_layouts FROM anon;

DROP POLICY IF EXISTS "Authenticated users can read certificate layouts"
  ON public.certificate_layouts;
CREATE POLICY "Authenticated users can read certificate layouts"
ON public.certificate_layouts
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert certificate layouts"
  ON public.certificate_layouts;
CREATE POLICY "Admins can insert certificate layouts"
ON public.certificate_layouts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update certificate layouts"
  ON public.certificate_layouts;
CREATE POLICY "Admins can update certificate layouts"
ON public.certificate_layouts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_certificate_layouts_updated_at
  ON public.certificate_layouts;
CREATE TRIGGER update_certificate_layouts_updated_at
BEFORE UPDATE ON public.certificate_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
