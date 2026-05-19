import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetGuildConfig, useUpdateGuildConfig, getGetGuildConfigQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Save, ShieldAlert, Shield, X, RefreshCw, AlertTriangle, Terminal, Settings2, Home, Lock, FileText, Ticket, Bell, BarChart2, BookOpen, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EventLog {
  id: string;
  type: "config_change" | "command_exec" | "bot_error";
  guildId: string | null;
  timestamp: number;
  field?: string;
  oldValue?: string;
  newValue?: string;
  command?: string;
  via?: "slash" | "prefix";
  userTag?: string;
  userId?: string;
  success?: boolean;
  errCode?: string;
  errMessage?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function apiFetch<T>(path: string): Promise<T> {
  const token = getToken();
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => r.json() as Promise<T>);
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tryPretty(raw?: string): string {
  if (!raw) return "—";
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.length === 0 ? "[]" : v.join(", ");
    if (typeof v === "boolean") return v ? "✅ Activé" : "❌ Désactivé";
    if (v === null) return "null";
    return String(v);
  } catch {
    return raw;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TagInput({ value = [], onChange, placeholder }: { value: string[], onChange: (val: string[]) => void, placeholder?: string }) {
  const [input, setInput] = useState("");
  const handleAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) onChange([...value, input.trim()]);
      setInput("");
    }
  };
  const removeTag = (tagToRemove: string) => onChange(value.filter(tag => tag !== tagToRemove));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1 font-mono px-2 py-1">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {value.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun élément</span>}
      </div>
      <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleAdd} placeholder={placeholder} className="font-mono text-sm" />
    </div>
  );
}

// ── Log rows ──────────────────────────────────────────────────────────────────
function ConfigChangeRow({ log }: { log: EventLog }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <Settings2 className="h-4 w-4 mt-0.5 text-blue-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono"><span className="text-foreground font-semibold">{log.field}</span><span className="text-muted-foreground"> modifié</span></p>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
          <span className="text-red-400">{tryPretty(log.oldValue)}</span>{" → "}<span className="text-green-400">{tryPretty(log.newValue)}</span>
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{relativeTime(log.timestamp)} · {log.userTag ?? "dashboard"}</p>
      </div>
    </div>
  );
}

