
-- Drop anon read on sensitive tables (keep authenticated and public-verification policies)
DROP POLICY IF EXISTS "Public can read setoran" ON public.setoran;
DROP POLICY IF EXISTS "Public can read ujian" ON public.ujian;

-- Harden trigger functions with explicit search_path
CREATE OR REPLACE FUNCTION public.prevent_published_ujian_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.document_status = 'Published'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND (
       NEW.nilai_aspek IS DISTINCT FROM OLD.nilai_aspek OR
       NEW.nilai_akhir IS DISTINCT FROM OLD.nilai_akhir OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.grade IS DISTINCT FROM OLD.grade OR
       NEW.tanggal IS DISTINCT FROM OLD.tanggal OR
       NEW.student_id IS DISTINCT FROM OLD.student_id OR
       NEW.mode IS DISTINCT FROM OLD.mode
     ) THEN
    RAISE EXCEPTION 'Ujian sudah Published dan terkunci';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_published_ujian_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.document_status = 'Published'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Ujian sudah Published dan terkunci';
  END IF;
  RETURN OLD;
END;
$function$;
