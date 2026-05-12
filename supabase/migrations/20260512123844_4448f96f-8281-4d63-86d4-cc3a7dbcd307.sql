CREATE TABLE public.workflow_versions (
  version_id text PRIMARY KEY,
  n8n_updated_at timestamptz,
  title text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read workflow versions"
  ON public.workflow_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "editors insert workflow versions"
  ON public.workflow_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'));

CREATE POLICY "editors update workflow versions"
  ON public.workflow_versions FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_settings'))
  WITH CHECK (public.has_permission(auth.uid(), 'edit_settings'));

CREATE POLICY "editors delete workflow versions"
  ON public.workflow_versions FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_settings'));

CREATE INDEX idx_workflow_versions_updated ON public.workflow_versions (n8n_updated_at DESC);