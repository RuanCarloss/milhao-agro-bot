import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wrench, Bug, Plus } from "lucide-react";

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
});

type ChangeType = "added" | "improved" | "fixed";

type Release = {
  version: string;
  date: string;
  title: string;
  changes: { type: ChangeType; text: string }[];
};

const releases: Release[] = [
  {
    version: "1.3.0",
    date: "2026-05-12",
    title: "Configurações globais",
    changes: [
      { type: "improved", text: "Conexões do n8n e NocoDB agora são gerenciadas pelo administrador e compartilhadas com todos os usuários." },
      { type: "improved", text: "Usuários comuns acessam dados sem precisar configurar credenciais." },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-05-11",
    title: "Painel de admin e permissões",
    changes: [
      { type: "added", text: "Painel de administração restrito ao e-mail do ADM." },
      { type: "added", text: "Permissões granulares: control_bot e edit_settings por usuário." },
      { type: "added", text: "Filtro por período (data inicial/final) na aba de Mensagens." },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-05-10",
    title: "Tema laranja",
    changes: [
      { type: "improved", text: "Novo esquema de cores em tons de laranja/âmbar mantendo o tema escuro." },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-05-08",
    title: "Lançamento inicial",
    changes: [
      { type: "added", text: "Integração com a API do n8n para iniciar/parar o workflow do bot." },
      { type: "added", text: "Dashboard de mensagens enviadas, com dados vindos do NocoDB." },
      { type: "added", text: "Autenticação por e-mail e senha." },
    ],
  },
];

const typeMeta: Record<ChangeType, { label: string; icon: typeof Plus; className: string }> = {
  added: { label: "Novo", icon: Plus, className: "bg-primary/15 text-primary border-primary/30" },
  improved: { label: "Melhorado", icon: Wrench, className: "bg-accent/15 text-accent border-accent/30" },
  fixed: { label: "Correção", icon: Bug, className: "bg-muted text-foreground border-border" },
};

function ChangelogPage() {
  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
        <header className="flex items-center gap-3">
          <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Notas de atualização</h1>
            <p className="text-muted-foreground">Histórico de versões e mudanças do workflow</p>
          </div>
        </header>

        <div className="space-y-6">
          {releases.map((r) => (
            <Card key={r.version} className="glass border-border">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <span>v{r.version}</span>
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {r.title}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.date).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {r.changes.map((c, i) => {
                    const meta = typeMeta[c.type];
                    const Icon = meta.icon;
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${meta.className}`}
                        >
                          <Icon className="size-3" />
                          {meta.label}
                        </span>
                        <span className="text-sm text-foreground/90 flex-1">{c.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
