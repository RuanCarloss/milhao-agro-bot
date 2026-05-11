import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type NocoSettings = {
  base_url: string;
  api_token: string;
  table_id: string;
  view_id: string | null;
  message_field: string;
  date_field: string;
  recipient_field: string | null;
};

async function loadSettings(supabase: any, userId: string): Promise<NocoSettings> {
  const { data, error } = await supabase
    .from("nocodb_settings")
    .select("base_url, api_token, table_id, view_id, message_field, date_field, recipient_field")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Configurações do NocoDB não encontradas. Configure primeiro.");
  return data as NocoSettings;
}

function nocoFetch(baseUrl: string, token: string, path: string, init?: RequestInit) {
  const url = baseUrl.replace(/\/$/, "") + path;
  return fetch(url, {
    ...init,
    headers: {
      "xc-token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export const getNocoSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("nocodb_settings")
      .select("base_url, table_id, view_id, message_field, date_field, recipient_field")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  });

export const saveNocoSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        base_url: z.string().url(),
        api_token: z.string().min(1),
        table_id: z.string().min(1),
        view_id: z.string().optional().nullable(),
        message_field: z.string().min(1),
        date_field: z.string().min(1),
        recipient_field: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const [{ data: admin }, { data: perm }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabase.from("user_permissions").select("permission").eq("user_id", userId).eq("permission", "edit_settings").maybeSingle(),
    ]);
    if (!admin && !perm) throw new Error("Sem permissão para editar configurações.");
    const params = new URLSearchParams({ limit: "1" });
    if (data.view_id) params.set("viewId", data.view_id);
    const res = await nocoFetch(
      data.base_url,
      data.api_token,
      `/api/v2/tables/${data.table_id}/records?${params.toString()}`,
    );
    if (!res.ok) {
      throw new Error(`Falha ao conectar no NocoDB (${res.status}). Verifique URL, token e Table ID.`);
    }
    const { error } = await supabase.from("nocodb_settings").upsert({
      user_id: userId,
      base_url: data.base_url,
      api_token: data.api_token,
      table_id: data.table_id,
      view_id: data.view_id || null,
      message_field: data.message_field,
      date_field: data.date_field,
      recipient_field: data.recipient_field || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type NocoMessage = {
  id: string;
  date: string | null;
  message: string;
  recipient: string | null;
  raw: Record<string, any>;
};

export const getNocoMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().min(1).max(1000).default(500) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const s = await loadSettings(supabase, userId);

    const all: any[] = [];
    let offset = 0;
    const pageSize = 100;
    while (all.length < data.limit) {
      const params = new URLSearchParams({
        limit: String(Math.min(pageSize, data.limit - all.length)),
        offset: String(offset),
        sort: `-${s.date_field}`,
      });
      if (s.view_id) params.set("viewId", s.view_id);
      const res = await nocoFetch(
        s.base_url,
        s.api_token,
        `/api/v2/tables/${s.table_id}/records?${params.toString()}`,
      );
      if (!res.ok) throw new Error(`NocoDB: ${res.status}`);
      const json = await res.json();
      const list = (json.list ?? json.data ?? []) as any[];
      if (list.length === 0) break;
      all.push(...list);
      const pageInfo = json.pageInfo;
      if (pageInfo?.isLastPage || list.length < pageSize) break;
      offset += list.length;
    }

    return all.map((row, idx): NocoMessage => {
      const id = String(row.Id ?? row.id ?? row.ID ?? idx);
      const dateRaw = row[s.date_field] ?? row.CreatedAt ?? row.created_at ?? null;
      const messageRaw = row[s.message_field];
      const message =
        typeof messageRaw === "string"
          ? messageRaw
          : messageRaw != null
            ? JSON.stringify(messageRaw)
            : "";
      const recipient = s.recipient_field ? (row[s.recipient_field] ?? null) : null;
      return { id, date: dateRaw, message, recipient: recipient ? String(recipient) : null, raw: row };
    });
  });
