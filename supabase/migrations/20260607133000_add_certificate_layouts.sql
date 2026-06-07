CREATE TABLE IF NOT EXISTS public.certificate_layouts (
  id TEXT PRIMARY KEY,
  layout JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.certificate_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read certificate layouts"
ON public.certificate_layouts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert certificate layouts"
ON public.certificate_layouts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update certificate layouts"
ON public.certificate_layouts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_certificate_layouts_updated_at
BEFORE UPDATE ON public.certificate_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
