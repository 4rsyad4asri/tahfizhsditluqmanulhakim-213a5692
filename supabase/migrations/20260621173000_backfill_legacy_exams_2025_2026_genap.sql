DO $$
DECLARE
  target_year_id UUID;
  target_semester_id UUID;
  updated_count INTEGER;
BEGIN
  SELECT id
    INTO target_year_id
    FROM public.academic_years
    WHERE name = '2025/2026'
    LIMIT 1;

  IF target_year_id IS NULL THEN
    RAISE EXCEPTION 'Tahun Ajaran 2025/2026 belum tersedia. Backfill dibatalkan tanpa mengubah data.';
  END IF;

  SELECT id
    INTO target_semester_id
    FROM public.academic_semesters
    WHERE academic_year_id = target_year_id
      AND semester_number = 2
      AND name = 'Genap'
    LIMIT 1;

  IF target_semester_id IS NULL THEN
    RAISE EXCEPTION 'Semester 2 Genap Tahun Ajaran 2025/2026 belum tersedia. Backfill dibatalkan tanpa mengubah data.';
  END IF;

  UPDATE public.ujian
    SET academic_year_id = target_year_id,
        academic_semester_id = target_semester_id
    WHERE academic_semester_id IS NULL
      AND (academic_year_id IS NULL OR academic_year_id = target_year_id)
      AND tanggal >= DATE '2026-01-01'
      AND tanggal <= DATE '2026-06-30';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE 'Backfill selesai: % ujian lama dikaitkan ke Semester 2 Genap Tahun Ajaran 2025/2026.', updated_count;
END $$;
