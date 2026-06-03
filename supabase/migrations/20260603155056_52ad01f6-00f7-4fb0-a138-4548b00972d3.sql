
-- 1. Restrict penguji.user_id to admins only via column-level grants
REVOKE SELECT ON public.penguji FROM authenticated;
REVOKE SELECT ON public.penguji FROM anon;
GRANT SELECT (id, name, created_at) ON public.penguji TO authenticated;
GRANT SELECT (id, name, created_at) ON public.penguji TO anon;
GRANT SELECT (user_id) ON public.penguji TO service_role;

-- Allow admins to read user_id via a security definer helper policy: use a separate grant for admins is not possible per-role.
-- Instead create a view for admin access to user_id if needed. For now, admins can use service_role on the backend.
-- Provide an RPC for admins to fetch penguji with user_id.
CREATE OR REPLACE FUNCTION public.admin_get_penguji_user_id(_penguji_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.penguji
  WHERE id = _penguji_id
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_penguji_user_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_penguji_user_id(uuid) TO authenticated;

-- 2. Restrict students.catatan_penguji from anon (keep authenticated full read)
REVOKE SELECT ON public.students FROM anon;
GRANT SELECT (id, name, class_id, target_juz, level, progress_hafalan, status_sertifikasi, created_at, updated_at) ON public.students TO anon;

-- 3. Setoran: restrict read to admin or assigned penguji
DROP POLICY IF EXISTS "Authenticated users can read setoran" ON public.setoran;
CREATE POLICY "Admin or assigned penguji can read setoran"
ON public.setoran
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.class_penguji cp ON cp.class_id = s.class_id
    JOIN public.penguji p ON p.id = cp.penguji_id
    WHERE s.id = setoran.student_id AND p.user_id = auth.uid()
  )
);

-- 4. Ujian: restrict authenticated read to admin or assigned penguji (anon Published policy unchanged)
DROP POLICY IF EXISTS "Authenticated users can read ujian" ON public.ujian;
CREATE POLICY "Admin or assigned penguji can read ujian"
ON public.ujian
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.class_penguji cp ON cp.class_id = s.class_id
    JOIN public.penguji p ON p.id = cp.penguji_id
    WHERE s.id = ujian.student_id AND p.user_id = auth.uid()
  )
);
