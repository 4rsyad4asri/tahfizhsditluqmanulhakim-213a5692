
-- Create enum types
CREATE TYPE public.student_level AS ENUM ('Tahsin Dasar', 'Tahsin Lanjutan', 'Tahfizh');
CREATE TYPE public.certification_status AS ENUM ('Belum Ujian', 'Lulus', 'Tidak Lulus');
CREATE TYPE public.exam_mode AS ENUM ('Tahsin', 'Tahfizh');
CREATE TYPE public.exam_status AS ENUM ('Lulus', 'Tidak Lulus');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade >= 1 AND grade <= 6),
  section TEXT NOT NULL CHECK (section IN ('A','B','C','D')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (grade, section)
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classes are publicly readable" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Classes are publicly insertable" ON public.classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Classes are publicly updatable" ON public.classes FOR UPDATE USING (true);

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  target_juz INTEGER NOT NULL DEFAULT 30 CHECK (target_juz >= 1 AND target_juz <= 30),
  level public.student_level NOT NULL DEFAULT 'Tahsin Dasar',
  progress_hafalan INTEGER NOT NULL DEFAULT 0 CHECK (progress_hafalan >= 0 AND progress_hafalan <= 100),
  status_sertifikasi public.certification_status NOT NULL DEFAULT 'Belum Ujian',
  catatan_penguji TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students are publicly readable" ON public.students FOR SELECT USING (true);
CREATE POLICY "Students are publicly insertable" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Students are publicly updatable" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Students are publicly deletable" ON public.students FOR DELETE USING (true);

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Setoran table
CREATE TABLE public.setoran (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  juz INTEGER NOT NULL CHECK (juz >= 1 AND juz <= 30),
  surah TEXT NOT NULL,
  ayat_mulai INTEGER NOT NULL CHECK (ayat_mulai >= 1),
  ayat_akhir INTEGER NOT NULL CHECK (ayat_akhir >= 1),
  nilai INTEGER NOT NULL DEFAULT 0,
  kesalahan_makhraj INTEGER NOT NULL DEFAULT 0,
  kesalahan_tajwid INTEGER NOT NULL DEFAULT 0,
  kesalahan_mad INTEGER NOT NULL DEFAULT 0,
  kelancaran INTEGER NOT NULL DEFAULT 8 CHECK (kelancaran >= 1 AND kelancaran <= 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.setoran ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Setoran is publicly readable" ON public.setoran FOR SELECT USING (true);
CREATE POLICY "Setoran is publicly insertable" ON public.setoran FOR INSERT WITH CHECK (true);
CREATE POLICY "Setoran is publicly updatable" ON public.setoran FOR UPDATE USING (true);
CREATE POLICY "Setoran is publicly deletable" ON public.setoran FOR DELETE USING (true);

-- Ujian table
CREATE TABLE public.ujian (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  mode public.exam_mode NOT NULL,
  nilai_aspek JSONB NOT NULL DEFAULT '{}',
  nilai_akhir INTEGER NOT NULL DEFAULT 0,
  status public.exam_status NOT NULL DEFAULT 'Tidak Lulus',
  grade TEXT NOT NULL DEFAULT 'D',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ujian is publicly readable" ON public.ujian FOR SELECT USING (true);
CREATE POLICY "Ujian is publicly insertable" ON public.ujian FOR INSERT WITH CHECK (true);
CREATE POLICY "Ujian is publicly updatable" ON public.ujian FOR UPDATE USING (true);
CREATE POLICY "Ujian is publicly deletable" ON public.ujian FOR DELETE USING (true);
