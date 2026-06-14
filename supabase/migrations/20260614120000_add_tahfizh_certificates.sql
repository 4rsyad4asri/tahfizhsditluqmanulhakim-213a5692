ALTER TABLE public.ujian
ADD COLUMN IF NOT EXISTS nomor_sertifikat TEXT;

CREATE TABLE IF NOT EXISTS public.tahfizh_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID NOT NULL REFERENCES public.ujian(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name_snapshot TEXT NOT NULL,
  class_name_snapshot TEXT NOT NULL,
  juz_snapshot TEXT NOT NULL,
  final_score_snapshot NUMERIC NOT NULL,
  predicate_snapshot TEXT NOT NULL,
  certificate_number TEXT NOT NULL,
  document_number TEXT,
  verification_token TEXT,
  coordinator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  coordinator_name_snapshot TEXT,
  principal_name_snapshot TEXT,
  issued_date DATE NOT NULL,
  layout_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'published',
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revision_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT tahfizh_certificates_ujian_id_key UNIQUE (ujian_id),
  CONSTRAINT tahfizh_certificates_certificate_number_key UNIQUE (certificate_number),
  CONSTRAINT tahfizh_certificates_status_check
    CHECK (status IN ('draft', 'published', 'revised', 'cancelled'))
);

ALTER TABLE public.tahfizh_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tahfizh certificates"
ON public.tahfizh_certificates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert tahfizh certificates"
ON public.tahfizh_certificates
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND published_by = auth.uid()
);

CREATE POLICY "Admins can update tahfizh certificates"
ON public.tahfizh_certificates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_tahfizh_certificates_updated_at
ON public.tahfizh_certificates;

CREATE TRIGGER update_tahfizh_certificates_updated_at
BEFORE UPDATE ON public.tahfizh_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.lock_published_tahfizh_certificate_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tahfizh_certificates certificate
    WHERE certificate.ujian_id = OLD.id
      AND certificate.status = 'published'
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION
        'Sertifikat sudah dipublish. Data utama terkunci. Gunakan proses revisi.';
    END IF;

    IF TG_OP = 'UPDATE' AND (
      NEW.student_id IS DISTINCT FROM OLD.student_id
      OR NEW.tanggal IS DISTINCT FROM OLD.tanggal
      OR NEW.nilai_aspek IS DISTINCT FROM OLD.nilai_aspek
      OR NEW.nilai_akhir IS DISTINCT FROM OLD.nilai_akhir
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.grade IS DISTINCT FROM OLD.grade
      OR NEW.verification_token IS DISTINCT FROM OLD.verification_token
      OR NEW.nomor_sertifikat IS DISTINCT FROM OLD.nomor_sertifikat
    ) THEN
      RAISE EXCEPTION
        'Sertifikat sudah dipublish. Data utama terkunci. Gunakan proses revisi.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_published_tahfizh_certificate_source
ON public.ujian;

CREATE TRIGGER lock_published_tahfizh_certificate_source
BEFORE UPDATE OR DELETE ON public.ujian
FOR EACH ROW EXECUTE FUNCTION public.lock_published_tahfizh_certificate_source();
