import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertEditor(supabase: any, userId: string) {
  const [{ data: admin }, { data: perm }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase.from("user_permissions").select("permission").eq("user_id", userId).eq("permission", "edit_settings").maybeSingle(),
  ]);
  if (!admin && !perm) throw new Error("Sem permissão.");
}

async function loadN8n(supabase: any) {
  const { data, error } = await supabase
    .from("n8n_settings")
    .select("base_url, api_key, workflow_id")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Configurações do n8n não encontradas.");
  return data as { base_url: string; api_key: string; workflow_id: string };
}

export const syncAndListVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    // Best-effort sync: fetch current workflow to capture versionId/updatedAt
    try {
      const s = await loadN8n(supabase);
      const res = await fetch(s.base_url.replace(/\/$/, "") + `/api/v1/workflows/${s.workflow_id}`, {
        headers: { "X-N8N-API-KEY": s.api_key },
      });
      if (res.ok) {
        const wf = await res.json();
        const versionId: string | undefined = wf.versionId ?? wf.id?.toString();
        const updatedAt: string | undefined = wf.updatedAt;
        if (versionId) {
          const { data: existing } = await supabase
            .from("workflow_versions")
            .select("version_id")
            .eq("version_id", versionId)
            .maybeSingle();
          if (!existing) {
            await supabase.from("workflow_versions").insert({
              version_id: versionId,
              n8n_updated_at: updatedAt ?? new Date().toISOString(),
            });
          } else if (updatedAt) {
            await supabase
              .from("workflow_versions")
              .update({ n8n_updated_at: updatedAt })
              .eq("version_id", versionId)
              .is("n8n_updated_at", null);
          }
        }
      }
    } catch {
      // ignore — still return what's saved
    }

    const { data, error } = await supabase
      .from("workflow_versions")
      .select("version_id, n8n_updated_at, title, description, updated_at")
      .order("n8n_updated_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveVersionNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        version_id: z.string().min(1),
        title: z.string().max(200).nullable().optional(),
        description: z.string().max(5000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertEditor(supabase, userId);
    const { error } = await supabase
      .from("workflow_versions")
      .update({
        title: data.title ?? null,
        description: data.description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("version_id", data.version_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ version_id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertEditor(supabase, userId);
    const { error } = await supabase.from("workflow_versions").delete().eq("version_id", data.version_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
