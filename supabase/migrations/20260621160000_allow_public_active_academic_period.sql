CREATE POLICY "Public can read academic years"
ON public.academic_years
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "Public can read academic semesters"
ON public.academic_semesters
FOR SELECT
TO anon
USING (is_active = true);

GRANT SELECT ON public.academic_years TO anon;
GRANT SELECT ON public.academic_semesters TO anon;
