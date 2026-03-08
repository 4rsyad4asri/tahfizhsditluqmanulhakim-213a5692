ALTER TABLE public.setoran 
  ADD COLUMN IF NOT EXISTS lupa_ayat integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terhenti_terbata integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catatan_guru text DEFAULT '';