CREATE OR REPLACE FUNCTION public.link_parent_by_identifier(_identifier text)
RETURNS TABLE(linked_student_id uuid, linked_student_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_ident text := trim(COALESCE(_identifier, ''));
  v_id uuid; v_name text; v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Anda harus masuk terlebih dahulu.'; END IF;
  IF length(v_ident) < 3 THEN RAISE EXCEPTION 'NIS atau NISN wajib diisi.'; END IF;
  SELECT count(*) INTO v_count FROM public.students s
    WHERE trim(COALESCE(s.nis,'')) = v_ident OR trim(COALESCE(s.nisn,'')) = v_ident;
  IF v_count = 0 THEN RAISE EXCEPTION 'Data anak tidak ditemukan. Periksa kembali NIS/NISN.'; END IF;
  IF v_count > 1 THEN RAISE EXCEPTION 'NIS/NISN ini terdaftar pada lebih dari satu siswa. Hubungi admin sekolah.'; END IF;
  SELECT s.id, s.name INTO v_id, v_name FROM public.students s
    WHERE trim(COALESCE(s.nis,'')) = v_ident OR trim(COALESCE(s.nisn,'')) = v_ident LIMIT 1;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'parent') ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.parent_students (parent_user_id, student_id, relation)
    VALUES (v_uid, v_id, 'orang tua') ON CONFLICT (parent_user_id, student_id) DO NOTHING;
  linked_student_id := v_id; linked_student_name := v_name;
  RETURN NEXT;
END; $$;
REVOKE ALL ON FUNCTION public.link_parent_by_identifier(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_parent_by_identifier(text) TO authenticated;