import { createClient } from "@supabase/supabase-js";

// Cliente admin (service role) para o Supabase externo que armazena
// as mensagens enviadas pelo bot. SERVER-ONLY.
const EXTERNAL_SUPABASE_URL = "https://yenrqvkldkpktmjsuofn.supabase.co";
export const EXTERNAL_MESSAGES_TABLE = "Message-Agro-Bot";

export function getExternalMessagesAdmin() {
  const key = process.env.EXTERNAL_MESSAGES_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "EXTERNAL_MESSAGES_SERVICE_ROLE_KEY não configurada no servidor.",
    );
  }
  return createClient(EXTERNAL_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
