import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildExternalMessagesAdmin,
  type ExternalMessagesConfig,
} from "@/integrations/supabase/external-messages.server";

export type ExternalMessage = {
  id: string;
  message: string;
  recipient: string | null;
  date: string | null;
};

async function assertEditPermission(supabase: any, userId: string) {
  const [{ data: admin }, { data: perm }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase
      .from("user_permissions")
      .select("permission")
      .eq("user_id", userId)
      .eq("permission", "edit_settings")
      .maybeSingle(),
  ]);
  if (!admin && !perm) throw new Error("Sem permissão para editar esta configuração.");
}

async function loadConfig(supabase: any): Promise<ExternalMessagesConfig | null> {
  const { data, error } = await supabase
    .from("supabase_messages_settings")
    .select("base_url, table_name, service_role_key")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExternalMessagesConfig | null) ?? null;
}

// Public read settings — NEVER returns the service_role_key. Just metadata + a flag.
export const getMessagesConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("supabase_messages_settings")
      .select("base_url, table_name, service_role_key, updated_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      base_url: data.base_url as string,
      table_name: data.table_name as string,
      has_key: !!data.service_role_key,
      updated_at: data.updated_at as string,
    };
  });

export const saveMessagesConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        base_url: z.string().url(),
        table_name: z.string().min(1).max(120),
        // Optional: keep existing key if empty string sent
        service_role_key: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertEditPermission(supabase, userId);

    const existing = await loadConfig(supabase);
    const key = (data.service_role_key ?? "").trim() || existing?.service_role_key;
    if (!key) throw new Error("Informe a service role key na primeira configuração.");

    // Validar conexão antes de salvar
    try {
      const test = buildExternalMessagesAdmin({
        base_url: data.base_url,
        table_name: data.table_name,
        service_role_key: key,
      });
      const { error } = await test
        .from(data.table_name)
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(error.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao conectar";
      throw new Error(`Não foi possível conectar: ${msg}`);
    }

    const { error } = await supabase.from("supabase_messages_settings").upsert(
      {
        singleton: true,
        user_id: userId,
        base_url: data.base_url,
        table_name: data.table_name,
        service_role_key: key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "singleton" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pingExternalMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; count: number; error: string | null }> => {
    const { supabase } = context as any;
    try {
      const cfg = await loadConfig(supabase);
      if (!cfg) return { ok: false, count: 0, error: "Conexão não configurada." };
      const admin = buildExternalMessagesAdmin(cfg);
      const { count, error } = await admin
        .from(cfg.table_name)
        .select("*", { count: "exact", head: true });
      if (error) return { ok: false, count: 0, error: error.message };
      return { ok: true, count: count ?? 0, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      return { ok: false, count: 0, error: msg };
    }
  });

export const listExternalMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ data: ExternalMessage[]; error: string | null }> => {
    const { supabase } = context as any;
    try {
      const cfg = await loadConfig(supabase);
      if (!cfg) return { data: [], error: "Conexão não configurada." };
      const admin = buildExternalMessagesAdmin(cfg);
      const { data, error } = await admin
        .from(cfg.table_name)
        .select("id, message, grupo, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return { data: [], error: error.message };
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
      return { data: [], error: msg };
    }
  });
