GRANT SELECT ON public.penguji TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.penguji TO authenticated;
GRANT ALL ON public.penguji TO service_role;

GRANT SELECT ON public.class_penguji TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.class_penguji TO authenticated;
GRANT ALL ON public.class_penguji TO service_role;

GRANT SELECT ON public.ujian TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.ujian TO authenticated;
GRANT ALL ON public.ujian TO service_role;

GRANT SELECT ON public.students TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

GRANT SELECT ON public.classes TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;

GRANT SELECT ON public.setoran TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.setoran TO authenticated;
GRANT ALL ON public.setoran TO service_role;

GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;