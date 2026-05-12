import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Pencil, Save, X, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { syncAndListVersions, saveVersionNote, deleteVersion } from "@/lib/changelog.functions";
import { useAccess } from "@/lib/use-access";

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
});

type Version = {
  version_id: string;
  n8n_updated_at: string | null;
  title: string | null;
  description: string | null;
  updated_at: string;
};

function ChangelogPage() {
  const access = useAccess();
  const qc = useQueryClient();
  const list = useServerFn(syncAndListVersions);
  const save = useServerFn(saveVersionNote);
  const remove = useServerFn(deleteVersion);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["workflow-versions"],
    queryFn: () => list(),
  });

  const saveMut = useMutation({
    mutationFn: (vars: { version_id: string; title: string; description: string }) =>
      save({ data: vars }),
    onSuccess: () => {
      toast.success("Notas salvas");
      qc.invalidateQueries({ queryKey: ["workflow-versions"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: (version_id: string) => remove({ data: { version_id } }),
    onSuccess: () => {
      toast.success("Versão removida");
      qc.invalidateQueries({ queryKey: ["workflow-versions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; description: string }>({ title: "", description: "" });

  const versions = (data ?? []) as Version[];

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="size-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Notas de atualização</h1>
              <p className="text-muted-foreground">
                Versões detectadas no n8n. {access.canEditSettings ? "Edite a descrição de cada versão." : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando versões…
          </div>
        )}
        {error && (
          <Card className="border-destructive/40">
            <CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent>
          </Card>
        )}

        {!isLoading && versions.length === 0 && (
          <Card className="glass border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhuma versão registrada ainda. Clique em <b>Sincronizar</b> para puxar a versão atual do workflow.
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {versions.map((v, idx) => {
            const isEditing = editing === v.version_id;
            const date = v.n8n_updated_at ? new Date(v.n8n_updated_at) : null;
            return (
              <Card key={v.version_id} className="glass border-border">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {v.version_id.slice(0, 8)}
                      </span>
                      {idx === 0 && (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          Atual
                        </Badge>
                      )}
                      {v.title && !isEditing && (
                        <span className="text-base font-semibold">{v.title}</span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {date
                        ? date.toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Data desconhecida"}
                    </p>
                  </div>
                  {access.canEditSettings && !isEditing && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(v.version_id);
                          setDraft({ title: v.title ?? "", description: v.description ?? "" });
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Remover esta versão do histórico?")) delMut.mutate(v.version_id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        placeholder="Título da versão (ex: Correção de bug no envio)"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      />
                      <Textarea
                        placeholder="Descreva o que mudou nesta versão…"
                        rows={5}
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            saveMut.mutate({
                              version_id: v.version_id,
                              title: draft.title.trim(),
                              description: draft.description.trim(),
                            })
                          }
                          disabled={saveMut.isPending}
                        >
                          {saveMut.isPending ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="size-4 mr-2" />
                          )}
                          Salvar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                          <X className="size-4 mr-2" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : v.description ? (
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">{v.description}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      Sem descrição. {access.canEditSettings && "Clique no lápis para adicionar."}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
