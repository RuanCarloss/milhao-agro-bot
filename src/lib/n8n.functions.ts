import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPermission(supabase: any, userId: string, permission: "control_bot" | "edit_settings") {
  const [{ data: admin }, { data: perm }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase.from("user_permissions").select("permission").eq("user_id", userId).eq("permission", permission).maybeSingle(),
  ]);
  if (!admin && !perm) throw new Error("Sem permissão para esta ação.");
}

async function loadSettings(supabase: any, _userId?: string) {
  const { data, error } = await supabase
    .from("n8n_settings")
    .select("base_url, api_key, workflow_id")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Configurações do n8n não encontradas. Peça ao administrador para configurar.");
  return data as { base_url: string; api_key: string; workflow_id: string };
}

function n8nFetch(baseUrl: string, apiKey: string, path: string, init?: RequestInit) {
  const url = baseUrl.replace(/\/$/, "") + path;
  return fetch(url, {
    ...init,
    headers: {
      "X-N8N-API-KEY": apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data } = await supabase
      .from("n8n_settings")
      .select("base_url, workflow_id")
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        base_url: z.string().url(),
        api_key: z.string().min(1),
        workflow_id: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertPermission(supabase, userId, "edit_settings");
    const res = await n8nFetch(data.base_url, data.api_key, `/api/v1/workflows/${data.workflow_id}`);
    if (!res.ok) {
      throw new Error(`Falha ao conectar no n8n (${res.status}). Verifique URL, API Key e Workflow ID.`);
    }
    const { error } = await supabase.from("n8n_settings").upsert(
      {
        singleton: true,
        user_id: userId,
        base_url: data.base_url,
        api_key: data.api_key,
        workflow_id: data.workflow_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "singleton" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getWorkflowStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const s = await loadSettings(supabase, userId);
    const res = await n8nFetch(s.base_url, s.api_key, `/api/v1/workflows/${s.workflow_id}`);
    if (!res.ok) throw new Error(`n8n: ${res.status}`);
    const wf = await res.json();
    return { active: !!wf.active, name: wf.name as string };
  });

export const setWorkflowActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertPermission(supabase, userId, "control_bot");
    const s = await loadSettings(supabase, userId);
    const action = data.active ? "activate" : "deactivate";
    const res = await n8nFetch(s.base_url, s.api_key, `/api/v1/workflows/${s.workflow_id}/${action}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Falha ao ${action}: ${res.status}`);
    return { ok: true, active: data.active };
  });

export const getExecutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().min(1).max(250).default(100) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const s = await loadSettings(supabase, userId);
    const url = `/api/v1/executions?workflowId=${encodeURIComponent(s.workflow_id)}&limit=${data.limit}&includeData=true`;
    const res = await n8nFetch(s.base_url, s.api_key, url);
    if (!res.ok) throw new Error(`n8n: ${res.status}`);
    const json = await res.json();
    const items = (json.data ?? []) as any[];

    // Extract a "message" from the execution data (best-effort)
    const extractMessage = (exec: any): string => {
      try {
        const runData = exec?.data?.resultData?.runData;
        if (!runData) return "";
        for (const nodeName of Object.keys(runData)) {
          const runs = runData[nodeName];
          for (const r of runs) {
            const main = r?.data?.main;
            if (Array.isArray(main)) {
              for (const branch of main) {
                if (Array.isArray(branch)) {
                  for (const item of branch) {
                    const j = item?.json ?? {};
                    const msg =
                      j.message ?? j.text ?? j.body ?? j.content ?? j.output ?? j.response ?? null;
                    if (typeof msg === "string" && msg.trim()) return msg.slice(0, 500);
                    if (msg && typeof msg === "object") return JSON.stringify(msg).slice(0, 500);
                  }
                }
              }
            }
          }
        }
      } catch {}
      return "";
    };

    return items.map((e: any) => {
      const started = e.startedAt ? new Date(e.startedAt).getTime() : 0;
      const stopped = e.stoppedAt ? new Date(e.stoppedAt).getTime() : 0;
      return {
        id: String(e.id),
        startedAt: e.startedAt as string,
        stoppedAt: (e.stoppedAt ?? null) as string | null,
        status: (e.status ?? (e.finished ? "success" : "running")) as string,
        mode: (e.mode ?? "") as string,
        durationMs: stopped && started ? stopped - started : 0,
        message: extractMessage(e),
      };
    });
  });
