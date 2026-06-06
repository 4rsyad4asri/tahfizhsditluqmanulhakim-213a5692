ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS nis TEXT,
  ADD COLUMN IF NOT EXISTS nisn TEXT;

ALTER TABLE public.students
  ADD CONSTRAINT students_nis_format_check
    CHECK (nis IS NULL OR nis ~ '^[0-9]{1,20}$'),
  ADD CONSTRAINT students_nisn_format_check
    CHECK (nisn IS NULL OR nisn ~ '^[0-9]{10}$');

CREATE UNIQUE INDEX IF NOT EXISTS students_nis_unique
  ON public.students (nis)
  WHERE nis IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_nisn_unique
  ON public.students (nisn)
  WHERE nisn IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_student_identity_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.name IS DISTINCT FROM OLD.name OR
    NEW.class_id IS DISTINCT FROM OLD.class_id OR
    NEW.nis IS DISTINCT FROM OLD.nis OR
    NEW.nisn IS DISTINCT FROM OLD.nisn
  ) AND auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah identitas siswa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_identity_admin ON public.students;
CREATE TRIGGER enforce_student_identity_admin
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.enforce_student_identity_admin();
