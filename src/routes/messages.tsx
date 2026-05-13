import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Calendar, Download, FileSpreadsheet, FileText,
  Loader2, RefreshCw, AlertCircle, Search, CalendarIcon, X,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  format, parseISO, startOfDay, endOfDay, startOfMonth, eachDayOfInterval,
  subDays, isValid, differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, MoreHorizontal } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getNocoMessages, getNocoSettings } from "@/lib/nocodb.functions";

export const Route = createFileRoute("/messages")({ component: MessagesRoute });

function MessagesRoute() {
  return (
    <AppShell>
      <Messages />
    </AppShell>
  );
}

function safeParse(d: string | null): Date | null {
  if (!d) return null;
  try {
    const p = parseISO(d);
    if (isValid(p)) return p;
    const n = new Date(d);
    return isValid(n) ? n : null;
  } catch {
    return null;
  }
}

function Messages() {
  const fetchSettings = useServerFn(getNocoSettings);
  const fetchMessages = useServerFn(getNocoMessages);

  const settings = useQuery({ queryKey: ["noco-settings"], queryFn: () => fetchSettings() });
  const hasSettings = !!settings.data;

  const msgs = useQuery({
    queryKey: ["noco-messages"],
    queryFn: () => fetchMessages({ data: { limit: 500 } }),
    enabled: hasSettings,
    refetchInterval: 30000,
  });

  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const items = msgs.data ?? [];

  const dateFiltered = useMemo(() => {
    if (!range?.from) return items;
    const from = startOfDay(range.from).getTime();
    const to = endOfDay(range.to ?? range.from).getTime();
    return items.filter((m) => {
      const d = safeParse(m.date);
      if (!d) return false;
      const t = d.getTime();
      return t >= from && t <= to;
    });
  }, [items, range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dateFiltered;
    return dateFiltered.filter(
      (m) =>
        m.message.toLowerCase().includes(q) ||
        (m.recipient ?? "").toLowerCase().includes(q),
    );
  }, [dateFiltered, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now).getTime();
    const monthStart = startOfMonth(now).getTime();
    let todayCount = 0, monthCount = 0;
    items.forEach((m) => {
      const d = safeParse(m.date);
      if (!d) return;
      const t = d.getTime();
      if (t >= today) todayCount++;
      if (t >= monthStart) monthCount++;
    });
    return { total: items.length, today: todayCount, month: monthCount };
  }, [items]);

  const dailySeries = useMemo(() => {
    const end = range?.to ?? range?.from ?? new Date();
    const start = range?.from ?? subDays(new Date(), 13);
    const span = Math.min(Math.max(differenceInCalendarDays(end, start), 0), 90);
    const days = eachDayOfInterval({ start: subDays(end, span), end });
    const map = new Map(days.map((d) => [format(d, "yyyy-MM-dd"), 0]));
    dateFiltered.forEach((m) => {
      const d = safeParse(m.date);
      if (!d) return;
      const k = format(d, "yyyy-MM-dd");
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([d, count]) => ({
      day: format(parseISO(d), "dd/MM"), count,
    }));
  }, [dateFiltered, range]);

  const exportXlsx = () => {
    const rows = filtered.map((m) => {
      const d = safeParse(m.date);
      return {
        ID: m.id,
        Data: d ? format(d, "dd/MM/yyyy") : "",
        Hora: d ? format(d, "HH:mm:ss") : "",
        Destinatário: m.recipient ?? "",
        Mensagem: m.message,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mensagens");
    XLSX.writeFile(wb, `mensagens-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
  };

  const exportCsv = () => {
    const rows = filtered.map((m) => {
      const d = safeParse(m.date);
      return {
        id: m.id,
        data: d ? format(d, "yyyy-MM-dd") : "",
        hora: d ? format(d, "HH:mm:ss") : "",
        destinatario: m.recipient ?? "",
        mensagem: m.message,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mensagens-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Mensagens enviadas pelo bot", 14, 16);
    doc.setFontSize(10);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} • Total: ${filtered.length}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Data", "Hora", "Destinatário", "Mensagem"]],
      body: filtered.map((m) => {
        const d = safeParse(m.date);
        return [
          d ? format(d, "dd/MM/yyyy") : "",
          d ? format(d, "HH:mm:ss") : "",
          m.recipient ?? "",
          (m.message || "").slice(0, 200),
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 180, 200] },
    });
    doc.save(`mensagens-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  };

  if (!settings.isLoading && !hasSettings) {
    return (
      <div className="px-6 md:px-10 py-12">
        <Card className="glass p-8 max-w-xl mx-auto text-center">
          <AlertCircle className="size-10 text-warning mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Configure a conexão com o NocoDB</h2>
          <p className="text-muted-foreground mb-5">Informe a URL, token de API e o ID da tabela das mensagens.</p>
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
            <h1 className="text-3xl font-bold tracking-tight">Mensagens enviadas</h1>
            <Badge variant="outline">NocoDB</Badge>
          </div>
          <p className="text-muted-foreground">Histórico de mensagens registradas pelo bot.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-2", !range && "text-muted-foreground")}
              >
                <CalendarIcon className="size-4" />
                {range?.from
                  ? range.to
                    ? `${format(range.from, "dd/MM/yy")} – ${format(range.to, "dd/MM/yy")}`
                    : format(range.from, "dd/MM/yy")
                  : "Período"}
                {range?.from && (
                  <X
                    className="size-3.5 ml-1 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRange(undefined); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              <div className="flex justify-between items-center p-2 border-t border-border">
                <span className="text-xs text-muted-foreground px-2">
                  {filtered.length} resultado(s)
                </span>
                <Button variant="ghost" size="sm" onClick={() => setRange(undefined)}>Limpar</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => msgs.refetch()}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${msgs.isFetching ? "animate-spin" : ""}`} /> Atualizar
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
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={MessageSquare} label="Total de mensagens" value={stats.total} accent="primary" />
        <StatCard icon={Calendar} label="Hoje" value={stats.today} accent="accent" />
        <StatCard icon={Calendar} label="Este mês" value={stats.month} accent="success" />
      </section>

      <section>
        <Card className="glass p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Mensagens por dia {range?.from ? "(período selecionado)" : "(14d)"}</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.04 50 / 0.4)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0.02 60)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 60)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.02 50)", border: "1px solid oklch(0.35 0.04 50)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section>
        <Card className="glass shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold">Histórico</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 w-64"
                  placeholder="Buscar mensagem ou destinatário…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span className="text-xs text-muted-foreground">{filtered.length} de {items.length}</span>
            </div>
          </div>
          {msgs.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : msgs.isError ? (
            <div className="p-6 text-sm text-destructive">{(msgs.error as Error)?.message}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="min-w-[300px]">Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma mensagem encontrada</TableCell></TableRow>
                  ) : filtered.slice(0, 200).map((m) => {
                    const d = safeParse(m.date);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">
                          {d ? format(d, "dd MMM yyyy", { locale: ptBR }) : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {d ? format(d, "HH:mm:ss") : "—"}
                        </TableCell>
                        <TableCell className="text-sm align-top">
                          <RecipientCell value={m.recipient} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={m.message}>
                          {m.message || <span className="opacity-50 italic">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

function RecipientCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="opacity-50 italic">—</span>;
  const list = value
    .split(/[,;\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (list.length <= 1) {
    return <span className="text-sm">{list[0] ?? value}</span>;
  }

  const preview = list[0];
  const remaining = list.length - 1;

  return (
    <Popover>
      <div className="flex items-center gap-1.5 max-w-[260px]">
        <Users className="size-3.5 text-muted-foreground shrink-0" />
        <span className="truncate text-sm" title={preview}>{preview}</span>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 gap-1 text-xs text-primary hover:text-primary shrink-0"
          >
            +{remaining}
            <MoreHorizontal className="size-3" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Destinatários
          </span>
          <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
        </div>
        <ScrollArea className="max-h-64">
          <ul className="py-1">
            {list.map((r, i) => (
              <li
                key={`${r}-${i}`}
                className="px-3 py-1.5 text-sm hover:bg-accent/40 flex items-center gap-2"
              >
                <span className="size-1.5 rounded-full bg-primary/70 shrink-0" />
                <span className="truncate" title={r}>{r}</span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
