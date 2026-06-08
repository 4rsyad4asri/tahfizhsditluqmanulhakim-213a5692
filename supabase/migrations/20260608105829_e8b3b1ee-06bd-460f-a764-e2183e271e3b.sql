
-- 1. Extend app_role enum (guru, parent)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guru';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

-- 2. Create account_status enum
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pending','approved','rejected','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS display_name_rapor text,
  ADD COLUMN IF NOT EXISTS display_name_certificate text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS jabatan text,
  ADD COLUMN IF NOT EXISTS nip text,
  ADD COLUMN IF NOT EXISTS assigned_classes uuid[],
  ADD COLUMN IF NOT EXISTS status public.account_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz NOT NULL DEFAULT now();

-- 4. Unique case-insensitive username index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 5. Backfill existing profiles → approved
UPDATE public.profiles
SET status = 'approved',
    approved_at = COALESCE(approved_at, created_at),
    registered_at = COALESCE(registered_at, created_at)
WHERE status IS NULL OR status = 'pending';

-- Sync email from auth.users for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 6. Trigger: prevent non-admin users from changing role/status/approved fields on profiles
CREATE OR REPLACE FUNCTION public.profiles_guard_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.assigned_classes IS DISTINCT FROM OLD.assigned_classes
       OR NEW.nip IS DISTINCT FROM OLD.nip THEN
      RAISE EXCEPTION 'Field admin-only tidak boleh diubah pengguna';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_admin_fields_trg ON public.profiles;
CREATE TRIGGER profiles_guard_admin_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_admin_fields();

-- 7. Updated_at trigger
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Update handle_new_user trigger to capture extra metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_role public.app_role;
  v_status public.account_status;
BEGIN
  -- role
  BEGIN
    v_role := COALESCE(NULLIF(meta->>'role',''), 'penguji')::public.app_role;
  EXCEPTION WHEN others THEN v_role := 'penguji'; END;

  -- created by admin → approved; self-signup → pending
  IF COALESCE((meta->>'created_by_admin')::boolean, false) THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, username, email, whatsapp, bio,
    status, registered_at,
    approved_at, approved_by
  ) VALUES (
    NEW.id,
    COALESCE(meta->>'full_name',''),
    NULLIF(meta->>'username',''),
    NEW.email,
    NULLIF(meta->>'whatsapp',''),
    NULLIF(meta->>'bio',''),
    v_status,
    now(),
    CASE WHEN v_status='approved' THEN now() ELSE NULL END,
    NULLIF(meta->>'approved_by','')::uuid
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- if guru with classes, store in assigned_classes
  IF v_role = 'guru' AND (meta ? 'assigned_classes') THEN
    UPDATE public.profiles
      SET assigned_classes = ARRAY(SELECT (jsonb_array_elements_text(meta->'assigned_classes'))::uuid)
      WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger on auth.users exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. is_account_approved helper
CREATE OR REPLACE FUNCTION public.is_account_approved(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND status = 'approved')
$$;

-- 10. profiles RLS — ensure user can read own + admin can read all + public read of safe fields stays (assume policies exist; we add missing ones)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins manage all profiles') THEN
    CREATE POLICY "Admins manage all profiles" ON public.profiles
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin'))
      WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- 11. parent_students
CREATE TABLE IF NOT EXISTS public.parent_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_students TO authenticated;
GRANT ALL ON public.parent_students TO service_role;

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parent_students' AND policyname='Parents see their links') THEN
    CREATE POLICY "Parents see their links" ON public.parent_students
      FOR SELECT TO authenticated
      USING (parent_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parent_students' AND policyname='Admins manage parent_students') THEN
    CREATE POLICY "Admins manage parent_students" ON public.parent_students
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin'))
      WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- 12. Storage RLS policies (buckets created via tool separately)
-- avatars: read public, write own folder
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_public_read') THEN
    CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_own_write') THEN
    CREATE POLICY "avatars_own_write" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_own_update') THEN
    CREATE POLICY "avatars_own_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_own_delete') THEN
    CREATE POLICY "avatars_own_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='signatures_public_read') THEN
    CREATE POLICY "signatures_public_read" ON storage.objects FOR SELECT
      USING (bucket_id = 'signatures');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='signatures_own_write') THEN
    CREATE POLICY "signatures_own_write" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id='signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='signatures_own_update') THEN
    CREATE POLICY "signatures_own_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id='signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='signatures_own_delete') THEN
    CREATE POLICY "signatures_own_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id='signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
