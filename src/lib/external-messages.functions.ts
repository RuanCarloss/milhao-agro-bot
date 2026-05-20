import { createServerFn } from "@tanstack/react-start";
import {
  getExternalMessagesAdmin,
  EXTERNAL_MESSAGES_TABLE,
} from "@/integrations/supabase/external-messages.server";

export type ExternalMessage = {
  id: string;
  message: string;
  recipient: string | null;
  date: string | null;
};

export const listExternalMessages = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ data: ExternalMessage[]; error: string | null }> => {
    try {
      const supabase = getExternalMessagesAdmin();
      const { data, error } = await supabase
        .from(EXTERNAL_MESSAGES_TABLE)
        .select("id, message, grupo, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("listExternalMessages error:", error);
        return { data: [], error: error.message };
      }
      const rows = (data ?? []) as Array<{
        id: string | number;
        message: string | null;
        grupo: string | null;
        created_at: string | null;
      }>;
      return {
        data: rows.map((r) => ({
          id: String(r.id),
          message: r.message ?? "",
          recipient: r.grupo,
          date: r.created_at,
        })),
        error: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      console.error("listExternalMessages exception:", msg);
      return { data: [], error: msg };
    }
  },
);

export const pingExternalMessages = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; count: number; error: string | null }> => {
    try {
      const supabase = getExternalMessagesAdmin();
      const { count, error } = await supabase
        .from(EXTERNAL_MESSAGES_TABLE)
        .select("*", { count: "exact", head: true });
      if (error) return { ok: false, count: 0, error: error.message };
      return { ok: true, count: count ?? 0, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      return { ok: false, count: 0, error: msg };
    }
  },
);
