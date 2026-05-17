import { useEffect, useState, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { getToken, clearToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Hash, Volume2, FolderOpen, Trash2, UserX, Shield, RefreshCw, Plus, Settings } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
}

type Channel = { id: string; name: string; type: number; parentId: string | null; position: number };
type Member = { id: string; tag: string; displayName: string; avatarURL: string; bot: boolean; joinedAt: string | null; roles: string[] };

const CHANNEL_TYPE_ICON: Record<number, React.ReactNode> = {
  0: <Hash className="h-3.5 w-3.5" />,
  2: <Volume2 className="h-3.5 w-3.5" />,
  4: <FolderOpen className="h-3.5 w-3.5" />,
  5: <Hash className="h-3.5 w-3.5" />,
  15: <Hash className="h-3.5 w-3.5" />,
};

const CHANNEL_TYPE_LABEL: Record<number, string> = {
  0: "Texte",
  2: "Vocal",
  4: "Catégorie",
  5: "Annonce",
  15: "Forum",
};

const VERIFICATION_LABELS = ["Aucune", "Faible", "Moyenne", "Élevée", "Très élevée"];

export default function OwnerPanel() {
  const { guildId } = useParams<{ guildId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState("");

  // Messages state
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Create channel state
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<string>("text");
  const [newChannelParent, setNewChannelParent] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Member action state
  const [actionMemberId, setActionMemberId] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Guild settings state
  const [guildEditName, setGuildEditName] = useState("");
  const [guildVerifLevel, setGuildVerifLevel] = useState<string>("0");
  const [guildSystemChannel, setGuildSystemChannel] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!getToken()) { setLocation("/"); return; }
  }, [setLocation]);

  const fetchChannels = useCallback(async () => {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/channels`);
    if (r.status === 401) { clearToken(); setLocation("/"); return; }
    if (r.ok) setChannels(await r.json());
  }, [guildId, setLocation]);

  const fetchMembers = useCallback(async () => {
    const q = memberSearch ? `?search=${encodeURIComponent(memberSearch)}&limit=50` : "?limit=50";
    const r = await apiFetch(`/api/owner/guilds/${guildId}/members${q}`);
    if (r.ok) setMembers(await r.json());
  }, [guildId, memberSearch]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchChannels(), fetchMembers()]).finally(() => setLoading(false));
  }, [fetchChannels, fetchMembers]);

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);
  const categories = channels.filter((c) => c.type === 4);

  async function sendMessage() {
    if (!selectedChannelId || !messageContent.trim()) return;
    setSendingMsg(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/send`, {
        method: "POST",
        body: JSON.stringify({ channelId: selectedChannelId, content: messageContent.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "Message envoyé ✓", description: `ID: ${data.messageId}` });
        setMessageContent("");
      } else {
        toast({ title: "Erreur", description: data.error, variant: "destructive" });
      }
    } finally {
      setSendingMsg(false);
    }
  }

  async function createChannel() {
    if (!newChannelName.trim()) return;
    setCreatingChannel(true);
    try {
      const body: Record<string, string> = { name: newChannelName.trim(), type: newChannelType };
      if (newChannelParent) body["parentId"] = newChannelParent;
      if (newChannelTopic.trim()) body["topic"] = newChannelTopic.trim();
      const r = await apiFetch(`/api/owner/guilds/${guildId}/channels`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "Salon créé ✓", description: `#${data.name}` });
        setNewChannelName(""); setNewChannelTopic(""); setNewChannelParent("");
        await fetchChannels();
      } else {
        toast({ title: "Erreur", description: data.error, variant: "destructive" });
      }
    } finally {
      setCreatingChannel(false);
    }
  }

  async function deleteChannel(channelId: string, channelName: string) {
    if (!confirm(`Supprimer #${channelName} ? Cette action est irréversible.`)) return;
    const r = await apiFetch(`/api/owner/guilds/${guildId}/channels/${channelId}`, { method: "DELETE" });
    const data = await r.json();
    if (r.ok) {
      toast({ title: "Salon supprimé ✓" });
      await fetchChannels();
    } else {
      toast({ title: "Erreur", description: data.error, variant: "destructive" });
    }
  }

  async function memberAction(action: "kick" | "ban", memberId: string, displayName: string) {
    const confirmed = confirm(`${action === "kick" ? "Expulser" : "Bannir"} ${displayName} ?`);
    if (!confirmed) return;
    setActionLoading(true);
    setActionMemberId(memberId);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/members/${memberId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason: actionReason || undefined }),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: `${action === "kick" ? "Expulsé" : "Banni"} ✓`, description: displayName });
        setActionReason("");
        await fetchMembers();
      } else {
        toast({ title: "Erreur", description: data.error, variant: "destructive" });
      }
    } finally {
      setActionLoading(false);
      setActionMemberId("");
    }
  }

  async function saveGuildSettings() {
    setSavingSettings(true);
    try {
      const body: Record<string, unknown> = {
        name: guildEditName.trim() || undefined,
        verificationLevel: Number(guildVerifLevel),
        systemChannelId: guildSystemChannel || null,
      };
      const r = await apiFetch(`/api/owner/guilds/${guildId}/settings`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "Paramètres sauvegardés ✓", description: data.name });
        setGuildName(data.name);
      } else {
        toast({ title: "Erreur", description: data.error, variant: "destructive" });
      }
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const channelById = Object.fromEntries(channels.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 space-y-6">
      <header className="flex items-center gap-4 border-b border-border pb-5">
        <Link href="/guilds">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-mono uppercase tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Panneau Propriétaire
          </h1>
          <p className="text-muted-foreground font-mono text-sm">{guildName || guildId}</p>
        </div>
      </header>

      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="messages" className="gap-2"><Send className="h-4 w-4" /> Messages</TabsTrigger>
          <TabsTrigger value="channels" className="gap-2"><Hash className="h-4 w-4" /> Salons</TabsTrigger>
          <TabsTrigger value="members" className="gap-2"><UserX className="h-4 w-4" /> Membres</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Serveur</TabsTrigger>
        </TabsList>

        {/* ── MESSAGES ─────────────────────────────────────────────────────── */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">📨 Envoyer un Message</CardTitle>
              <CardDescription>Envoie un message directement dans un salon textuel du serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Salon de destination</label>
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un salon..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <div key={cat.id}>
                        <div className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">{cat.name}</div>
                        {textChannels
                          .filter((c) => c.parentId === cat.id)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-1.5">{CHANNEL_TYPE_ICON[c.type]} #{c.name}</span>
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                    {textChannels.filter((c) => !c.parentId).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-1.5">{CHANNEL_TYPE_ICON[c.type]} #{c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Message</label>
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Tapez votre message ici... (Markdown Discord supporté)"
                  rows={5}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) sendMessage(); }}
                />
                <p className="text-xs text-muted-foreground mt-1">Ctrl+Entrée pour envoyer</p>
              </div>
              <Button
                onClick={sendMessage}
                disabled={sendingMsg || !selectedChannelId || !messageContent.trim()}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {sendingMsg ? "Envoi..." : "Envoyer le message"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SALONS ───────────────────────────────────────────────────────── */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">➕ Créer un Salon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nom du salon</label>
                  <Input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="mon-salon"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Type</label>
                  <Select value={newChannelType} onValueChange={setNewChannelType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">💬 Texte</SelectItem>
                      <SelectItem value="voice">🔊 Vocal</SelectItem>
                      <SelectItem value="category">📁 Catégorie</SelectItem>
                      <SelectItem value="announcement">📢 Annonce</SelectItem>
                      <SelectItem value="forum">💬 Forum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Catégorie parente (optionnel)</label>
                  <Select value={newChannelParent} onValueChange={setNewChannelParent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune catégorie</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description / Topic (optionnel)</label>
                  <Input
                    value={newChannelTopic}
                    onChange={(e) => setNewChannelTopic(e.target.value)}
                    placeholder="Description du salon..."
                  />
                </div>
              </div>
              <Button
                onClick={createChannel}
                disabled={creatingChannel || !newChannelName.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {creatingChannel ? "Création..." : "Créer le salon"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-mono uppercase">📋 Salons existants</CardTitle>
                <CardDescription>{channels.length} salons</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchChannels} className="gap-1">
                <RefreshCw className="h-4 w-4" /> Actualiser
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {channels.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40 group">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{CHANNEL_TYPE_ICON[c.type]}</span>
                      <span className={c.type === 4 ? "font-semibold uppercase text-xs text-muted-foreground" : ""}>
                        {c.type !== 4 ? "#" : ""}{c.name}
                      </span>
                      {c.parentId && c.type !== 4 && (
                        <span className="text-xs text-muted-foreground">
                          — {channelById[c.parentId]?.name ?? "?"}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs hidden group-hover:inline-flex">
                        {CHANNEL_TYPE_LABEL[c.type] ?? c.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChannel(c.id, c.name)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MEMBRES ──────────────────────────────────────────────────────── */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-mono uppercase">👥 Gestion des Membres</CardTitle>
                <CardDescription>{members.length} membres affichés</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Rechercher un membre..."
                  onKeyDown={(e) => { if (e.key === "Enter") fetchMembers(); }}
                />
                <Button variant="outline" size="sm" onClick={fetchMembers}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Raison des actions (optionnel)</label>
                <Input
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Raison pour kick/ban..."
                  className="max-w-sm"
                />
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {members.filter((m) => !m.bot).map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <img src={m.avatarURL} alt={m.tag} className="h-9 w-9 rounded-full border border-border" />
                      <div>
                        <div className="font-medium text-sm">{m.displayName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.tag}</div>
                        {m.roles.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {m.roles.slice(0, 3).map((r) => (
                              <Badge key={r} variant="outline" className="text-xs py-0 px-1 h-4">{r}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => memberAction("kick", m.id, m.displayName)}
                        disabled={actionLoading && actionMemberId === m.id}
                        className="gap-1.5 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                      >
                        <UserX className="h-3.5 w-3.5" /> Kick
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => memberAction("ban", m.id, m.displayName)}
                        disabled={actionLoading && actionMemberId === m.id}
                        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Shield className="h-3.5 w-3.5" /> Ban
                      </Button>
                    </div>
                  </div>
                ))}
                {members.filter((m) => !m.bot).length === 0 && (
                  <div className="text-center text-muted-foreground py-8 text-sm">Aucun membre trouvé.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PARAMÈTRES SERVEUR ───────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">⚙️ Paramètres du Serveur</CardTitle>
              <CardDescription>Modification directe des paramètres Discord du serveur. Le bot doit avoir la permission Gérer le serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nom du serveur</label>
                  <Input
                    value={guildEditName}
                    onChange={(e) => setGuildEditName(e.target.value)}
                    placeholder="Laisser vide pour ne pas changer"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Niveau de vérification</label>
                  <Select value={guildVerifLevel} onValueChange={setGuildVerifLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERIFICATION_LABELS.map((label, i) => (
                        <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Salon système (messages Discord)</label>
                  <Select value={guildSystemChannel} onValueChange={setGuildSystemChannel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun salon système" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun salon système</SelectItem>
                      {textChannels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={saveGuildSettings} disabled={savingSettings} className="gap-2">
                <Settings className="h-4 w-4" />
                {savingSettings ? "Sauvegarde..." : "Appliquer les changements"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
