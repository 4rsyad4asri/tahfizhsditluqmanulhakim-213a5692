-- Tahfizh mode, document lock, and public e-verification support.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.ujian
  ADD COLUMN IF NOT EXISTS document_status text NOT NULL DEFAULT 'Draft'
    CHECK (document_status IN ('Draft', 'Published')),
  ADD COLUMN IF NOT EXISTS verification_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ujian_verification_token_key
  ON public.ujian (verification_token);

CREATE INDEX IF NOT EXISTS ujian_public_verification_idx
  ON public.ujian (verification_token, document_status);

CREATE OR REPLACE FUNCTION public.prevent_published_ujian_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.prevent_published_ujian_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.document_status = 'Published'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Ujian sudah Published dan terkunci';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_published_ujian_mutation_trigger ON public.ujian;
CREATE TRIGGER prevent_published_ujian_mutation_trigger
BEFORE UPDATE ON public.ujian
FOR EACH ROW
EXECUTE FUNCTION public.prevent_published_ujian_mutation();

DROP TRIGGER IF EXISTS prevent_published_ujian_delete_trigger ON public.ujian;
CREATE TRIGGER prevent_published_ujian_delete_trigger
BEFORE DELETE ON public.ujian
FOR EACH ROW
EXECUTE FUNCTION public.prevent_published_ujian_delete();

DROP POLICY IF EXISTS "Public can verify published ujian" ON public.ujian;
CREATE POLICY "Public can verify published ujian"
ON public.ujian
FOR SELECT
TO anon
USING (document_status = 'Published');
