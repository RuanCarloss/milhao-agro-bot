CREATE TABLE public.nocodb_settings (
  user_id UUID PRIMARY KEY,
  base_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  table_id TEXT NOT NULL,
  view_id TEXT,
  message_field TEXT NOT NULL DEFAULT 'message',
  date_field TEXT NOT NULL DEFAULT 'CreatedAt',
  recipient_field TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nocodb_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own nocodb settings" ON public.nocodb_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own nocodb settings" ON public.nocodb_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own nocodb settings" ON public.nocodb_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own nocodb settings" ON public.nocodb_settings FOR DELETE USING (auth.uid() = user_id);