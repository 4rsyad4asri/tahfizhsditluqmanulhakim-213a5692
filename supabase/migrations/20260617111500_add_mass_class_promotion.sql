ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_status TEXT NOT NULL DEFAULT 'aktif';

UPDATE public.students
SET student_status = COALESCE(NULLIF(status_siswa, ''), student_status, 'aktif')
WHERE student_status IS DISTINCT FROM COALESCE(NULLIF(status_siswa, ''), student_status, 'aktif');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_student_status_check'
      AND conrelid = 'public.students'::regclass
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_student_status_check
      CHECK (student_status IN ('aktif', 'alumni', 'pindah', 'nonaktif'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS students_student_status_idx
  ON public.students (student_status);

CREATE OR REPLACE FUNCTION public.sync_student_status_columns()
RETURNS TRIGGER AS $$
DECLARE
  normalized_status TEXT;
BEGIN
  normalized_status := COALESCE(NULLIF(NEW.student_status, ''), NULLIF(NEW.status_siswa, ''), 'aktif');
  NEW.student_status := normalized_status;
  NEW.status_siswa := normalized_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_student_status_columns_trg ON public.students;
CREATE TRIGGER sync_student_status_columns_trg
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.sync_student_status_columns();

CREATE TABLE IF NOT EXISTS public.student_class_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  academic_year_from UUID NOT NULL REFERENCES public.academic_years (id),
  academic_year_to UUID NOT NULL REFERENCES public.academic_years (id),
  from_class_id UUID NULL REFERENCES public.classes (id),
  to_class_id UUID NULL REFERENCES public.classes (id),
  status_after TEXT NOT NULL CHECK (status_after IN ('aktif', 'alumni', 'pindah', 'nonaktif')),
  promoted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  promoted_by UUID NULL REFERENCES public.profiles (id),
  note TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_class_history_student_years_idx
  ON public.student_class_history (student_id, academic_year_from, academic_year_to);

CREATE INDEX IF NOT EXISTS student_class_history_from_to_idx
  ON public.student_class_history (academic_year_from, academic_year_to);

ALTER TABLE public.student_class_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read student_class_history" ON public.student_class_history;
CREATE POLICY "Admins can read student_class_history"
ON public.student_class_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert student_class_history" ON public.student_class_history;
CREATE POLICY "Admins can insert student_class_history"
ON public.student_class_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT ON public.student_class_history TO authenticated;
GRANT ALL ON public.student_class_history TO service_role;

CREATE OR REPLACE FUNCTION public.process_mass_class_promotion(
  _academic_year_from UUID,
  _academic_year_to UUID,
  _student_ids UUID[],
  _note TEXT DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  result_status TEXT,
  status_after TEXT,
  from_class_id UUID,
  to_class_id UUID,
  message TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  student_row public.students%ROWTYPE;
  from_class_row public.classes%ROWTYPE;
  target_class_row public.classes%ROWTYPE;
  current_student_id UUID;
  next_status TEXT;
  next_class_id UUID;
BEGIN
  IF _academic_year_from IS NULL OR _academic_year_to IS NULL THEN
    RAISE EXCEPTION 'Tahun ajaran asal dan tujuan wajib dipilih.';
  END IF;

  IF _academic_year_from = _academic_year_to THEN
    RAISE EXCEPTION 'Tahun ajaran asal dan tujuan tidak boleh sama.';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Akses ditolak. Hanya admin yang dapat memproses naik kelas massal.';
  END IF;

  FOREACH current_student_id IN ARRAY COALESCE(_student_ids, ARRAY[]::UUID[]) LOOP
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM public.student_class_history sch
        WHERE sch.student_id = current_student_id
          AND sch.academic_year_from = _academic_year_from
          AND sch.academic_year_to = _academic_year_to
      ) THEN
        student_id := current_student_id;
        result_status := 'already_processed';
        status_after := NULL;
        from_class_id := NULL;
        to_class_id := NULL;
        message := 'Sudah diproses pada tahun ajaran yang sama.';
        RETURN NEXT;
        CONTINUE;
      END IF;

      SELECT *
      INTO student_row
      FROM public.students
      WHERE id = current_student_id;

      IF NOT FOUND THEN
        student_id := current_student_id;
        result_status := 'failed';
        status_after := NULL;
        from_class_id := NULL;
        to_class_id := NULL;
        message := 'Siswa tidak ditemukan.';
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF COALESCE(NULLIF(student_row.student_status, ''), NULLIF(student_row.status_siswa, ''), 'aktif') <> 'aktif' THEN
        student_id := current_student_id;
        result_status := 'failed';
        status_after := COALESCE(student_row.student_status, student_row.status_siswa, 'aktif');
        from_class_id := student_row.class_id;
        to_class_id := NULL;
        message := 'Status siswa bukan aktif.';
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF student_row.class_id IS NULL THEN
        student_id := current_student_id;
        result_status := 'failed';
        status_after := 'aktif';
        from_class_id := NULL;
        to_class_id := NULL;
        message := 'Siswa tidak memiliki class_id.';
        RETURN NEXT;
        CONTINUE;
      END IF;

      SELECT *
      INTO from_class_row
      FROM public.classes
      WHERE id = student_row.class_id;

      IF NOT FOUND THEN
        student_id := current_student_id;
        result_status := 'failed';
        status_after := 'aktif';
        from_class_id := student_row.class_id;
        to_class_id := NULL;
        message := 'Kelas lama tidak ditemukan.';
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF from_class_row.grade = 6 THEN
        next_status := 'alumni';
        next_class_id := NULL;
      ELSE
        SELECT *
        INTO target_class_row
        FROM public.classes
        WHERE grade = from_class_row.grade + 1
          AND section = from_class_row.section
        LIMIT 1;

        IF NOT FOUND THEN
          student_id := current_student_id;
          result_status := 'failed';
          status_after := 'aktif';
          from_class_id := from_class_row.id;
          to_class_id := NULL;
          message := format(
            'Kelas tujuan grade %s section %s tidak ditemukan.',
            from_class_row.grade + 1,
            from_class_row.section
          );
          RETURN NEXT;
          CONTINUE;
        END IF;

        next_status := 'aktif';
        next_class_id := target_class_row.id;
      END IF;

      UPDATE public.students
      SET class_id = COALESCE(next_class_id, class_id),
          student_status = next_status,
          status_siswa = next_status,
          updated_at = now()
      WHERE id = current_student_id;

      INSERT INTO public.student_class_history (
        student_id,
        academic_year_from,
        academic_year_to,
        from_class_id,
        to_class_id,
        status_after,
        promoted_at,
        promoted_by,
        note
      ) VALUES (
        current_student_id,
        _academic_year_from,
        _academic_year_to,
        from_class_row.id,
        next_class_id,
        next_status,
        now(),
        auth.uid(),
        _note
      );

      student_id := current_student_id;
      result_status := CASE WHEN next_status = 'alumni' THEN 'alumni' ELSE 'promoted' END;
      status_after := next_status;
      from_class_id := from_class_row.id;
      to_class_id := next_class_id;
      message := CASE WHEN next_status = 'alumni' THEN 'Siswa ditandai sebagai alumni.' ELSE 'Siswa berhasil naik kelas.' END;
      RETURN NEXT;
    EXCEPTION
      WHEN unique_violation THEN
        student_id := current_student_id;
        result_status := 'already_processed';
        status_after := NULL;
        from_class_id := NULL;
        to_class_id := NULL;
        message := 'Sudah diproses pada tahun ajaran yang sama.';
        RETURN NEXT;
      WHEN OTHERS THEN
        student_id := current_student_id;
        result_status := 'failed';
        status_after := NULL;
        from_class_id := NULL;
        to_class_id := NULL;
        message := SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_mass_class_promotion(UUID, UUID, UUID[], TEXT) TO authenticated;
