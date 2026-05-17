import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetDashboardStats, useGetDashboardGuilds } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Users, Server, Clock, HardDrive, Wifi, LogOut } from "lucide-react";
import { clearToken, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

function StatCard({ title, value, icon: Icon, description }: { title: string; value: string | React.ReactNode; icon: React.ElementType; description?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}j ${h}h ${m}m`;
}

export default function Hub() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!getToken()) setLocation("/");
  }, [setLocation]);

  const { data: stats, isError: statsError, error: rawStatsError } = useGetDashboardStats({
    query: { refetchInterval: 30000, retry: false }
  });

  const { data: guilds, isError: guildsError } = useGetDashboardGuilds({
    query: { retry: false }
  });

  useEffect(() => {
    if (statsError || guildsError) {
      const err = (rawStatsError as any);
      if (err?.status === 401) {
        clearToken();
        setLocation("/");
      }
    }
  }, [statsError, guildsError, rawStatsError, setLocation]);

  const handleLogout = () => {
    clearToken();
    setLocation("/");
  };

  if (!stats || !guilds) {
    return (
      <div className="min-h-screen p-8 space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono uppercase flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${stats.online ? "bg-green-500" : "bg-destructive"} shadow-[0_0_10px_currentColor]`} />
            Centre de Contrôle
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">{stats.tag}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="w-full md:w-auto gap-2">
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4 uppercase tracking-widest text-muted-foreground text-sm">Télémétrie Globale</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Serveurs" value={stats.guildCount.toLocaleString('fr-FR')} icon={Server} />
          <StatCard title="Utilisateurs" value={stats.userCount.toLocaleString('fr-FR')} icon={Users} />
          <StatCard title="Latence WS" value={`${stats.wsPing} ms`} icon={Wifi} />
          <StatCard title="Mémoire" value={`${stats.memoryMB.toFixed(1)} MB`} icon={HardDrive} />
          <StatCard title="Disponibilité" value={formatUptime(stats.uptimeSeconds)} icon={Clock} className="md:col-span-2" />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 uppercase tracking-widest text-muted-foreground text-sm">Serveurs Gérés</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {guilds.map((guild) => (
            <Link key={guild.id} href={`/guilds/${guild.id}`} className="group block focus:outline-none">
              <Card className="h-full border-border bg-card hover:border-primary/50 transition-colors cursor-pointer group-focus-visible:ring-2 ring-primary">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
                    {guild.iconURL ? (
                      <img src={guild.iconURL} alt={guild.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-mono text-muted-foreground">{guild.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <CardTitle className="truncate text-base" title={guild.name}>{guild.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">{guild.memberCount.toLocaleString('fr-FR')} membres</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
