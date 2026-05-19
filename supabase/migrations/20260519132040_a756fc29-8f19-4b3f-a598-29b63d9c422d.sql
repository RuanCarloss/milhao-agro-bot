CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL DEFAULT '',
  recipient text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_sent_at ON public.messages (sent_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "editors insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'::app_permission));

CREATE POLICY "editors update messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_settings'::app_permission))
  WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'::app_permission));

CREATE POLICY "editors delete messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_settings'::app_permission));

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;