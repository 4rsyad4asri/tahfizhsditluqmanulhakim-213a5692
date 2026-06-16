CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'arsip' CHECK (status IN ('aktif', 'arsip')),
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_years_single_active_idx
  ON public.academic_years ((is_active))
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.sync_academic_year_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    NEW.status := 'aktif';
  ELSE
    NEW.status := 'arsip';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.ensure_single_active_academic_year()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.academic_years
      SET is_active = false,
          status = 'arsip',
          updated_at = now()
      WHERE id <> NEW.id
        AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_academic_year_status_trg ON public.academic_years;
CREATE TRIGGER sync_academic_year_status_trg
BEFORE INSERT OR UPDATE ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.sync_academic_year_status();

DROP TRIGGER IF EXISTS ensure_single_active_academic_year_trg ON public.academic_years;
CREATE TRIGGER ensure_single_active_academic_year_trg
BEFORE INSERT OR UPDATE ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.ensure_single_active_academic_year();

DROP TRIGGER IF EXISTS update_academic_years_updated_at ON public.academic_years;
CREATE TRIGGER update_academic_years_updated_at
BEFORE UPDATE ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read academic years"
ON public.academic_years
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert academic years"
ON public.academic_years
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update academic years"
ON public.academic_years
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.academic_years TO authenticated;
GRANT INSERT, UPDATE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
