CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  app_meta jsonb := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb);
  v_is_oauth boolean := COALESCE(app_meta->>'provider', 'email') <> 'email';
  v_role public.app_role;
  v_status public.account_status;
  v_parent_students jsonb := COALESCE(meta->'parent_students', '[]'::jsonb);
  v_link jsonb;
  v_student_id uuid;
  v_nisn text;
  v_expected_nisn text;
  v_full_name text;
  v_existing_penguji uuid;
BEGIN
  BEGIN
    v_role := COALESCE(NULLIF(meta->>'role',''), CASE WHEN v_is_oauth THEN 'parent' ELSE 'penguji' END)::public.app_role;
  EXCEPTION WHEN others THEN
    v_role := CASE WHEN v_is_oauth THEN 'parent' ELSE 'penguji' END;
  END;

  IF COALESCE((meta->>'created_by_admin')::boolean, false) OR v_is_oauth THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  v_full_name := COALESCE(NULLIF(meta->>'full_name',''), NULLIF(meta->>'name',''), '');

  INSERT INTO public.profiles (
    id, full_name, username, email, whatsapp, bio, avatar_url,
    status, registered_at,
    approved_at, approved_by
  ) VALUES (
    NEW.id,
    v_full_name,
    NULLIF(meta->>'username',''),
    NEW.email,
    NULLIF(meta->>'whatsapp',''),
    NULLIF(meta->>'bio',''),
    COALESCE(NULLIF(meta->>'avatar_url',''), NULLIF(meta->>'picture','')),
    v_status,
    now(),
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END,
    NULLIF(meta->>'approved_by','')::uuid
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'penguji' THEN
    IF NOT EXISTS (SELECT 1 FROM public.penguji p WHERE p.user_id = NEW.id) THEN
      SELECT p.id INTO v_existing_penguji
      FROM public.penguji p
      WHERE p.user_id IS NULL
        AND lower(trim(p.name)) = lower(trim(COALESCE(NULLIF(v_full_name,''), NEW.email)))
      LIMIT 1;

      IF v_existing_penguji IS NOT NULL THEN
        UPDATE public.penguji SET user_id = NEW.id WHERE id = v_existing_penguji;
      ELSE
        INSERT INTO public.penguji (name, user_id)
        VALUES (COALESCE(NULLIF(v_full_name,''), NEW.email), NEW.id);
      END IF;
    END IF;
  END IF;

  IF v_role = 'guru' AND (meta ? 'assigned_classes') THEN
    UPDATE public.profiles
    SET assigned_classes = ARRAY(SELECT (jsonb_array_elements_text(meta->'assigned_classes'))::uuid)
    WHERE id = NEW.id;
  END IF;

  IF v_role = 'parent' AND NOT v_is_oauth THEN
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

      SELECT s.nisn INTO v_expected_nisn FROM public.students s WHERE s.id = v_student_id;

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
$function$;

-- Keep penguji list in sync when an existing user is granted the penguji role
CREATE OR REPLACE FUNCTION public.sync_penguji_on_role_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
  v_existing uuid;
BEGIN
  IF NEW.role <> 'penguji'::public.app_role THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.penguji p WHERE p.user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(pr.full_name), ''), pr.email, 'Penguji')
    INTO v_name
  FROM public.profiles pr
  WHERE pr.id = NEW.user_id;

  v_name := COALESCE(v_name, 'Penguji');

  SELECT p.id INTO v_existing
  FROM public.penguji p
  WHERE p.user_id IS NULL AND lower(trim(p.name)) = lower(trim(v_name))
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.penguji SET user_id = NEW.user_id WHERE id = v_existing;
  ELSE
    INSERT INTO public.penguji (name, user_id) VALUES (v_name, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_penguji_on_role_grant_trg ON public.user_roles;
CREATE TRIGGER sync_penguji_on_role_grant_trg
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_penguji_on_role_grant();