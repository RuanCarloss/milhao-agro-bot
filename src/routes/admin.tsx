import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { listUsers, setUserPermission, type Permission } from "@/lib/admin.functions";
import { useAccess } from "@/lib/use-access";

export const Route = createFileRoute("/admin")({ component: AdminRoute });

function AdminRoute() {
  return (
    <AppShell>
      <Admin />
    </AppShell>
  );
}

function Admin() {
  const access = useAccess();

  if (access.loading) {
    return (
      <div className="px-6 py-12 flex justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!access.isAdmin) {
    return (
      <div className="px-6 py-12">
        <Card className="glass p-8 max-w-xl mx-auto text-center">
          <ShieldOff className="size-10 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
          <p className="text-muted-foreground">Esta área é exclusiva para administradores.</p>
        </Card>
      </div>
    );
  }

  return <UsersPanel />;
}

function UsersPanel() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const setPermFn = useServerFn(setUserPermission);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  const togglePerm = useMutation({
    mutationFn: (vars: { targetUserId: string; permission: Permission; grant: boolean }) =>
      setPermFn({ data: vars }),
    onSuccess: () => {
      toast.success("Permissão atualizada");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="px-4 md:px-10 py-6 space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Shield className="size-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Painel de Admin</h1>
        </div>
        <p className="text-muted-foreground">
          Conceda permissões para outros usuários acessarem o controle do bot e as configurações.
        </p>
      </header>

      <Card className="glass shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Usuários</h3>
          <span className="text-xs text-muted-foreground">{users.data?.length ?? 0} cadastrados</span>
        </div>

        {users.isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : users.isError ? (
          <div className="p-6 text-sm text-destructive">{(users.error as Error)?.message}</div>
        ) : (
          <div className="divide-y divide-border">
            {(users.data ?? []).map((u) => {
              const has = (p: Permission) => u.permissions.includes(p);
              return (
                <div key={u.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{u.email}</p>
                      {u.isAdmin && (
                        <Badge className="bg-primary/15 text-primary border border-primary/30">Admin</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…</p>
                  </div>

                  <div className="flex flex-wrap gap-5">
                    <PermToggle
                      label="Controlar bot"
                      checked={u.isAdmin || has("control_bot")}
                      disabled={u.isAdmin || togglePerm.isPending}
                      onChange={(v) =>
                        togglePerm.mutate({ targetUserId: u.id, permission: "control_bot", grant: v })
                      }
                    />
                    <PermToggle
                      label="Editar configurações"
                      checked={u.isAdmin || has("edit_settings")}
                      disabled={u.isAdmin || togglePerm.isPending}
                      onChange={(v) =>
                        togglePerm.mutate({ targetUserId: u.id, permission: "edit_settings", grant: v })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function PermToggle({
  label, checked, disabled, onChange,
}: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <span className={disabled ? "text-muted-foreground" : ""}>{label}</span>
    </label>
  );
}
