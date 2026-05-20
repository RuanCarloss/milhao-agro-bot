import { createClient } from "@supabase/supabase-js";

export type ExternalMessagesConfig = {
  base_url: string;
  table_name: string;
  service_role_key: string;
};

export function buildExternalMessagesAdmin(cfg: ExternalMessagesConfig) {
  return createClient(cfg.base_url, cfg.service_role_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
