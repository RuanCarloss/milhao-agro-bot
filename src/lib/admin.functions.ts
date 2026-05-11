import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Permission = "control_bot" | "edit_settings";

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const [{ data: roles }, { data: perms }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_permissions").select("permission").eq("user_id", userId),
    ]);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const set = new Set((perms ?? []).map((p: any) => p.permission as Permission));
    return {
      isAdmin,
      canControlBot: isAdmin || set.has("control_bot"),
      canEditSettings: isAdmin || set.has("edit_settings"),
    };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { data: usersData, error: usersErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (usersErr) throw new Error(usersErr.message);

    const ids = usersData.users.map((u) => u.id);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    const { data: perms } = await supabaseAdmin
      .from("user_permissions")
      .select("user_id, permission")
      .in("user_id", ids);

    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      isAdmin: (roles ?? []).some((r) => r.user_id === u.id && r.role === "admin"),
      permissions: (perms ?? [])
        .filter((p) => p.user_id === u.id)
        .map((p) => p.permission as Permission),
    }));
  });

export const setUserPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        permission: z.enum(["control_bot", "edit_settings"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_permissions")
        .upsert(
          { user_id: data.targetUserId, permission: data.permission, granted_by: userId },
          { onConflict: "user_id,permission" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_permissions")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("permission", data.permission);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
