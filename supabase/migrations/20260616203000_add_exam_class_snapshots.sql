ALTER TABLE public.ujian
  ADD COLUMN IF NOT EXISTS class_name_at_exam TEXT NULL,
  ADD COLUMN IF NOT EXISTS grade_at_exam INTEGER NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ujian_academic_year_id_fkey'
      AND conrelid = 'public.ujian'::regclass
  ) THEN
    ALTER TABLE public.ujian
      ADD CONSTRAINT ujian_academic_year_id_fkey
      FOREIGN KEY (academic_year_id)
      REFERENCES public.academic_years(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ujian_academic_year_id_idx
  ON public.ujian (academic_year_id);
