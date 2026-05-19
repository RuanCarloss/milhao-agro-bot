import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Link as LinkIcon, Database } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { getSettings, saveSettings } from "@/lib/n8n.functions";
import {
  externalMessagesSupabase,
  EXTERNAL_MESSAGES_TABLE,
} from "@/integrations/supabase/external-messages-client";
import { useAccess } from "@/lib/use-access";
import { ShieldOff } from "lucide-react";
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
          <SettingsForm />
          <SupabaseMessagesInfo />
        </div>
      )}
    </AppShell>
  );
}

function SettingsForm() {
  const fetchSettings = useServerFn(getSettings);
  const saveFn = useServerFn(saveSettings);
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setBaseUrl(data.base_url ?? "");
      setWorkflowId(data.workflow_id ?? "");
    }
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveFn({ data: { base_url: baseUrl, api_key: apiKey, workflow_id: workflowId } });
      toast.success("Conectado! Configurações salvas.");
      setApiKey("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Conexão com o n8n</h1>
        <p className="text-muted-foreground mt-1">Informe os dados da sua instância n8n e o ID do workflow do bot.</p>
      </header>

      <Card className="glass p-6 shadow-card">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="url">URL da instância n8n</Label>
              <Input id="url" type="url" placeholder="https://meu-n8n.exemplo.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Sem barra no final. Ex: https://n8n.minhaempresa.com</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">API Key</Label>
              <Input id="key" type="password" placeholder={data ? "•••••••• (deixe para manter ou cole nova)" : "n8n_api_..."} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Crie em <span className="font-mono">Settings → API</span> dentro do n8n.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf">Workflow ID</Label>
              <Input id="wf" placeholder="Ex: 7" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Pegue na URL do workflow no n8n: <span className="font-mono">/workflow/&lt;id&gt;</span></p>
            </div>
            <Button type="submit" disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Testar e salvar
            </Button>
          </form>
        )}
      </Card>

      <Card className="glass p-5 mt-4 flex items-start gap-3">
        <LinkIcon className="size-5 text-primary mt-0.5" />
        <div className="text-sm text-muted-foreground">
          O sistema valida sua conexão chamando o endpoint do workflow no n8n antes de salvar.
        </div>
      </Card>
    </section>
  );
}

function SupabaseMessagesInfo() {
  const projectUrl = "https://yenrqvkldkpktmjsuofn.supabase.co";
  const projectRef = "yenrqvkldkpktmjsuofn";
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<
    | { ok: true; count: number }
    | { ok: false; message: string }
    | null
  >(null);

  const testConnection = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const { count, error } = await externalMessagesSupabase
        .from(EXTERNAL_MESSAGES_TABLE)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      setStatus({ ok: true, count: count ?? 0 });
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

      <Card className="glass p-6 shadow-card space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Project Ref</Label>
            <Input value={projectRef} readOnly className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label>URL do projeto</Label>
            <Input value={projectUrl} readOnly className="font-mono" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tabela</Label>
          <Input value={EXTERNAL_MESSAGES_TABLE} readOnly className="font-mono" />
          <p className="text-xs text-muted-foreground">
            Colunas esperadas: <span className="font-mono">message</span>,{" "}
            <span className="font-mono">grupo</span>,{" "}
            <span className="font-mono">created_at</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
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
      </Card>

      <Card className="glass p-5 mt-4 flex items-start gap-3">
        <LinkIcon className="size-5 text-primary mt-0.5" />
        <div className="text-sm text-muted-foreground">
          Para alterar URL, chave ou nome da tabela, peça uma mudança no código —
          esses valores ficam fixos no cliente do Supabase externo.
        </div>
      </Card>
    </section>
  );
}
