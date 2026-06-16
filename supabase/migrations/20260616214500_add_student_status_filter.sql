ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status_siswa TEXT NOT NULL DEFAULT 'aktif';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_status_siswa_check'
      AND conrelid = 'public.students'::regclass
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_status_siswa_check
      CHECK (status_siswa IN ('aktif', 'alumni', 'pindah', 'nonaktif'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS students_status_siswa_idx
  ON public.students (status_siswa);
