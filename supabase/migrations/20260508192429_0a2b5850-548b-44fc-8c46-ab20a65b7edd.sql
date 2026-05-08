CREATE TABLE public.n8n_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.n8n_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own settings" ON public.n8n_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own settings" ON public.n8n_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own settings" ON public.n8n_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own settings" ON public.n8n_settings FOR DELETE USING (auth.uid() = user_id);
