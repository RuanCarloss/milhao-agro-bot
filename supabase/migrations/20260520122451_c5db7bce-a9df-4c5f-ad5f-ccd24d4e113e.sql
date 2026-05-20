
CREATE TABLE IF NOT EXISTS public.supabase_messages_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  base_url text NOT NULL,
  table_name text NOT NULL DEFAULT 'Message-Agro-Bot',
  service_role_key text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supabase_messages_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read supabase messages settings"
  ON public.supabase_messages_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "editors insert supabase messages settings"
  ON public.supabase_messages_settings FOR INSERT
  TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'edit_settings'::app_permission));

CREATE POLICY "editors update supabase messages settings"
  ON public.supabase_messages_settings FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), 'edit_settings'::app_permission))
  WITH CHECK (has_permission(auth.uid(), 'edit_settings'::app_permission));

CREATE POLICY "editors delete supabase messages settings"
  ON public.supabase_messages_settings FOR DELETE
  TO authenticated
  USING (has_permission(auth.uid(), 'edit_settings'::app_permission));
