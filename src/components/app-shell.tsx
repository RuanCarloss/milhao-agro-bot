import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bot, LayoutDashboard, MessageSquare, Settings, LogOut, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/use-access";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const access = useAccess();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/messages", label: "Mensagens", icon: MessageSquare, show: true },
    { to: "/settings", label: "Conexões", icon: Settings, show: access.canEditSettings },
    { to: "/admin", label: "Admin", icon: Shield, show: access.isAdmin },
  ].filter((i) => i.show);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border glass">
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Bot className="size-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold leading-tight">Bot Console</p>
            <p className="text-xs text-muted-foreground">n8n workflow</p>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = path === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border glass">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Bot className="size-4 text-primary-foreground" />
            </div>
            <span className="font-bold">Bot Console</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {navItems.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded-md text-sm ${path === to ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
