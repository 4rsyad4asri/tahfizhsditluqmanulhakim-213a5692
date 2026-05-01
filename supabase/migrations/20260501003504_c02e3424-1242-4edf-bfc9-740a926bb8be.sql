-- Drop existing restrictive policies on ujian
DROP POLICY IF EXISTS "Admins can update ujian" ON public.ujian;
DROP POLICY IF EXISTS "Admins can delete ujian" ON public.ujian;

-- New policies: admin OR the assessor can update/delete
CREATE POLICY "Admin or assessor can update ujian"
ON public.ujian
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR assessed_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR assessed_by = auth.uid());

CREATE POLICY "Admin or assessor can delete ujian"
ON public.ujian
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR assessed_by = auth.uid());

-- Update admin profile name
UPDATE public.profiles
SET full_name = 'Miftahul Arsyad Asri, S.H'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@tahfizh.com'
);