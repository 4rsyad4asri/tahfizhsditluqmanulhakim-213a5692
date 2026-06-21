CREATE TABLE IF NOT EXISTS public.academic_semesters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  semester_number SMALLINT NOT NULL CHECK (semester_number IN (1, 2)),
  name TEXT NOT NULL CHECK (name IN ('Ganjil', 'Genap')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'arsip' CHECK (status IN ('aktif', 'arsip')),
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT academic_semesters_year_number_key UNIQUE (academic_year_id, semester_number),
  CONSTRAINT academic_semesters_date_order_check
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_semesters_single_active_idx
  ON public.academic_semesters ((is_active))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS academic_semesters_academic_year_id_idx
  ON public.academic_semesters (academic_year_id);

CREATE OR REPLACE FUNCTION public.sync_academic_semester_status()
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

CREATE OR REPLACE FUNCTION public.ensure_single_active_academic_semester()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.academic_years
      SET is_active = true,
          status = 'aktif',
          updated_at = now()
      WHERE id = NEW.academic_year_id
        AND is_active = false;

    UPDATE public.academic_semesters
      SET is_active = false,
          status = 'arsip',
          updated_at = now()
      WHERE id <> NEW.id
        AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_default_academic_semesters()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.academic_semesters (academic_year_id, semester_number, name)
  VALUES
    (NEW.id, 1, 'Ganjil'),
    (NEW.id, 2, 'Genap')
  ON CONFLICT (academic_year_id, semester_number) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_academic_semester_status_trg ON public.academic_semesters;
CREATE TRIGGER sync_academic_semester_status_trg
BEFORE INSERT OR UPDATE ON public.academic_semesters
FOR EACH ROW EXECUTE FUNCTION public.sync_academic_semester_status();

DROP TRIGGER IF EXISTS ensure_single_active_academic_semester_trg ON public.academic_semesters;
CREATE TRIGGER ensure_single_active_academic_semester_trg
BEFORE INSERT OR UPDATE ON public.academic_semesters
FOR EACH ROW EXECUTE FUNCTION public.ensure_single_active_academic_semester();

DROP TRIGGER IF EXISTS update_academic_semesters_updated_at ON public.academic_semesters;
CREATE TRIGGER update_academic_semesters_updated_at
BEFORE UPDATE ON public.academic_semesters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS create_default_academic_semesters_trg ON public.academic_years;
CREATE TRIGGER create_default_academic_semesters_trg
AFTER INSERT ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.create_default_academic_semesters();

INSERT INTO public.academic_semesters (academic_year_id, semester_number, name)
SELECT academic_year.id, semester.semester_number, semester.name
FROM public.academic_years AS academic_year
CROSS JOIN (
  VALUES
    (1::SMALLINT, 'Ganjil'::TEXT),
    (2::SMALLINT, 'Genap'::TEXT)
) AS semester(semester_number, name)
ON CONFLICT (academic_year_id, semester_number) DO NOTHING;

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

    UPDATE public.academic_semesters
      SET is_active = false,
          status = 'arsip',
          updated_at = now()
      WHERE academic_year_id <> NEW.id
        AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

ALTER TABLE public.academic_semesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read academic semesters"
ON public.academic_semesters
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert academic semesters"
ON public.academic_semesters
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update academic semesters"
ON public.academic_semesters
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.academic_semesters TO authenticated;
GRANT INSERT, UPDATE ON public.academic_semesters TO authenticated;
GRANT ALL ON public.academic_semesters TO service_role;
