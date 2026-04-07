
-- Add assessed_by column to setoran table
ALTER TABLE public.setoran
ADD COLUMN assessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add assessed_by column to ujian table  
ALTER TABLE public.ujian
ADD COLUMN assessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id column to penguji table to link penguji records to auth accounts
ALTER TABLE public.penguji
ADD COLUMN user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
