ALTER TABLE public.ujian
  ADD COLUMN IF NOT EXISTS academic_semester_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ujian_academic_semester_id_fkey'
      AND conrelid = 'public.ujian'::regclass
  ) THEN
    ALTER TABLE public.ujian
      ADD CONSTRAINT ujian_academic_semester_id_fkey
      FOREIGN KEY (academic_semester_id)
      REFERENCES public.academic_semesters(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ujian_academic_semester_id_idx
  ON public.ujian (academic_semester_id);

CREATE OR REPLACE FUNCTION public.assign_active_academic_period_to_exam()
RETURNS TRIGGER AS $$
DECLARE
  active_semester_id UUID;
  active_year_id UUID;
BEGIN
  IF NEW.academic_semester_id IS NOT NULL THEN
    SELECT academic_year_id
      INTO active_year_id
      FROM public.academic_semesters
      WHERE id = NEW.academic_semester_id;

    IF active_year_id IS NULL THEN
      RAISE EXCEPTION 'Semester ujian tidak ditemukan.';
    END IF;

    NEW.academic_year_id := active_year_id;
    RETURN NEW;
  END IF;

  SELECT id, academic_year_id
    INTO active_semester_id, active_year_id
    FROM public.academic_semesters
    WHERE is_active = true
    LIMIT 1;

  IF active_semester_id IS NULL THEN
    RAISE EXCEPTION 'Belum ada semester aktif. Aktifkan semester pada menu Tahun Ajaran sebelum menyimpan ujian.';
  END IF;

  NEW.academic_semester_id := active_semester_id;
  NEW.academic_year_id := active_year_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS assign_active_academic_period_to_exam_trg ON public.ujian;
CREATE TRIGGER assign_active_academic_period_to_exam_trg
BEFORE INSERT ON public.ujian
FOR EACH ROW EXECUTE FUNCTION public.assign_active_academic_period_to_exam();

GRANT EXECUTE ON FUNCTION public.assign_active_academic_period_to_exam() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_active_academic_period_to_exam() TO service_role;
