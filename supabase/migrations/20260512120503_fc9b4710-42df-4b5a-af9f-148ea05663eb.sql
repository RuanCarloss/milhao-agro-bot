
-- n8n_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'n8n_settings_pkey') THEN
    ALTER TABLE public.n8n_settings DROP CONSTRAINT n8n_settings_pkey;
  END IF;
END $$;
ALTER TABLE public.n8n_settings ADD COLUMN IF NOT EXISTS singleton boolean NOT NULL DEFAULT true;
ALTER TABLE public.n8n_settings ALTER COLUMN user_id DROP NOT NULL;
DELETE FROM public.n8n_settings a USING public.n8n_settings b WHERE a.ctid < b.ctid;
UPDATE public.n8n_settings SET singleton = true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'n8n_settings_singleton_uk') THEN
    ALTER TABLE public.n8n_settings ADD CONSTRAINT n8n_settings_singleton_uk UNIQUE (singleton);
  END IF;
END $$;

DROP POLICY IF EXISTS "users delete own settings" ON public.n8n_settings;
DROP POLICY IF EXISTS "users insert own settings" ON public.n8n_settings;
DROP POLICY IF EXISTS "users select own settings" ON public.n8n_settings;
DROP POLICY IF EXISTS "users update own settings" ON public.n8n_settings;

CREATE POLICY "authenticated read n8n settings" ON public.n8n_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors insert n8n settings" ON public.n8n_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'));
CREATE POLICY "editors update n8n settings" ON public.n8n_settings
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'edit_settings'))
  WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'));
CREATE POLICY "editors delete n8n settings" ON public.n8n_settings
  FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'edit_settings'));

-- nocodb_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nocodb_settings_pkey') THEN
    ALTER TABLE public.nocodb_settings DROP CONSTRAINT nocodb_settings_pkey;
  END IF;
END $$;
ALTER TABLE public.nocodb_settings ADD COLUMN IF NOT EXISTS singleton boolean NOT NULL DEFAULT true;
ALTER TABLE public.nocodb_settings ALTER COLUMN user_id DROP NOT NULL;
DELETE FROM public.nocodb_settings a USING public.nocodb_settings b WHERE a.ctid < b.ctid;
UPDATE public.nocodb_settings SET singleton = true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nocodb_settings_singleton_uk') THEN
    ALTER TABLE public.nocodb_settings ADD CONSTRAINT nocodb_settings_singleton_uk UNIQUE (singleton);
  END IF;
END $$;

DROP POLICY IF EXISTS "users delete own nocodb settings" ON public.nocodb_settings;
DROP POLICY IF EXISTS "users insert own nocodb settings" ON public.nocodb_settings;
DROP POLICY IF EXISTS "users select own nocodb settings" ON public.nocodb_settings;
DROP POLICY IF EXISTS "users update own nocodb settings" ON public.nocodb_settings;

CREATE POLICY "authenticated read nocodb settings" ON public.nocodb_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors insert nocodb settings" ON public.nocodb_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'));
CREATE POLICY "editors update nocodb settings" ON public.nocodb_settings
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'edit_settings'))
  WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'));
CREATE POLICY "editors delete nocodb settings" ON public.nocodb_settings
  FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'edit_settings'));
