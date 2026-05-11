import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Calendar, Clock, Download, FileSpreadsheet, FileText,
  Loader2, Play, Square, RefreshCw, AlertCircle, CheckCircle2, XCircle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO, startOfDay, startOfMonth, eachDayOfInterval, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getExecutions, getWorkflowStatus, setWorkflowActive, getSettings } from "@/lib/n8n.functions";
import { useAccess } from "@/lib/use-access";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: DashboardRoute });

function DashboardRoute() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const fetchExecutions = useServerFn(getExecutions);
  const fetchStatus = useServerFn(getWorkflowStatus);
  const setActiveFn = useServerFn(setWorkflowActive);

  const settings = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });
  const hasSettings = !!settings.data;

  const status = useQuery({
    queryKey: ["status"], queryFn: () => fetchStatus(),
    enabled: hasSettings, refetchInterval: 30000,
  });
  const execs = useQuery({
    queryKey: ["executions"], queryFn: () => fetchExecutions({ data: { limit: 100 } }),
    enabled: hasSettings, refetchInterval: 30000,
  });

  const toggleBot = useMutation({
    mutationFn: (active: boolean) => setActiveFn({ data: { active } }),
    onSuccess: (_d, active) => {
      toast.success(active ? "Bot ativado" : "Bot pausado");
      qc.invalidateQueries({ queryKey: ["status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const items = execs.data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now).getTime();
    const monthStart = startOfMonth(now).getTime();
    let success = 0, error = 0, totalMs = 0, runs = 0, todayCount = 0, monthCount = 0;
    items.forEach((e) => {
      const t = e.startedAt ? new Date(e.startedAt).getTime() : 0;
      if (t >= today) todayCount++;
      if (t >= monthStart) monthCount++;
      if (e.status === "success") success++;
      else if (e.status === "error" || e.status === "failed") error++;
      if (e.durationMs > 0) { totalMs += e.durationMs; runs++; }
    });
    return {
      total: items.length, today: todayCount, month: monthCount,
      success, error, avgMs: runs ? totalMs / runs : 0,
    };
  }, [items]);

  const dailySeries = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
    const map = new Map(days.map((d) => [format(d, "yyyy-MM-dd"), 0]));
    items.forEach((e) => {
      if (!e.startedAt) return;
      const k = format(parseISO(e.startedAt), "yyyy-MM-dd");
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([d, count]) => ({
      day: format(parseISO(d), "dd/MM"), count,
    }));
  }, [items]);

  const durationSeries = useMemo(() => {
    return [...items]
      .filter((e) => e.durationMs > 0)
      .slice(0, 30)
      .reverse()
      .map((e, i) => ({ idx: i + 1, seconds: +(e.durationMs / 1000).toFixed(2) }));
  }, [items]);

  const exportXlsx = () => {
    const rows = items.map((e) => ({
      ID: e.id,
      Data: e.startedAt ? format(parseISO(e.startedAt), "dd/MM/yyyy") : "",
      Hora: e.startedAt ? format(parseISO(e.startedAt), "HH:mm:ss") : "",
      Status: e.status,
      "Duração (s)": e.durationMs ? +(e.durationMs / 1000).toFixed(2) : 0,
      Mensagem: e.message,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Execuções");
    XLSX.writeFile(wb, `execucoes-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
  };

  const exportCsv = () => {
    const rows = items.map((e) => ({
      id: e.id,
      data: e.startedAt ? format(parseISO(e.startedAt), "yyyy-MM-dd") : "",
      hora: e.startedAt ? format(parseISO(e.startedAt), "HH:mm:ss") : "",
      status: e.status,
      duracao_s: e.durationMs ? +(e.durationMs / 1000).toFixed(2) : 0,
      mensagem: e.message,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `execucoes-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Execuções do Bot n8n", 14, 16);
    doc.setFontSize(10);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} • Total: ${items.length}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Data", "Hora", "Status", "Duração (s)", "Mensagem"]],
      body: items.map((e) => [
        e.startedAt ? format(parseISO(e.startedAt), "dd/MM/yyyy") : "",
        e.startedAt ? format(parseISO(e.startedAt), "HH:mm:ss") : "",
        e.status,
        e.durationMs ? (e.durationMs / 1000).toFixed(2) : "0",
        (e.message || "").slice(0, 120),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 180, 200] },
    });
    doc.save(`execucoes-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  };

  if (!settings.isLoading && !hasSettings) {
    return (
      <div className="px-6 md:px-10 py-12">
        <Card className="glass p-8 max-w-xl mx-auto text-center">
          <AlertCircle className="size-10 text-warning mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Configure a conexão com o n8n</h2>
          <p className="text-muted-foreground mb-5">Para começar, informe a URL, API Key e o ID do workflow.</p>
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Link to="/settings">Ir para configuração</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-10 py-6 space-y-6">
      <header className="flex flex-col lg:flex-row gap-4 lg:items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Painel do Bot</h1>
            <StatusPill loading={status.isLoading} active={status.data?.active} />
          </div>
          <p className="text-muted-foreground">
            {status.data?.name ? `Workflow: ${status.data.name}` : "Monitorando execuções em tempo real"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { execs.refetch(); status.refetch(); }}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${execs.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="size-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportXlsx}><FileSpreadsheet className="size-4 mr-2" />Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}><FileSpreadsheet className="size-4 mr-2" />CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf}><FileText className="size-4 mr-2" />PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {status.data?.active ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={toggleBot.isPending}
              onClick={() => toggleBot.mutate(false)}
              className="gap-2"
            >
              {toggleBot.isPending ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
              Parar bot
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={toggleBot.isPending}
              onClick={() => toggleBot.mutate(true)}
              className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              {toggleBot.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Ativar bot
            </Button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Execuções (total)" value={stats.total} accent="primary" />
        <StatCard icon={Calendar} label="Hoje" value={stats.today} accent="accent" />
        <StatCard icon={Calendar} label="Este mês" value={stats.month} accent="success" />
        <StatCard
          icon={Clock}
          label="Duração média"
          value={stats.avgMs ? `${(stats.avgMs / 1000).toFixed(1)}s` : "—"}
          accent="warning"
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Card className="glass p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Execuções por dia (14d)</h3>
            <Badge variant="outline" className="text-xs">{stats.success} sucesso · {stats.error} erro</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.04 50 / 0.4)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0.02 60)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 60)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.02 50)", border: "1px solid oklch(0.35 0.04 50)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Tempo de execução (últimas)</h3>
            <Badge variant="outline" className="text-xs">segundos</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={durationSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.04 50 / 0.4)" />
                <XAxis dataKey="idx" stroke="oklch(0.7 0.02 60)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 60)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.02 50)", border: "1px solid oklch(0.35 0.04 50)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="seconds" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section>
        <Card className="glass shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Execuções recentes</h3>
            <span className="text-xs text-muted-foreground">{items.length} registros</span>
          </div>
          {execs.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : execs.isError ? (
            <div className="p-6 text-sm text-destructive">{(execs.error as Error)?.message}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead className="min-w-[300px]">Mensagem enviada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem execuções ainda</TableCell></TableRow>
                  ) : items.slice(0, 50).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">
                        {e.startedAt ? format(parseISO(e.startedAt), "dd MMM yyyy", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.startedAt ? format(parseISO(e.startedAt), "HH:mm:ss") : "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.durationMs ? `${(e.durationMs / 1000).toFixed(2)}s` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={e.message}>
                        {e.message || <span className="opacity-50 italic">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: string | number; accent: "primary" | "accent" | "success" | "warning" }) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    accent: "text-accent bg-accent/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <Card className="glass p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`size-10 rounded-xl flex items-center justify-center ${colors[accent]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

function StatusPill({ loading, active }: { loading: boolean; active?: boolean }) {
  if (loading) return <Badge variant="outline" className="gap-1.5"><Loader2 className="size-3 animate-spin" />verificando</Badge>;
  if (active) return <Badge className="bg-success/15 text-success border border-success/30 gap-1.5"><span className="size-2 rounded-full bg-success animate-pulse" />Operante</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border border-destructive/30 gap-1.5"><span className="size-2 rounded-full bg-destructive" />Parado</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge className="bg-success/15 text-success border border-success/30 gap-1"><CheckCircle2 className="size-3" />sucesso</Badge>;
  if (status === "error" || status === "failed") return <Badge className="bg-destructive/15 text-destructive border border-destructive/30 gap-1"><XCircle className="size-3" />erro</Badge>;
  return <Badge variant="outline" className="gap-1"><Clock className="size-3" />{status}</Badge>;
}
