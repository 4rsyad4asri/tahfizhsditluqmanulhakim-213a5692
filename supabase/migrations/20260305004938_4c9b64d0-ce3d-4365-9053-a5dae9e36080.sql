
-- Table for penguji (examiners) - not linked to auth users
CREATE TABLE public.penguji (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.penguji ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read penguji"
  ON public.penguji FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert penguji"
  ON public.penguji FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update penguji"
  ON public.penguji FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete penguji"
  ON public.penguji FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Junction table for class-penguji assignment
CREATE TABLE public.class_penguji (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  penguji_id uuid NOT NULL REFERENCES public.penguji(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(class_id, penguji_id)
);

ALTER TABLE public.class_penguji ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read class_penguji"
  ON public.class_penguji FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert class_penguji"
  ON public.class_penguji FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete class_penguji"
  ON public.class_penguji FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
