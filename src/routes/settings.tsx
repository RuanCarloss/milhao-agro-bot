import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Link as LinkIcon, Database, ShieldOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  getMessagesConnection,
  saveMessagesConnection,
  pingExternalMessages,
} from "@/lib/external-messages.functions";
import { useAccess } from "@/lib/use-access";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });


function SettingsPage() {
  const access = useAccess();
  return (
    <AppShell>
      {access.loading ? (
        <div className="px-6 py-12 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : !access.canEditSettings ? (
        <div className="px-6 py-12">
          <Card className="glass p-8 max-w-xl mx-auto text-center">
            <ShieldOff className="size-10 text-destructive mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
            <p className="text-muted-foreground">Você não tem permissão para editar as configurações. Solicite acesso a um administrador.</p>
          </Card>
        </div>
      ) : (
        <div className="px-4 md:px-10 py-8 max-w-2xl space-y-8">
          <SupabaseMessagesInfo />
        </div>
      )}
    </AppShell>
  );
}

function SupabaseMessagesInfo() {
  const queryClient = useQueryClient();
  const fetchConn = useServerFn(getMessagesConnection);
  const saveConn = useServerFn(saveMessagesConnection);
  const pingFn = useServerFn(pingExternalMessages);

  const { data: conn, isLoading } = useQuery({
    queryKey: ["messages-connection"],
    queryFn: () => fetchConn(),
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [tableName, setTableName] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<
    | { ok: true; count: number }
    | { ok: false; message: string }
    | null
  >(null);

  useEffect(() => {
    if (conn) {
      setBaseUrl(conn.base_url);
      setTableName(conn.table_name);
    } else if (conn === null) {
      setBaseUrl("https://yenrqvkldkpktmjsuofn.supabase.co");
      setTableName("Message-Agro-Bot");
    }
  }, [conn]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveConn({
        data: {
          base_url: baseUrl.trim(),
          table_name: tableName.trim(),
          service_role_key: serviceKey.trim() || undefined,
        },
      });
      toast.success("Conexão salva!");
      setServiceKey("");
      queryClient.invalidateQueries({ queryKey: ["messages-connection"] });
      queryClient.invalidateQueries({ queryKey: ["supabase-messages"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const res = await pingFn();
      if (!res.ok) throw new Error(res.error ?? "Falha ao conectar");
      setStatus({ ok: true, count: res.count });
      toast.success("Conexão OK!");
    } catch (err: any) {
      const msg = err?.message ?? "Falha ao conectar";
      setStatus({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section>
      <header className="mb-4 flex items-center gap-3">
        <Database className="size-6 text-accent" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conexão com o Supabase (Mensagens)</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Banco externo onde o bot registra as mensagens enviadas, lido pela aba Mensagens.
          </p>
        </div>
      </header>

      <Card className="glass p-6 shadow-card">
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sb-url">URL do projeto Supabase</Label>
              <Input
                id="sb-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://xxxx.supabase.co"
                className="font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sb-table">Nome da tabela</Label>
              <Input
                id="sb-table"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Message-Agro-Bot"
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Colunas esperadas: <span className="font-mono">message</span>,{" "}
                <span className="font-mono">grupo</span>,{" "}
                <span className="font-mono">created_at</span>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sb-key">
                Service role key {conn?.has_key && <span className="text-xs text-muted-foreground">(deixe em branco para manter a atual)</span>}
              </Label>
              <Input
                id="sb-key"
                type="password"
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value)}
                placeholder={conn?.has_key ? "••••••••" : "Cole aqui a service_role key"}
                className="font-mono"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                A chave fica armazenada no banco e nunca é exposta no frontend. Encontre em: Supabase → Project Settings → API → service_role.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={busy}
                className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar conexão
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={testing || !conn?.has_key}
                className="gap-2"
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
                Testar conexão
              </Button>
              {status?.ok && (
                <span className="text-sm text-success">
                  {status.count} registro(s) acessível(eis).
                </span>
              )}
              {status && !status.ok && (
                <span className="text-sm text-destructive">{status.message}</span>
              )}
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}

