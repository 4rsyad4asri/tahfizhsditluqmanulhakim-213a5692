CREATE TABLE IF NOT EXISTS public.tahfizh_certificate_layout_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  layout JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT tahfizh_certificate_layout_overrides_ujian_id_key UNIQUE (ujian_id)
);

ALTER TABLE public.tahfizh_certificate_layout_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read certificate layout overrides"
ON public.tahfizh_certificate_layout_overrides
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert certificate layout overrides"
ON public.tahfizh_certificate_layout_overrides
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update certificate layout overrides"
ON public.tahfizh_certificate_layout_overrides
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete certificate layout overrides"
ON public.tahfizh_certificate_layout_overrides
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_tahfizh_certificate_layout_overrides_updated_at
ON public.tahfizh_certificate_layout_overrides;

CREATE TRIGGER update_tahfizh_certificate_layout_overrides_updated_at
BEFORE UPDATE ON public.tahfizh_certificate_layout_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
