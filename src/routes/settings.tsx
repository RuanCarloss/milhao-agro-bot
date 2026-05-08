import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Link as LinkIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { getSettings, saveSettings } from "@/lib/n8n.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <AppShell>
      <SettingsForm />
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
    <div className="px-4 md:px-10 py-8 max-w-2xl">
      <header className="mb-8">
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

      <Card className="glass p-5 mt-6 flex items-start gap-3">
        <LinkIcon className="size-5 text-primary mt-0.5" />
        <div className="text-sm text-muted-foreground">
          O sistema valida sua conexão chamando o endpoint do workflow no n8n antes de salvar. Suas credenciais ficam protegidas e visíveis apenas para você.
        </div>
      </Card>
    </div>
  );
}
