CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_role public.app_role;
  v_status public.account_status;
  v_parent_students jsonb := COALESCE(meta->'parent_students', '[]'::jsonb);
  v_link jsonb;
  v_student_id uuid;
  v_nisn text;
  v_expected_nisn text;
BEGIN
  BEGIN
    v_role := COALESCE(NULLIF(meta->>'role',''), 'penguji')::public.app_role;
  EXCEPTION WHEN others THEN
    v_role := 'penguji';
  END;

  IF COALESCE((meta->>'created_by_admin')::boolean, false) THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, username, email, whatsapp, bio,
    status, registered_at,
    approved_at, approved_by
  ) VALUES (
    NEW.id,
    COALESCE(meta->>'full_name',''),
    NULLIF(meta->>'username',''),
    NEW.email,
    NULLIF(meta->>'whatsapp',''),
    NULLIF(meta->>'bio',''),
    v_status,
    now(),
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END,
    NULLIF(meta->>'approved_by','')::uuid
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'guru' AND (meta ? 'assigned_classes') THEN
    UPDATE public.profiles
    SET assigned_classes = ARRAY(SELECT (jsonb_array_elements_text(meta->'assigned_classes'))::uuid)
    WHERE id = NEW.id;
  END IF;

  IF v_role = 'parent' THEN
    IF jsonb_typeof(v_parent_students) IS DISTINCT FROM 'array' OR jsonb_array_length(v_parent_students) = 0 THEN
      RAISE EXCEPTION 'Data anak wajib diisi minimal 1 siswa';
    END IF;

    IF (
      SELECT COUNT(*)
      FROM (
        SELECT item->>'student_id' AS student_id
        FROM jsonb_array_elements(v_parent_students) AS item
      ) ids
    ) <> (
      SELECT COUNT(DISTINCT item->>'student_id')
      FROM jsonb_array_elements(v_parent_students) AS item
    ) THEN
      RAISE EXCEPTION 'Siswa yang sama tidak boleh dipilih dua kali';
    END IF;

    FOR v_link IN SELECT * FROM jsonb_array_elements(v_parent_students)
    LOOP
      BEGIN
        v_student_id := NULLIF(v_link->>'student_id', '')::uuid;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Data anak tidak valid. Silakan pilih ulang siswa.';
      END;

      v_nisn := NULLIF(trim(v_link->>'nisn'), '');
      IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Data anak tidak valid. Silakan pilih ulang siswa.';
      END IF;
      IF v_nisn IS NULL THEN
        RAISE EXCEPTION 'NISN anak wajib diisi untuk semua siswa.';
      END IF;

      SELECT s.nisn
      INTO v_expected_nisn
      FROM public.students s
      WHERE s.id = v_student_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Siswa yang dipilih tidak ditemukan.';
      END IF;

      IF v_expected_nisn IS NULL OR v_nisn <> v_expected_nisn THEN
        RAISE EXCEPTION 'NISN tidak cocok dengan siswa yang dipilih.';
      END IF;

      INSERT INTO public.parent_students (parent_user_id, student_id)
      VALUES (NEW.id, v_student_id)
      ON CONFLICT (parent_user_id, student_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
