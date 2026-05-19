import { createClient } from "@supabase/supabase-js";

// Cliente para o Supabase externo que armazena as mensagens enviadas pelo bot.
// Chave publishable (anon) — segura para uso no frontend.
const EXTERNAL_SUPABASE_URL = "https://yenrqvkldkpktmjsuofn.supabase.co";
const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Gm7OXfyRkZQGa17O6fTcKg_EC_lt276";

export const externalMessagesSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export const EXTERNAL_MESSAGES_TABLE = "Message-Agro-Bot";
