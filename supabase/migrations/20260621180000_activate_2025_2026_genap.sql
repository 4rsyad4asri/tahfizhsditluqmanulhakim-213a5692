DO $$
DECLARE
  target_year_id UUID;
  target_semester_id UUID;
BEGIN
  SELECT id
    INTO target_year_id
    FROM public.academic_years
    WHERE name = '2025/2026'
    LIMIT 1;

  IF target_year_id IS NULL THEN
    RAISE EXCEPTION 'Tahun Ajaran 2025/2026 belum tersedia. Aktivasi semester dibatalkan.';
  END IF;

  SELECT id
    INTO target_semester_id
    FROM public.academic_semesters
    WHERE academic_year_id = target_year_id
      AND semester_number = 2
      AND name = 'Genap'
    LIMIT 1;

  IF target_semester_id IS NULL THEN
    RAISE EXCEPTION 'Semester 2 Genap Tahun Ajaran 2025/2026 belum tersedia. Aktivasi dibatalkan.';
  END IF;

  UPDATE public.academic_years
    SET is_active = true,
        status = 'aktif'
    WHERE id = target_year_id;

  UPDATE public.academic_semesters
    SET is_active = true,
        status = 'aktif',
        start_date = COALESCE(start_date, DATE '2026-01-01'),
        end_date = COALESCE(end_date, DATE '2026-06-20')
    WHERE id = target_semester_id;

  RAISE NOTICE 'Semester 2 Genap Tahun Ajaran 2025/2026 berhasil diaktifkan.';
END $$;