function CommandExecRow({ log }: { log: EventLog }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <Terminal className={`h-4 w-4 mt-0.5 shrink-0 ${log.success ? "text-green-400" : "text-red-400"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono">
          <span className="font-semibold">{log.via === "slash" ? "/" : "&"}{log.command}</span>{" "}
          <Badge variant={log.success ? "outline" : "destructive"} className="text-xs py-0 h-4">{log.success ? "OK" : "ERREUR"}</Badge>{" "}
          <Badge variant="secondary" className="text-xs py-0 h-4">{log.via}</Badge>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(log.timestamp)} · {log.userTag ?? "?"}</p>
      </div>
    </div>
  );
}

function BotErrorRow({ log }: { log: EventLog }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <AlertTriangle className="h-4 w-4 mt-0.5 text-red-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono"><span className="font-semibold text-red-400">{log.errCode}</span><span className="text-muted-foreground"> — {log.command}</span></p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">{log.errMessage ?? "—"}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{relativeTime(log.timestamp)}</p>
      </div>
    </div>
  );
}

// ── Navigation par catégories ─────────────────────────────────────────────────
const CATEGORY_TABS: Record<string, { label: string; icon: string; tabs: string[] }> = {
  general:  { label: "Général",      icon: "🏠", tabs: ["bienvenue", "depart", "statistiques"] },
  securite: { label: "Sécurité",     icon: "🛡️", tabs: ["securite", "captcha", "automod"] },
  config:   { label: "Configuration",icon: "⚙️", tabs: ["logs-config", "tickets", "invitations"] },
  logs:     { label: "Journaux",     icon: "📋", tabs: ["activite"] },
};

function tabCategory(tab: string): string {
  for (const [key, { tabs }] of Object.entries(CATEGORY_TABS)) if (tabs.includes(tab)) return key;
  return "general";
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GuildConfigEditor() {
  const [, params] = useRoute("/guilds/:guildId");
  const guildId = params?.guildId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading, isError } = useGetGuildConfig(guildId);
  const updateConfig = useUpdateGuildConfig();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("general");
  const [activeTab, setActiveTab] = useState("bienvenue");

  // Stats state
  const [stats, setStats] = useState<{
    totalWarns: number; topWarnedUsers: { userId: string; count: number }[];
    activeTempBans: number; activeQuarantines: number; customCommands: number;
    maintenanceActive: boolean; topCommands: { name: string; count: number }[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const token = getToken();

  const { data: allLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery<EventLog[]>({
    queryKey: ["guild-logs", guildId],
    queryFn: () => apiFetch<EventLog[]>(`${base}/api/dashboard/logs/${guildId}?limit=200`),
    refetchInterval: 15000,
    enabled: activeTab === "activite",
  });

  const { data: botErrors = [], isLoading: errorsLoading, refetch: refetchErrors } = useQuery<EventLog[]>({
    queryKey: ["bot-errors"],
    queryFn: () => apiFetch<EventLog[]>(`${base}/api/dashboard/errors?limit=100`),
    refetchInterval: 15000,
    enabled: activeTab === "activite",
  });

  const configLogs = allLogs.filter(l => l.type === "config_change");
  const commandLogs = allLogs.filter(l => l.type === "command_exec");

  useEffect(() => {
    if (config) {
      setFormData(config as Record<string, any>);
      setDirtyFields(new Set());
    }
  }, [config]);

  function fetchStats() {
    setStatsLoading(true);
    fetch(`${base}/api/dashboard/guilds/${guildId}/stats`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
      .catch(() => null)
      .finally(() => setStatsLoading(false));
  }

  if (isError) {
    return (
      <div className="min-h-screen p-10 flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold font-mono">Erreur d'Accès</h2>
        <p className="text-muted-foreground">Impossible de charger la configuration pour ce serveur.</p>
        <Button onClick={() => setLocation("/guilds")} className="mt-6" variant="outline">Retour au Hub</Button>
      </div>
    );
  }

  if (isLoading || !config) {
    return (
      <div className="min-h-screen p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setDirtyFields(prev => { const next = new Set(prev); next.add(field); return next; });
  };

  const handleSave = () => {
    if (dirtyFields.size === 0) return;
    const patch: Record<string, any> = {};
    dirtyFields.forEach(field => { patch[field] = formData[field]; });
    updateConfig.mutate({ guildId, data: patch as any }, {
      onSuccess: (updatedData) => {
        toast({ title: "Configuration sauvegardée", description: "Les modifications ont été appliquées avec succès." });
        setDirtyFields(new Set());
        queryClient.setQueryData(getGetGuildConfigQueryKey(guildId), updatedData);
      },
      onError: () => {
        toast({ title: "Erreur de sauvegarde", description: "Impossible d'appliquer les modifications.", variant: "destructive" });
      }
    });
  };

  function handleTabChange(v: string) {
    setActiveTab(v);
    setActiveCategory(tabCategory(v));
    if (v === "statistiques" && !stats) fetchStats();
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/50 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/guilds" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ChevronLeft className="h-4 w-4" /> Hub
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold font-mono uppercase flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                Config Serveur
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono truncate">ID: {guildId}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={dirtyFields.size === 0 || updateConfig.isPending} size="sm" className="gap-2 font-mono uppercase tracking-widest shrink-0">
            <Save className="h-3.5 w-3.5" />
            {updateConfig.isPending ? "Enregistrement…" : dirtyFields.size > 0 ? `Sauvegarder (${dirtyFields.size})` : "Sauvegarder"}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">

          {/* ── Barre de catégories ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1 border-b border-border pb-3">
            {Object.entries(CATEGORY_TABS).map(([key, { label, icon }]) => (
              <button key={key}
                onClick={() => {
                  setActiveCategory(key);
                  const tabs = CATEGORY_TABS[key]!.tabs;
                  const newTab = tabs.includes(activeTab) ? activeTab : tabs[0]!;
                  setActiveTab(newTab);
                  if (newTab === "statistiques" && !stats) fetchStats();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeCategory === key
                    ? key === "securite"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <span>{icon}</span>
                {label}
                <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono ml-0.5">
                  {CATEGORY_TABS[key]!.tabs.length}
                </Badge>
              </button>
            ))}
          </div>

          {/* ── Onglets filtrés par catégorie ───────────────────────────────── */}
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-lg">
            {activeCategory === "general" && <>
              <TabsTrigger value="bienvenue" className="gap-1.5 text-xs"><Home className="h-3.5 w-3.5" />Bienvenue</TabsTrigger>
              <TabsTrigger value="depart" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" />Départ</TabsTrigger>
              <TabsTrigger value="statistiques" className="gap-1.5 text-xs" onClick={() => { if (!stats) fetchStats(); }}><BarChart2 className="h-3.5 w-3.5" />Statistiques</TabsTrigger>
            </>}
            {activeCategory === "securite" && <>
              <TabsTrigger value="securite" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" />Sécurité</TabsTrigger>
              <TabsTrigger value="captcha" className="gap-1.5 text-xs"><Lock className="h-3.5 w-3.5" />Captcha</TabsTrigger>
              <TabsTrigger value="automod" className="gap-1.5 text-xs"><Zap className="h-3.5 w-3.5" />Automodération</TabsTrigger>
            </>}
            {activeCategory === "config" && <>
              <TabsTrigger value="logs-config" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Logs</TabsTrigger>
              <TabsTrigger value="tickets" className="gap-1.5 text-xs"><Ticket className="h-3.5 w-3.5" />Tickets</TabsTrigger>
              <TabsTrigger value="invitations" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" />Invitations</TabsTrigger>
            </>}
            {activeCategory === "logs" && <>
              <TabsTrigger value="activite" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" />Activité</TabsTrigger>
            </>}
          </TabsList>

          {/* ── Bienvenue ─────────────────────────────────────────────────────── */}
          <TabsContent value="bienvenue">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <Home className="h-4 w-4" /> Message de Bienvenue
                </CardTitle>
                <CardDescription>Envoyé automatiquement quand un membre rejoint le serveur.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="font-medium text-sm">Activer le message de bienvenue</p>
                    <p className="text-xs text-muted-foreground">Envoie un message dans le salon configuré.</p>
                  </div>
                  <Switch checked={formData.welcomeEnabled ?? false} onCheckedChange={(v) => handleChange("welcomeEnabled", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canal (ID)</Label>
                  <Input disabled={!formData.welcomeEnabled} value={formData.welcomeChannelId || ""} onChange={(e) => handleChange("welcomeChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</Label>
                  <Textarea disabled={!formData.welcomeEnabled} value={formData.welcomeMessage || ""} onChange={(e) => handleChange("welcomeMessage", e.target.value)} className="min-h-[120px] font-mono text-sm resize-none" placeholder="Bienvenue {user} sur {server} !" />
                  <p className="text-[11px] text-muted-foreground">Variables : <code className="font-mono bg-muted px-1 rounded">{"{user}"}</code>, <code className="font-mono bg-muted px-1 rounded">{"{server}"}</code>, <code className="font-mono bg-muted px-1 rounded">{"{count}"}</code></p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Départ ────────────────────────────────────────────────────────── */}
          <TabsContent value="depart">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Message de Départ
                </CardTitle>
                <CardDescription>Envoyé automatiquement quand un membre quitte le serveur.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="font-medium text-sm">Activer le message de départ</p>
                    <p className="text-xs text-muted-foreground">Envoie un message dans le salon configuré.</p>
                  </div>
                  <Switch checked={formData.leaveEnabled ?? false} onCheckedChange={(v) => handleChange("leaveEnabled", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canal (ID)</Label>
                  <Input disabled={!formData.leaveEnabled} value={formData.leaveChannelId || ""} onChange={(e) => handleChange("leaveChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</Label>
                  <Textarea disabled={!formData.leaveEnabled} value={formData.leaveMessage || ""} onChange={(e) => handleChange("leaveMessage", e.target.value)} className="min-h-[120px] font-mono text-sm resize-none" placeholder="Au revoir {user}..." />
                  <p className="text-[11px] text-muted-foreground">Variables : <code className="font-mono bg-muted px-1 rounded">{"{user}"}</code>, <code className="font-mono bg-muted px-1 rounded">{"{server}"}</code>, <code className="font-mono bg-muted px-1 rounded">{"{count}"}</code></p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Statistiques ──────────────────────────────────────────────────── */}
          <TabsContent value="statistiques">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" /> Statistiques de Modération
                  </CardTitle>
                  <CardDescription>Résumé de l'activité du bot sur ce serveur.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchStats} disabled={statsLoading} className="gap-1.5 shrink-0">
                  {statsLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-48 w-full" /> : !stats ? (
                  <div className="text-center py-8">
                    <BarChart2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucune donnée chargée.</p>
                    <Button variant="outline" size="sm" onClick={fetchStats} className="mt-3 gap-1.5"><RefreshCw className="h-4 w-4" />Charger</Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {stats.maintenanceActive && (
                      <Badge variant="destructive" className="text-xs">🔧 Mode Maintenance Actif</Badge>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Avertissements", value: stats.totalWarns, color: stats.totalWarns > 0 ? "text-yellow-500" : "" },
                        { label: "Tempbans Actifs", value: stats.activeTempBans, color: stats.activeTempBans > 0 ? "text-red-500" : "" },
                        { label: "Quarantaines", value: stats.activeQuarantines, color: stats.activeQuarantines > 0 ? "text-orange-500" : "" },
                        { label: "Cmds Custom", value: stats.customCommands, color: "" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-lg border bg-card p-3 text-center">
                          <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 uppercase">{label}</p>
                        </div>
                      ))}
                    </div>
                    {stats.topCommands.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Top Commandes</p>
                        {stats.topCommands.map(({ name, count }) => (
                          <div key={name} className="flex items-center gap-3">
                            <code className="font-mono text-sm text-primary w-32 truncate">{name}</code>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((count / stats.topCommands[0]!.count) * 100)}%` }} />
                            </div>
                            <span className="font-mono text-xs text-muted-foreground w-8 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Sécurité ──────────────────────────────────────────────────────── */}
          <TabsContent value="securite">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Sécurité
                </CardTitle>
                <CardDescription>Paramètres de protection du serveur contre les raids et comptes suspects.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Niveau de Sécurité</Label>
                  <Select value={String(formData.securityLevel ?? 1)} onValueChange={(v) => handleChange("securityLevel", Number(v))}>
                    <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Standard</SelectItem>
                      <SelectItem value="2">2 — Élevé</SelectItem>
                      <SelectItem value="3">3 — Maximal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    { key: "raidMode", label: "Mode Raid", desc: "Bloque les nouveaux arrivants" },
                    { key: "raidMode2", label: "Mode Raid Avancé", desc: "Filtre strict des comptes récents" },
                    { key: "joinLock", label: "Verrouillage (Join Lock)", desc: "Refuse toutes les connexions" },
                    { key: "suspiciousCheckEnabled", label: "Contrôle Suspect", desc: "Analyse les profils douteux" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-md border">
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch checked={formData[key] ?? false} onCheckedChange={(v) => handleChange(key, v)} />
                    </div>
                  ))}
                </div>

                {/* VPN / Proxy */}
                <div className="pt-2 border-t border-border/50 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div>
                      <p className="font-medium text-sm">🌐 Détection VPN / Proxy</p>
                      <p className="text-xs text-muted-foreground">Signale ou sanctionne les comptes suspects à l'arrivée</p>
                    </div>
                    <Switch checked={formData.vpnCheckEnabled ?? false} onCheckedChange={(v) => handleChange("vpnCheckEnabled", v)} />
                  </div>
                  {formData.vpnCheckEnabled && (
                    <div className="pl-4 border-l-2 border-primary/30 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Âge minimum du compte (jours)</Label>
                        <Input type="number" min={1} max={365} value={formData.vpnCheckMinAgeDays ?? 30} onChange={(e) => handleChange("vpnCheckMinAgeDays", Number(e.target.value))} className="font-mono text-sm h-8" />
                        <p className="text-[11px] text-muted-foreground">Comptes créés depuis moins de X jours → signalés</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</Label>
                        <Select value={formData.vpnCheckAction ?? "kick"} onValueChange={(v) => handleChange("vpnCheckAction", v)}>
                          <SelectTrigger className="font-mono text-sm h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flag">🏴 Signaler uniquement (log)</SelectItem>
                            <SelectItem value="kick">👢 Expulser</SelectItem>
                            <SelectItem value="ban">🔨 Bannir</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">Exiger : pas d'avatar</p>
                          <p className="text-xs text-muted-foreground">Ne déclenche que si le compte n'a pas de photo de profil</p>
                        </div>
                        <Switch checked={formData.vpnCheckRequireNoAvatar ?? false} onCheckedChange={(v) => handleChange("vpnCheckRequireNoAvatar", v)} />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Captcha ───────────────────────────────────────────────────────── */}
          <TabsContent value="captcha">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Vérification Captcha
                </CardTitle>
                <CardDescription>Force les nouveaux membres à résoudre un captcha avant d'accéder au serveur.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="font-medium text-sm">Activer le Captcha</p>
                    <p className="text-xs text-muted-foreground">Vérifie les nouveaux membres via DM.</p>
                  </div>
                  <Switch checked={formData.captchaEnabled ?? false} onCheckedChange={(v) => handleChange("captchaEnabled", v)} />
                </div>
                {[
                  { key: "captchaChannelId", label: "Canal de Vérification (ID)", placeholder: "ID du salon..." },
                  { key: "captchaUnverifiedRoleId", label: "Rôle Non Vérifié (ID)", placeholder: "ID du rôle temporaire..." },
                  { key: "captchaVerifiedRoleId", label: "Rôle Vérifié (ID)", placeholder: "ID du rôle final..." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <Input disabled={!formData.captchaEnabled} value={formData[key] || ""} onChange={(e) => handleChange(key, e.target.value || null)} className="font-mono text-sm" placeholder={placeholder} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Automodération ────────────────────────────────────────────────── */}
          <TabsContent value="automod">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Automodération
                </CardTitle>
                <CardDescription>Filtres automatiques de modération du contenu.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="font-medium text-sm">Anti-Insultes</p>
                    <p className="text-xs text-muted-foreground">Supprime automatiquement les messages contenant des mots interdits.</p>
                  </div>
                  <Switch checked={formData.antiInsultEnabled ?? false} onCheckedChange={(v) => handleChange("antiInsultEnabled", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mots Interdits</Label>
                  <TagInput value={formData.antiInsultWords || []} onChange={(v) => handleChange("antiInsultWords", v)} placeholder="Ajouter un mot puis Entrée..." />
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border pt-2 border-t border-border/50">
                  <div>
                    <p className="font-medium text-sm">Anti-Webhook</p>
                    <p className="text-xs text-muted-foreground">Supprime les messages provenant de webhooks non autorisés.</p>
                  </div>
                  <Switch checked={formData.antiWebhookEnabled ?? false} onCheckedChange={(v) => handleChange("antiWebhookEnabled", v)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Logs Config ───────────────────────────────────────────────────── */}
          <TabsContent value="logs-config">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Salons de Logs
                </CardTitle>
                <CardDescription>Configurez les salons dans lesquels le bot envoie ses journaux.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "generalLogChannelId", label: "Log Général" },
                  { key: "logChannelId", label: "Log Sécurité" },
                  { key: "banLogChannelId", label: "Log Bannissements" },
                  { key: "inviteLogChannelId", label: "Log Invitations" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label} (ID)</Label>
                    <Input value={formData[key] || ""} onChange={(e) => handleChange(key, e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tickets ───────────────────────────────────────────────────────── */}
          <TabsContent value="tickets">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <Ticket className="h-4 w-4" /> Système de Tickets
                </CardTitle>
                <CardDescription>Configurez le système de support par tickets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "ticketCategoryId", label: "Catégorie des Tickets (ID)", placeholder: "ID de la catégorie..." },
                  { key: "ticketStaffRoleId", label: "Rôle Staff (ID)", placeholder: "ID du rôle..." },
                  { key: "transcriptChannelId", label: "Canal Transcripts (ID)", placeholder: "ID du salon..." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <Input value={formData[key] || ""} onChange={(e) => handleChange(key, e.target.value || null)} className="font-mono text-sm" placeholder={placeholder} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Invitations ───────────────────────────────────────────────────── */}
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Invitations & Notifications
                </CardTitle>
                <CardDescription>Gestion des invitations autorisées et des notifications de sanction.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="font-medium text-sm">Notifications de Sanction (DM)</p>
                    <p className="text-xs text-muted-foreground">Prévenir l'utilisateur en message privé lors d'une sanction.</p>
                  </div>
                  <Switch checked={formData.sanctionDmEnabled ?? false} onCheckedChange={(v) => handleChange("sanctionDmEnabled", v)} />
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Codes d'Invitation Autorisés (Whitelist)</Label>
                  <TagInput value={formData.whitelistedInviteCodes || []} onChange={(v) => handleChange("whitelistedInviteCodes", v)} placeholder="ex: codeInvite123 puis Entrée..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Activité (Journaux) ───────────────────────────────────────────── */}
          <TabsContent value="activite">
            <Card>
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Journaux d'activité
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Mis à jour toutes les 15s · données en mémoire (redémarrage = reset)</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { void refetchLogs(); void refetchErrors(); }} className="gap-1 text-xs font-mono shrink-0">
                    <RefreshCw className="h-3 w-3" /> Actualiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs defaultValue="config">
                  <TabsList className="font-mono text-xs mb-4 flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                    <TabsTrigger value="config" className="gap-1 text-xs">
                      <Settings2 className="h-3 w-3" /> Config <Badge variant="secondary" className="ml-1 text-[10px] px-1">{configLogs.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="commands" className="gap-1 text-xs">
                      <Terminal className="h-3 w-3" /> Commandes <Badge variant="secondary" className="ml-1 text-[10px] px-1">{commandLogs.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="errors" className="gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" /> Erreurs <Badge variant={botErrors.length > 0 ? "destructive" : "secondary"} className="ml-1 text-[10px] px-1">{botErrors.length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="config">
                    {logsLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                      : configLogs.length === 0 ? <p className="text-xs text-muted-foreground italic text-center py-6">Aucun changement de configuration enregistré.</p>
                      : <div className="max-h-72 overflow-y-auto pr-1">{configLogs.map(log => <ConfigChangeRow key={log.id} log={log} />)}</div>}
                  </TabsContent>
                  <TabsContent value="commands">
                    {logsLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                      : commandLogs.length === 0 ? <p className="text-xs text-muted-foreground italic text-center py-6">Aucune exécution de commande enregistrée.</p>
                      : <div className="max-h-72 overflow-y-auto pr-1">{commandLogs.map(log => <CommandExecRow key={log.id} log={log} />)}</div>}
                  </TabsContent>
                  <TabsContent value="errors">
                    {errorsLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                      : botErrors.length === 0 ? <p className="text-xs text-muted-foreground italic text-center py-6">✅ Aucune erreur bot enregistrée.</p>
                      : <div className="max-h-72 overflow-y-auto pr-1">{botErrors.map(log => <BotErrorRow key={log.id} log={log} />)}</div>}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* ── Barre de sauvegarde flottante ────────────────────────────────────── */}
      {dirtyFields.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border border-border shadow-xl rounded-full px-6 py-3 flex items-center gap-4 z-50">
          <span className="text-sm font-medium font-mono">{dirtyFields.size} modification(s) non sauvegardée(s)</span>
          <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending} className="font-mono uppercase text-xs">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Sauvegarder
          </Button>
        </div>
      )}
    </div>
  );
}
