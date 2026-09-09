
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  INSERT INTO public.profiles (
    id, full_name, username, email, whatsapp, bio, avatar_url,
    status, registered_at,
    approved_at, approved_by
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(meta->>'full_name',''), NULLIF(meta->>'name',''), ''),
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

CREATE OR REPLACE FUNCTION public.link_parent_student(_child_name text, _identifier text)
RETURNS TABLE(student_id uuid, student_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := lower(trim(COALESCE(_child_name, '')));
  v_ident text := trim(COALESCE(_identifier, ''));
  v_student RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Anda harus masuk terlebih dahulu.';
  END IF;
  IF length(v_name) < 3 THEN
    RAISE EXCEPTION 'Nama anak wajib diisi minimal 3 huruf.';
  END IF;
  IF length(v_ident) < 3 THEN
    RAISE EXCEPTION 'NIS atau NISN wajib diisi.';
  END IF;

  SELECT s.id, s.name INTO v_student
  FROM public.students s
  WHERE (trim(COALESCE(s.nis,'')) = v_ident OR trim(COALESCE(s.nisn,'')) = v_ident)
    AND (lower(s.name) = v_name OR lower(s.name) LIKE '%' || v_name || '%')
  LIMIT 1;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Data anak tidak ditemukan. Periksa kembali nama dan NIS/NISN.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'parent')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.parent_students (parent_user_id, student_id, relation)
  VALUES (v_uid, v_student.id, 'orang tua')
  ON CONFLICT (parent_user_id, student_id) DO NOTHING;

  student_id := v_student.id;
  student_name := v_student.name;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_parent_student(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_parent_student(text, text) TO authenticated;

CREATE POLICY "Parents can unlink their own children"
ON public.parent_students FOR DELETE TO authenticated
USING (parent_user_id = auth.uid());
