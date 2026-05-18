import { useEffect, useState, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { getToken, clearToken, decodeToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft, Send, Hash, Volume2, FolderOpen, Trash2, UserX, Shield, RefreshCw,
  Plus, Settings, ShieldOff, Lock, Loader2, AlertCircle, FileText, Ban,
  Sliders, Power, PowerOff, Eye, X, Search, FlaskConical,
} from "lucide-react";

function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  return fetch(path, {
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
type BlacklistEntry = { userId: string; userTag: string; reason: string; moderatorTag: string; moderatorId: string; createdAt: string };
type DisabledCommand = { id: number; guildId: string; commandName: string; disabledBy: string; createdAt: string };
type TranscriptMeta = { id: number; guildId: string; guildName: string; channelName: string; ticketNumber: number; userId: string; userTag: string; closedBy: string; reason: string; messageCount: number; createdAt: string; closedAt: string };
type TranscriptFull = TranscriptMeta & { content: string };
type CaptchaLogEntry = {
  id: number; guildId: string; guildName: string; userId: string; userTag: string;
  event: string; details: string; createdAt: string;
};

type BotSettings = {
  guildId: string; captchaEnabled: boolean; captchaChannelId: string | null;
  captchaRoleId: string | null; captchaVerifiedRoleId: string | null;
  captchaTimeoutMins: number; captchaMaxAttempts: number; captchaMode: string;
  welcomeEnabled: boolean; welcomeChannelId: string | null; welcomeMessage: string | null;
};

const CHANNEL_TYPE_ICON: Record<number, React.ReactNode> = {
  0: <Hash className="h-3.5 w-3.5" />, 2: <Volume2 className="h-3.5 w-3.5" />,
  4: <FolderOpen className="h-3.5 w-3.5" />, 5: <Hash className="h-3.5 w-3.5" />, 15: <Hash className="h-3.5 w-3.5" />,
};
const VERIFICATION_LABELS = ["Aucune", "Faible", "Moyenne", "Élevée", "Très élevée"];

const ALL_COMMANDS = [
  "kick","ban","unban","softban","timeout","untimeout","voicemute","warn","warnings","clear",
  "slowmode","lock","unlock","lockserver","nuke","role","nickname","revokeinvites","raidmode",
  "joinlock","hoistrole","blacklist","blacklistinfo","sanctioninfo","blacklistinvite",
  "dashboard","setlog","setbanlog","settranscript","ticketconfig","setgenlog","setinvitelog",
  "ticketpanel","ticket","transcript","testcaptcha","checkinvite","checkinvites",
  "userinfo","serverinfo","serverstats","infome","getid","botinfo","commandlist",
  "rolerequest","suggestion","support","reglement",
  "secure","secureinfo","sendsecuredm","antiinsult","antiwebhook","whitelistinvite",
  "notify","errortest","testinviteembed","tempban","massban","note","purge",
  "antilink","antighostping","autokick","scamlink","badname","antialt","verify-dashboard",
].sort();

export default function OwnerPanel() {
  const { guildId } = useParams<{ guildId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = decodeToken();

  // ── Password gate ──────────────────────────────────────────────────────────
  const [unlocked, setUnlocked] = useState<boolean>(() => sessionStorage.getItem("owner_unlocked") === "1");
  const [pwInput, setPwInput] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true); setPwError(null);
    try {
      const res = await apiFetch("/api/owner/unlock", { method: "POST", body: JSON.stringify({ password: pwInput }) });
      if (res.ok) { sessionStorage.setItem("owner_unlocked", "1"); setUnlocked(true); setPwInput(""); }
      else { const d = await res.json() as { error?: string }; setPwError(d.error ?? "Mot de passe incorrect."); setPwInput(""); }
    } catch { setPwError("Erreur réseau."); }
    finally { setPwLoading(false); }
  }

  useEffect(() => { if (!getToken()) { setLocation("/"); return; } }, [setLocation]);

  // ── Core state ─────────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState("");

  // Messages
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Channels
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<string>("text");
  const [newChannelParent, setNewChannelParent] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Members
  const [actionMemberId, setActionMemberId] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Server
  const [guildEditName, setGuildEditName] = useState("");
  const [guildVerifLevel, setGuildVerifLevel] = useState<string>("0");
  const [guildSystemChannel, setGuildSystemChannel] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Blacklist state ────────────────────────────────────────────────────────
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blLoading, setBlLoading] = useState(false);
  const [newBlUserId, setNewBlUserId] = useState("");
  const [newBlUserTag, setNewBlUserTag] = useState("");
  const [newBlReason, setNewBlReason] = useState("");
  const [addingBl, setAddingBl] = useState(false);
  const [blSearch, setBlSearch] = useState("");

  // ── Disabled commands state ────────────────────────────────────────────────
  const [disabledCmds, setDisabledCmds] = useState<DisabledCommand[]>([]);
  const [dcLoading, setDcLoading] = useState(false);
  const [newCmdName, setNewCmdName] = useState("");
  const [addingDc, setAddingDc] = useState(false);

  // ── Transcripts state ─────────────────────────────────────────────────────
  const [transcripts, setTranscripts] = useState<TranscriptMeta[]>([]);
  const [trLoading, setTrLoading] = useState(false);
  const [viewTranscript, setViewTranscript] = useState<TranscriptFull | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [trSearch, setTrSearch] = useState("");

  // ── Bot settings state ────────────────────────────────────────────────────
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [bsSaving, setBsSaving] = useState(false);

  // ── Captcha logs state ────────────────────────────────────────────────────
  const [captchaLogs, setCaptchaLogs] = useState<CaptchaLogEntry[]>([]);
  const [clLoading, setClLoading] = useState(false);
  const [clFilter, setClFilter] = useState("");

  // ── Test Bot state ────────────────────────────────────────────────────────
  const [testBots, setTestBots] = useState<{ id: string; name: string; channelId: string }[]>([]);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbNewName, setTbNewName] = useState("");
  const [tbNewChannel, setTbNewChannel] = useState("");
  const [tbCreating, setTbCreating] = useState(false);
  const [tbSelected, setTbSelected] = useState("");
  const [tbAction, setTbAction] = useState("message");
  const [tbContent, setTbContent] = useState("");
  const [tbCount, setTbCount] = useState(6);
  const [tbSending, setTbSending] = useState(false);
  const [errTestLoading, setErrTestLoading] = useState(false);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/channels`);
    if (r.status === 401 || r.status === 403) { clearToken(); setLocation("/"); return; }
    if (r.ok) setChannels(await r.json());
  }, [guildId, setLocation]);

  const fetchMembers = useCallback(async (search = "") => {
    const qs = search ? `?search=${encodeURIComponent(search)}&limit=50` : "?limit=50";
    const r = await apiFetch(`/api/owner/guilds/${guildId}/members${qs}`);
    if (r.ok) setMembers(await r.json());
  }, [guildId]);

  const fetchGuildMeta = useCallback(async () => {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/channels`);
    if (!r.ok) return;
    const r2 = await apiFetch(`/api/dashboard/guilds`);
    if (r2.ok) {
      const guilds = await r2.json() as Array<{ id: string; name: string }>;
      const g = guilds.find((g) => g.id === guildId);
      if (g) setGuildName(g.name);
    }
  }, [guildId]);

  const fetchBlacklist = useCallback(async () => {
    setBlLoading(true);
    try {
      const r = await apiFetch("/api/owner/blacklist");
      if (r.ok) setBlacklist(await r.json());
    } finally { setBlLoading(false); }
  }, []);

  const fetchDisabledCmds = useCallback(async () => {
    setDcLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/disabled-commands`);
      if (r.ok) setDisabledCmds(await r.json());
    } finally { setDcLoading(false); }
  }, [guildId]);

  const fetchTranscripts = useCallback(async () => {
    setTrLoading(true);
    try {
      const r = await apiFetch(`/api/owner/transcripts?guildId=${guildId}&limit=100`);
      if (r.ok) setTranscripts(await r.json());
    } finally { setTrLoading(false); }
  }, [guildId]);

  const fetchBotSettings = useCallback(async () => {
    setBsLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/settings`);
      if (r.ok) setBotSettings(await r.json());
    } finally { setBsLoading(false); }
  }, [guildId]);

  const fetchCaptchaLogs = useCallback(async () => {
    setClLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/captcha-logs?limit=300`);
      if (r.ok) setCaptchaLogs(await r.json());
    } finally { setClLoading(false); }
  }, [guildId]);

  const fetchTestBots = useCallback(async () => {
    if (!guildId) return;
    setTbLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/testbot`);
      if (r.ok) setTestBots(await r.json());
    } finally { setTbLoading(false); }
  }, [guildId]);

  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    Promise.all([fetchChannels(), fetchMembers(), fetchGuildMeta()]).finally(() => setLoading(false));
    fetchBlacklist();
    fetchDisabledCmds();
    fetchTranscripts();
    fetchBotSettings();
    fetchCaptchaLogs();
    fetchTestBots();
  }, [unlocked, fetchChannels, fetchMembers, fetchGuildMeta, fetchBlacklist, fetchDisabledCmds, fetchTranscripts, fetchBotSettings, fetchCaptchaLogs, fetchTestBots]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const textChannels = channels.filter((c) => [0, 5, 15].includes(c.type));
  const categories = channels.filter((c) => c.type === 4);
  const channelById = Object.fromEntries(channels.map((c) => [c.id, c]));

  // ── Actions ────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!selectedChannelId || !messageContent.trim()) return;
    setSendingMsg(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/send`, { method: "POST", body: JSON.stringify({ channelId: selectedChannelId, content: messageContent.trim() }) });
      const d = await r.json();
      if (r.ok) { toast({ title: "Message envoyé ✓", description: `ID: ${d.messageId}` }); setMessageContent(""); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setSendingMsg(false); }
  }

  async function createChannel() {
    if (!newChannelName.trim()) return;
    setCreatingChannel(true);
    try {
      const body: Record<string, string> = { name: newChannelName.trim(), type: newChannelType };
      if (newChannelParent) body["parentId"] = newChannelParent;
      if (newChannelTopic.trim()) body["topic"] = newChannelTopic.trim();
      const r = await apiFetch(`/api/owner/guilds/${guildId}/channels`, { method: "POST", body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { toast({ title: "Salon créé ✓", description: `#${d.name}` }); setNewChannelName(""); setNewChannelTopic(""); setNewChannelParent(""); await fetchChannels(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setCreatingChannel(false); }
  }

  async function deleteChannel(channelId: string, channelName: string) {
    if (!confirm(`Supprimer #${channelName} ? Cette action est irréversible.`)) return;
    const r = await apiFetch(`/api/owner/guilds/${guildId}/channels/${channelId}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) { toast({ title: "Salon supprimé ✓" }); await fetchChannels(); }
    else toast({ title: "Erreur", description: d.error, variant: "destructive" });
  }

  async function memberAction(action: "kick" | "ban", memberId: string, displayName: string) {
    if (!confirm(`${action === "kick" ? "Expulser" : "Bannir"} ${displayName} ?`)) return;
    setActionLoading(true); setActionMemberId(memberId);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/members/${memberId}/${action}`, { method: "POST", body: JSON.stringify({ reason: actionReason || undefined }) });
      const d = await r.json();
      if (r.ok) { toast({ title: `${action === "kick" ? "Expulsé" : "Banni"} ✓`, description: displayName }); setActionReason(""); await fetchMembers(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setActionLoading(false); setActionMemberId(""); }
  }

  async function saveGuildSettings() {
    setSavingSettings(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/settings`, { method: "PATCH", body: JSON.stringify({ name: guildEditName.trim() || undefined, verificationLevel: Number(guildVerifLevel), systemChannelId: guildSystemChannel || null }) });
      const d = await r.json();
      if (r.ok) { toast({ title: "Paramètres sauvegardés ✓", description: d.name }); setGuildName(d.name); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setSavingSettings(false); }
  }

  async function addToBlacklist() {
    if (!newBlUserId.trim() || !newBlUserTag.trim() || !newBlReason.trim()) return;
    setAddingBl(true);
    try {
      const r = await apiFetch("/api/owner/blacklist", { method: "POST", body: JSON.stringify({ userId: newBlUserId.trim(), userTag: newBlUserTag.trim(), reason: newBlReason.trim(), moderatorTag: user?.userTag ?? "Dashboard", moderatorId: user?.userId ?? "0" }) });
      const d = await r.json();
      if (r.ok) { toast({ title: "Blacklist mise à jour ✓", description: `${newBlUserTag} banni de tous les serveurs.` }); setNewBlUserId(""); setNewBlUserTag(""); setNewBlReason(""); await fetchBlacklist(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setAddingBl(false); }
  }

  async function removeFromBlacklist(userId: string, userTag: string) {
    if (!confirm(`Retirer ${userTag} de la blacklist globale ?`)) return;
    const r = await apiFetch(`/api/owner/blacklist/${userId}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Retiré de la blacklist ✓" }); await fetchBlacklist(); }
    else { const d = await r.json(); toast({ title: "Erreur", description: d.error, variant: "destructive" }); }
  }

  async function disableCmd() {
    if (!newCmdName) return;
    setAddingDc(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/disabled-commands`, { method: "POST", body: JSON.stringify({ commandName: newCmdName }) });
      const d = await r.json();
      if (r.ok) { toast({ title: `/${newCmdName} désactivée ✓` }); setNewCmdName(""); await fetchDisabledCmds(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setAddingDc(false); }
  }

  async function enableCmd(commandName: string) {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/disabled-commands/${commandName}`, { method: "DELETE" });
    if (r.ok) { toast({ title: `/${commandName} réactivée ✓` }); await fetchDisabledCmds(); }
    else { const d = await r.json(); toast({ title: "Erreur", description: d.error, variant: "destructive" }); }
  }

  async function enableAllCmds() {
    if (!confirm("Réactiver toutes les commandes ?")) return;
    const r = await apiFetch(`/api/owner/guilds/${guildId}/disabled-commands`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Toutes les commandes réactivées ✓" }); await fetchDisabledCmds(); }
  }

  async function openTranscript(id: number) {
    setViewLoading(true);
    try {
      const r = await apiFetch(`/api/owner/transcripts/${id}`);
      if (r.ok) setViewTranscript(await r.json());
      else toast({ title: "Erreur de chargement", variant: "destructive" });
    } finally { setViewLoading(false); }
  }

  async function deleteTranscriptFn(id: number) {
    if (!confirm("Supprimer ce transcript ?")) return;
    const r = await apiFetch(`/api/owner/transcripts/${id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Transcript supprimé ✓" }); setTranscripts((prev) => prev.filter((t) => t.id !== id)); if (viewTranscript?.id === id) setViewTranscript(null); }
  }

  async function saveBotSettings() {
    if (!botSettings) return;
    setBsSaving(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/settings`, { method: "PATCH", body: JSON.stringify(botSettings) });
      const d = await r.json();
      if (r.ok) { setBotSettings(d); toast({ title: "Réglages sauvegardés ✓" }); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setBsSaving(false); }
  }

  // ── Test Bot actions ───────────────────────────────────────────────────────
  async function createTestBot() {
    if (!tbNewName.trim() || !tbNewChannel) return;
    setTbCreating(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/testbot`, { method: "POST", body: JSON.stringify({ channelId: tbNewChannel, nom: tbNewName.trim() }) });
      const d = await r.json();
      if (r.ok) { toast({ title: `Bot de test "${tbNewName}" créé ✓` }); setTbNewName(""); setTbNewChannel(""); await fetchTestBots(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setTbCreating(false); }
  }

  async function deleteTestBot(name: string) {
    if (!confirm(`Supprimer le bot de test "${name}" ?`)) return;
    const r = await apiFetch(`/api/owner/guilds/${guildId}/testbot/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (r.ok) { toast({ title: `"${name}" supprimé ✓` }); if (tbSelected === name) setTbSelected(""); await fetchTestBots(); }
    else { const d = await r.json(); toast({ title: "Erreur", description: d.error, variant: "destructive" }); }
  }

  async function sendTestBotAction() {
    const bot = testBots.find((b) => b.name === tbSelected);
    if (!bot) return;
    setTbSending(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/testbot/send`, {
        method: "POST",
        body: JSON.stringify({ nom: bot.name, channelId: bot.channelId, action: tbAction, content: tbContent.trim() || undefined, count: tbCount }),
      });
      const d = await r.json();
      if (r.ok) toast({ title: `Action "${tbAction}" exécutée ✓` });
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setTbSending(false); }
  }

  async function runErrTest() {
    setErrTestLoading(true);
    try {
      const r = await apiFetch("/api/owner/errortest", { method: "POST" });
      if (r.ok) toast({ title: "Test alertes DM lancé ✓", description: "10 messages envoyés en DM au développeur." });
      else { const d = await r.json(); toast({ title: "Erreur", description: d.error, variant: "destructive" }); }
    } finally { setErrTestLoading(false); }
  }

  // ── Password gate render ───────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="rounded-full bg-primary/10 p-4"><Lock className="h-8 w-8 text-primary" /></div>
            </div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase font-mono">Panneau Propriétaire</h1>
            <p className="text-muted-foreground font-mono text-xs">Accès restreint — mot de passe requis.</p>
          </div>
          <Card className="border-muted bg-card">
            <CardHeader>
              <CardTitle>Vérification</CardTitle>
              <CardDescription>Entrez le mot de passe propriétaire pour continuer.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUnlock} className="space-y-4">
                {pwError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{pwError}</AlertDescription></Alert>}
                <Input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} placeholder="••••••••" disabled={pwLoading} autoFocus className="font-mono" />
                <Button type="submit" disabled={pwLoading || pwInput.length === 0} className="w-full font-mono uppercase tracking-widest">
                  {pwLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Vérification…</> : "Déverrouiller"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="text-center">
            <Link href="/guilds">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Retour au dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (user && !user.isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldOff className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>Le panneau propriétaire est réservé au propriétaire du bot.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/guilds"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Retour</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredBl = blacklist.filter((e) =>
    !blSearch || e.userTag.toLowerCase().includes(blSearch.toLowerCase()) || e.userId.includes(blSearch) || e.reason.toLowerCase().includes(blSearch.toLowerCase())
  );
  const filteredTr = transcripts.filter((t) =>
    !trSearch || t.channelName.includes(trSearch) || t.userTag.toLowerCase().includes(trSearch.toLowerCase()) || String(t.ticketNumber).includes(trSearch)
  );
  const disabledCmdNames = new Set(disabledCmds.map((d) => d.commandName));
  const availableCmds = ALL_COMMANDS.filter((c) => !disabledCmdNames.has(c));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-6">
      <header className="flex items-center gap-4 border-b border-border pb-5">
        <Link href="/guilds">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Retour</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono uppercase tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Panneau Propriétaire
          </h1>
          <p className="text-muted-foreground font-mono text-sm">{guildName || guildId}</p>
        </div>
        {user && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src={user.avatarURL} alt={user.userTag} className="h-7 w-7 rounded-full border border-border" />
            <span className="hidden md:block font-mono">{user.userTag}</span>
          </div>
        )}
      </header>

      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="messages" className="gap-1.5 text-xs"><Send className="h-3.5 w-3.5" />Messages</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5 text-xs"><Hash className="h-3.5 w-3.5" />Salons</TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5 text-xs"><UserX className="h-3.5 w-3.5" />Membres</TabsTrigger>
          <TabsTrigger value="server" className="gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" />Serveur</TabsTrigger>
          <TabsTrigger value="blacklist" className="gap-1.5 text-xs"><Ban className="h-3.5 w-3.5" />Blacklist</TabsTrigger>
          <TabsTrigger value="disabled" className="gap-1.5 text-xs"><PowerOff className="h-3.5 w-3.5" />Commandes</TabsTrigger>
          <TabsTrigger value="transcripts" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Transcripts</TabsTrigger>
          <TabsTrigger value="botsettings" className="gap-1.5 text-xs"><Sliders className="h-3.5 w-3.5" />Réglages Bot</TabsTrigger>
          <TabsTrigger value="captchalogs" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" />Logs Captcha</TabsTrigger>
          <TabsTrigger value="tests" className="gap-1.5 text-xs" onClick={fetchTestBots}><FlaskConical className="h-3.5 w-3.5" />Tests Bot</TabsTrigger>
        </TabsList>

        {/* ── Messages ──────────────────────────────────────────────────────── */}
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
                  <SelectTrigger><SelectValue placeholder="Choisir un salon..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <div key={cat.id}>
                        <div className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">{cat.name}</div>
                        {textChannels.filter((c) => c.parentId === cat.id).map((c) => (
                          <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-1.5">{CHANNEL_TYPE_ICON[c.type]} #{c.name}</span></SelectItem>
                        ))}
                      </div>
                    ))}
                    {textChannels.filter((c) => !c.parentId).map((c) => (
                      <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-1.5">{CHANNEL_TYPE_ICON[c.type]} #{c.name}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Contenu du message</label>
                <Textarea value={messageContent} onChange={(e) => setMessageContent(e.target.value)} placeholder="Votre message (supporte le markdown Discord)..." rows={4} className="font-mono text-sm resize-none" />
              </div>
              <Button onClick={sendMessage} disabled={sendingMsg || !selectedChannelId || !messageContent.trim()} className="gap-2">
                {sendingMsg ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Envoyer</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Channels ──────────────────────────────────────────────────────── */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">➕ Créer un salon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nom</label>
                  <Input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="nouveau-salon" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Type</label>
                  <Select value={newChannelType} onValueChange={setNewChannelType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texte</SelectItem>
                      <SelectItem value="voice">Vocal</SelectItem>
                      <SelectItem value="category">Catégorie</SelectItem>
                      <SelectItem value="announcement">Annonce</SelectItem>
                      <SelectItem value="forum">Forum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Catégorie parente</label>
                  <Select value={newChannelParent || "__none__"} onValueChange={(v) => setNewChannelParent(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Topic (facultatif)</label>
                  <Input value={newChannelTopic} onChange={(e) => setNewChannelTopic(e.target.value)} placeholder="Description du salon..." />
                </div>
              </div>
              <Button onClick={createChannel} disabled={creatingChannel || !newChannelName.trim()} className="gap-2">
                {creatingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">📋 Salons existants</CardTitle>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={fetchChannels} className="gap-1.5 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {channels.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group">
                    <span className="text-muted-foreground">{CHANNEL_TYPE_ICON[c.type]}</span>
                    <span className="flex-1 text-sm font-mono">{c.type === 4 ? c.name.toUpperCase() : `#${c.name}`}</span>
                    <Badge variant="outline" className="text-xs hidden group-hover:flex">{c.id}</Badge>
                    {c.type !== 4 && (
                      <Button variant="ghost" size="sm" onClick={() => deleteChannel(c.id, c.name)} className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Members ───────────────────────────────────────────────────────── */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">👥 Membres</CardTitle>
              <div className="flex gap-2 mt-2">
                <Input placeholder="Rechercher un membre..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") fetchMembers(memberSearch); }} className="max-w-xs" />
                <Button variant="outline" size="sm" onClick={() => fetchMembers(memberSearch)} className="gap-1.5"><Search className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="mt-2">
                <label className="text-sm font-medium mb-1.5 block">Raison (kick/ban)</label>
                <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Raison (facultatif)" className="max-w-xs" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {members.filter((m) => !m.bot).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                    <img src={m.avatarURL} alt={m.tag} className="h-8 w-8 rounded-full border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{m.tag}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => memberAction("kick", m.id, m.displayName)} disabled={actionLoading && actionMemberId === m.id} className="gap-1.5 text-xs">
                        <UserX className="h-3.5 w-3.5" /> Kick
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => memberAction("ban", m.id, m.displayName)} disabled={actionLoading && actionMemberId === m.id} className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
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

        {/* ── Server settings ───────────────────────────────────────────────── */}
        <TabsContent value="server" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">⚙️ Paramètres Discord</CardTitle>
              <CardDescription>Modification directe des paramètres Discord du serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nom du serveur</label>
                  <Input value={guildEditName} onChange={(e) => setGuildEditName(e.target.value)} placeholder="Laisser vide pour ne pas changer" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Niveau de vérification</label>
                  <Select value={guildVerifLevel} onValueChange={setGuildVerifLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VERIFICATION_LABELS.map((label, i) => <SelectItem key={i} value={String(i)}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Salon système</label>
                  <Select value={guildSystemChannel || "__none__"} onValueChange={(v) => setGuildSystemChannel(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={saveGuildSettings} disabled={savingSettings} className="gap-2">
                <Settings className="h-4 w-4" />{savingSettings ? "Sauvegarde..." : "Appliquer"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Blacklist globale ─────────────────────────────────────────────── */}
        <TabsContent value="blacklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">⛔ Ajouter à la Blacklist Globale</CardTitle>
              <CardDescription>L'utilisateur sera banni de tous les serveurs où le bot est présent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Discord ID</label>
                  <Input value={newBlUserId} onChange={(e) => setNewBlUserId(e.target.value)} placeholder="123456789012345678" className="font-mono" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Tag / Nom</label>
                  <Input value={newBlUserTag} onChange={(e) => setNewBlUserTag(e.target.value)} placeholder="user#1234 ou pseudo" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Raison</label>
                  <Input value={newBlReason} onChange={(e) => setNewBlReason(e.target.value)} placeholder="Raison du ban global..." />
                </div>
              </div>
              <Button onClick={addToBlacklist} disabled={addingBl || !newBlUserId.trim() || !newBlUserTag.trim() || !newBlReason.trim()} variant="destructive" className="gap-2">
                {addingBl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Blacklister
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">📋 Liste ({blacklist.length})</CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchBlacklist} disabled={blLoading} className="gap-1.5 text-xs">
                  <RefreshCw className={`h-3.5 w-3.5 ${blLoading ? "animate-spin" : ""}`} /> Actualiser
                </Button>
              </div>
              <Input placeholder="Rechercher..." value={blSearch} onChange={(e) => setBlSearch(e.target.value)} className="mt-2 max-w-xs" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredBl.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune entrée.</p>}
                {filteredBl.map((e) => (
                  <div key={e.userId} className="flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/30">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{e.userTag}</span>
                        <Badge variant="outline" className="font-mono text-xs">{e.userId}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Raison : {e.reason}</p>
                      <p className="text-xs text-muted-foreground">Par {e.moderatorTag} · {new Date(e.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFromBlacklist(e.userId, e.userTag)} className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Commandes désactivées ─────────────────────────────────────────── */}
        <TabsContent value="disabled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🔇 Désactiver une Commande</CardTitle>
              <CardDescription>Les commandes désactivées seront ignorées sur ce serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Select value={newCmdName} onValueChange={setNewCmdName}>
                  <SelectTrigger className="max-w-xs font-mono">
                    <SelectValue placeholder="Choisir une commande..." />
                  </SelectTrigger>
                  <SelectContent className="font-mono">
                    {availableCmds.map((c) => <SelectItem key={c} value={c}>/{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={disableCmd} disabled={addingDc || !newCmdName} variant="destructive" className="gap-2">
                  {addingDc ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />} Désactiver
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">⛔ Commandes désactivées ({disabledCmds.length})</CardTitle>
                {disabledCmds.length > 0 && (
                  <Button variant="outline" size="sm" onClick={enableAllCmds} className="gap-1.5 text-xs">
                    <Power className="h-3.5 w-3.5" /> Tout réactiver
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {dcLoading && <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
              {!dcLoading && disabledCmds.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune commande désactivée.</p>}
              <div className="space-y-2">
                {disabledCmds.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-md border border-destructive/30 bg-destructive/5">
                    <code className="flex-1 text-sm font-mono text-foreground">/{d.commandName}</code>
                    <span className="text-xs text-muted-foreground hidden md:block">désactivée par {d.disabledBy}</span>
                    <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString("fr-FR")}</span>
                    <Button variant="ghost" size="sm" onClick={() => enableCmd(d.commandName)} className="h-7 gap-1.5 text-xs text-green-500 hover:bg-green-500/10 hover:text-green-500">
                      <Power className="h-3.5 w-3.5" /> Réactiver
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Transcripts ───────────────────────────────────────────────────── */}
        <TabsContent value="transcripts" className="space-y-4">
          {viewTranscript ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-mono uppercase">📄 Ticket #{viewTranscript.ticketNumber} — #{viewTranscript.channelName}</CardTitle>
                    <CardDescription>
                      Créé par {viewTranscript.userTag} · Fermé par {viewTranscript.closedBy} · {viewTranscript.messageCount} messages
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { const blob = new Blob([viewTranscript.content], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `transcript-${viewTranscript.ticketNumber}.txt`; a.click(); }} className="gap-1.5 text-xs">
                      ⬇ Télécharger
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setViewTranscript(null)} className="gap-1.5">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted rounded-md p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap leading-relaxed">{viewTranscript.content}</pre>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono uppercase">📄 Transcripts de tickets ({transcripts.length})</CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchTranscripts} disabled={trLoading} className="gap-1.5 text-xs">
                    <RefreshCw className={`h-3.5 w-3.5 ${trLoading ? "animate-spin" : ""}`} /> Actualiser
                  </Button>
                </div>
                <Input placeholder="Rechercher par salon, utilisateur, numéro..." value={trSearch} onChange={(e) => setTrSearch(e.target.value)} className="mt-2 max-w-xs" />
              </CardHeader>
              <CardContent>
                {trLoading && <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
                {!trLoading && filteredTr.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">Aucun transcript. Les transcripts sont générés automatiquement à la fermeture d'un ticket.</p>
                )}
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredTr.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/30 group">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Ticket #{t.ticketNumber}</span>
                          <Badge variant="secondary" className="text-xs font-mono">#{t.channelName}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t.userTag} · Fermé par {t.closedBy} · {t.messageCount} msgs · {new Date(t.closedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {t.reason && t.reason !== "Aucune raison" && <p className="text-xs text-muted-foreground italic">Raison : {t.reason}</p>}
                      </div>
                      <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="outline" size="sm" onClick={() => openTranscript(t.id)} disabled={viewLoading} className="h-7 gap-1.5 text-xs">
                          <Eye className="h-3.5 w-3.5" /> Voir
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteTranscriptFn(t.id)} className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Réglages Bot ──────────────────────────────────────────────────── */}
        <TabsContent value="botsettings" className="space-y-4">
          {bsLoading || !botSettings ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-mono uppercase">🤖 Configuration Captcha</CardTitle>
                  <CardDescription>Vérifie les nouveaux membres via un code captcha.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40">
                    <label className="text-sm font-medium flex-1">Captcha activé</label>
                    <Button
                      size="sm" variant={botSettings.captchaEnabled ? "default" : "outline"}
                      onClick={() => setBotSettings({ ...botSettings, captchaEnabled: !botSettings.captchaEnabled })}
                      className="gap-1.5 w-28"
                    >
                      {botSettings.captchaEnabled ? <><Power className="h-3.5 w-3.5" />Activé</> : <><PowerOff className="h-3.5 w-3.5" />Désactivé</>}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Salon de vérification</label>
                      <Select value={botSettings.captchaChannelId ?? "__none__"} onValueChange={(v) => setBotSettings({ ...botSettings, captchaChannelId: v === "__none__" ? null : v })}>
                        <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Aucun</SelectItem>
                          {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Rôle vérifié (à attribuer)</label>
                      <Input value={botSettings.captchaVerifiedRoleId ?? ""} onChange={(e) => setBotSettings({ ...botSettings, captchaVerifiedRoleId: e.target.value || null })} placeholder="ID du rôle" className="font-mono" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Mode</label>
                      <Select value={botSettings.captchaMode} onValueChange={(v) => setBotSettings({ ...botSettings, captchaMode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="channel">Salon (visible)</SelectItem>
                          <SelectItem value="dm">DM (privé)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Tentatives max ({botSettings.captchaMaxAttempts})</label>
                      <Input type="number" min={1} max={10} value={botSettings.captchaMaxAttempts} onChange={(e) => setBotSettings({ ...botSettings, captchaMaxAttempts: Number(e.target.value) })} className="font-mono" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Timeout (minutes · {botSettings.captchaTimeoutMins})</label>
                      <Input type="number" min={1} max={60} value={botSettings.captchaTimeoutMins} onChange={(e) => setBotSettings({ ...botSettings, captchaTimeoutMins: Number(e.target.value) })} className="font-mono" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-mono uppercase">👋 Message de Bienvenue</CardTitle>
                  <CardDescription>Envoie un message quand un nouveau membre rejoint.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40">
                    <label className="text-sm font-medium flex-1">Bienvenue activé</label>
                    <Button size="sm" variant={botSettings.welcomeEnabled ? "default" : "outline"} onClick={() => setBotSettings({ ...botSettings, welcomeEnabled: !botSettings.welcomeEnabled })} className="gap-1.5 w-28">
                      {botSettings.welcomeEnabled ? <><Power className="h-3.5 w-3.5" />Activé</> : <><PowerOff className="h-3.5 w-3.5" />Désactivé</>}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Salon</label>
                      <Select value={botSettings.welcomeChannelId ?? "__none__"} onValueChange={(v) => setBotSettings({ ...botSettings, welcomeChannelId: v === "__none__" ? null : v })}>
                        <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Aucun</SelectItem>
                          {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">Message <span className="text-muted-foreground text-xs">(variables : {"{user}"}, {"{server}"}, {"{memberCount}"})</span></label>
                      <Textarea value={botSettings.welcomeMessage ?? ""} onChange={(e) => setBotSettings({ ...botSettings, welcomeMessage: e.target.value || null })} placeholder="Bienvenue {user} sur {server} ! Tu es le {memberCount}ème membre." rows={3} className="font-mono text-sm resize-none" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={saveBotSettings} disabled={bsSaving} className="gap-2 font-mono uppercase tracking-widest">
                  {bsSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Sauvegarde…</> : <><Sliders className="h-4 w-4" />Sauvegarder les réglages</>}
                </Button>
              </div>
            </>
          )}
        </TabsContent>
        {/* ── Captcha Logs ──────────────────────────────────────────────────── */}
        <TabsContent value="captchalogs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-mono uppercase">🛡️ Logs Captcha ({captchaLogs.length})</CardTitle>
                  <CardDescription>Historique des événements captcha — déclenchements, succès, échecs, expulsions.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={fetchCaptchaLogs} disabled={clLoading} className="gap-1.5 text-xs">
                    <RefreshCw className={`h-3.5 w-3.5 ${clLoading ? "animate-spin" : ""}`} /> Actualiser
                  </Button>
                  <Button variant="outline" size="sm" onClick={async () => {
                    if (!confirm("Effacer tous les logs captcha de ce serveur ?")) return;
                    const r = await apiFetch(`/api/owner/guilds/${guildId}/captcha-logs`, { method: "DELETE" });
                    if (r.ok) { setCaptchaLogs([]); toast({ title: "Logs effacés ✓" }); }
                  }} className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Effacer
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Input placeholder="Rechercher utilisateur, ID…" value={clFilter} onChange={(e) => setClFilter(e.target.value)} className="max-w-xs text-sm" />
                <Select value={clFilter.startsWith("event:") ? clFilter.slice(6) : "all"} onValueChange={(v) => setClFilter(v === "all" ? "" : `event:${v}`)}>
                  <SelectTrigger className="w-44 text-xs"><SelectValue placeholder="Filtrer par événement" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les événements</SelectItem>
                    <SelectItem value="triggered_channel">Déclenché (salon)</SelectItem>
                    <SelectItem value="triggered_dm">Déclenché (DM)</SelectItem>
                    <SelectItem value="success">Réussi ✅</SelectItem>
                    <SelectItem value="fail_attempt">Mauvaise réponse ❌</SelectItem>
                    <SelectItem value="fail_kick">Expulsé (trop de mauvaises)</SelectItem>
                    <SelectItem value="timeout_kick">Expulsé (timeout)</SelectItem>
                    <SelectItem value="dm_closed">DMs fermés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {clLoading && <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
              {!clLoading && captchaLogs.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">Aucun log captcha. Ils apparaîtront automatiquement dès qu'un membre déclenche le captcha.</p>
              )}
              {!clLoading && captchaLogs.length > 0 && (() => {
                const filtered = captchaLogs.filter((e) => {
                  if (!clFilter) return true;
                  if (clFilter.startsWith("event:")) return e.event === clFilter.slice(6);
                  const q = clFilter.toLowerCase();
                  return e.userTag.toLowerCase().includes(q) || e.userId.includes(q) || e.details.toLowerCase().includes(q);
                });
                const EVENT_META: Record<string, { label: string; color: string; icon: string }> = {
                  triggered_channel: { label: "Déclenché (salon)", color: "text-blue-400", icon: "🤖" },
                  triggered_dm:      { label: "Déclenché (DM)",    color: "text-blue-400", icon: "📨" },
                  success:           { label: "Réussi",            color: "text-green-400", icon: "✅" },
                  fail_attempt:      { label: "Mauvaise réponse",  color: "text-yellow-400", icon: "⚠️" },
                  fail_kick:         { label: "Expulsé (échecs)",  color: "text-red-400", icon: "❌" },
                  timeout_kick:      { label: "Expulsé (timeout)", color: "text-red-400", icon: "⏰" },
                  dm_closed:         { label: "DMs fermés",        color: "text-orange-400", icon: "🔒" },
                };
                return (
                  <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                    {filtered.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Aucun résultat.</p>}
                    {filtered.map((e) => {
                      const meta = EVENT_META[e.event] ?? { label: e.event, color: "text-muted-foreground", icon: "❓" };
                      return (
                        <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/30 border border-transparent hover:border-border transition-colors">
                          <span className="text-base shrink-0 mt-0.5">{meta.icon}</span>
                          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-x-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold font-mono ${meta.color}`}>{meta.label}</span>
                                <span className="text-sm font-medium truncate">{e.userTag}</span>
                                <Badge variant="outline" className="font-mono text-xs hidden md:flex">{e.userId}</Badge>
                              </div>
                              {e.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.details}</p>}
                            </div>
                            <time className="text-xs text-muted-foreground shrink-0 mt-0.5 whitespace-nowrap">
                              {new Date(e.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </time>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tests Bot ────────────────────────────────────────────────────── */}
        <TabsContent value="tests" className="space-y-4">
          {/* Bots de test (webhooks) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🤖 Bots de test (Webhooks)</CardTitle>
              <CardDescription>
                Crée des pseudos-bots via webhooks Discord pour simuler du spam, des insultes ou des liens non autorisés et tester visuellement les logs d'automod.
                <span className="block mt-1 text-xs text-amber-500/80">⚠️ Les webhooks ne sont pas sanctionnés par l'automod (pas de GuildMember). Ils servent uniquement à vérifier l'apparence des logs.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Créer un bot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-4 border-b border-border">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nom du bot de test</label>
                  <Input value={tbNewName} onChange={(e) => setTbNewName(e.target.value)} placeholder="MonBotTest" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Salon</label>
                  <Select value={tbNewChannel || "__none__"} onValueChange={(v) => setTbNewChannel(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Choisir un salon…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Choisir un salon</SelectItem>
                      {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={createTestBot} disabled={tbCreating || !tbNewName.trim() || !tbNewChannel} className="gap-2 w-full">
                    {tbCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
                  </Button>
                </div>
              </div>

              {/* Sélection + action */}
              {testBots.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Bot sélectionné</label>
                      <Select value={tbSelected || "__none__"} onValueChange={(v) => setTbSelected(v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner un bot…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sélectionner…</SelectItem>
                          {testBots.map((b) => (
                            <SelectItem key={b.id} value={b.name}>
                              {b.name} — #{channels.find((c) => c.id === b.channelId)?.name ?? b.channelId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Action</label>
                      <Select value={tbAction} onValueChange={setTbAction}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="message">📝 Message personnalisé</SelectItem>
                          <SelectItem value="spam">💬 Spam (rafale de messages)</SelectItem>
                          <SelectItem value="insulte">🤬 Insulte (test détection)</SelectItem>
                          <SelectItem value="lien">🔗 Lien non autorisé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {tbAction === "message" && (
                    <Input value={tbContent} onChange={(e) => setTbContent(e.target.value)} placeholder="Contenu du message à envoyer…" />
                  )}
                  {tbAction === "spam" && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium">Nombre de messages :</label>
                      <Input type="number" min={2} max={10} value={tbCount} onChange={(e) => setTbCount(Math.min(10, Math.max(2, Number(e.target.value))))} className="w-20 font-mono text-center" />
                      <span className="text-xs text-muted-foreground">(max 10, délai 200 ms entre chaque)</span>
                    </div>
                  )}
                  <Button onClick={sendTestBotAction} disabled={tbSending || !tbSelected} className="gap-2">
                    {tbSending ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Exécuter</>}
                  </Button>
                </div>
              ) : null}

              {/* Liste des bots existants */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">
                    Bots créés {testBots.length > 0 ? `(${testBots.length})` : ""}
                  </p>
                  <Button variant="ghost" size="sm" onClick={fetchTestBots} disabled={tbLoading} className="gap-1.5 text-xs">
                    <RefreshCw className={`h-3.5 w-3.5 ${tbLoading ? "animate-spin" : ""}`} /> Actualiser
                  </Button>
                </div>
                {testBots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                    Aucun bot de test créé sur ce serveur.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {testBots.map((b) => (
                      <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-muted/30">
                        <FlaskConical className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 text-sm font-mono font-medium">{b.name}</span>
                        <span className="text-xs text-muted-foreground">#{channels.find((c) => c.id === b.channelId)?.name ?? b.channelId}</span>
                        <Badge variant="outline" className="font-mono text-xs hidden md:inline-flex">{b.id}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => deleteTestBot(b.name)} className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Idées de commandes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">💡 Idées de commandes à ajouter</CardTitle>
              <CardDescription>Suggestions de nouvelles commandes pour enrichir le bot.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  { icon: "🧹", cmd: "/purge", desc: "Supprimer X messages d'un salon ou d'un utilisateur en masse", tag: "Modération" },
                  { icon: "🔒", cmd: "/lock / /unlock", desc: "Verrouiller ou déverrouiller un salon en urgence (lecture seule)", tag: "Modération" },
                  { icon: "📢", cmd: "/announce", desc: "Envoyer une annonce embed formatée dans un salon cible", tag: "Utilitaire" },
                  { icon: "📊", cmd: "/poll", desc: "Créer un sondage avec plusieurs choix et réactions", tag: "Utilitaire" },
                  { icon: "⏰", cmd: "/rappel", desc: "Planifier un rappel dans un salon ou en DM après X minutes/heures", tag: "Utilitaire" },
                  { icon: "🏷️", cmd: "/role", desc: "Ajouter ou retirer un rôle à un membre directement", tag: "Modération" },
                  { icon: "✏️", cmd: "/nickname", desc: "Changer le pseudo d'un membre sur le serveur", tag: "Modération" },
                  { icon: "🔤", cmd: "/antinick", desc: "Détecter et réinitialiser les pseudos contenant des mots interdits", tag: "Auto-mod" },
                  { icon: "🌐", cmd: "/translate", desc: "Traduire un message dans la langue cible via API", tag: "Utilitaire" },
                  { icon: "📁", cmd: "/archive", desc: "Passer un salon en lecture seule (archivage)", tag: "Modération" },
                  { icon: "📈", cmd: "/stats-serveur", desc: "Afficher les statistiques du serveur (messages, membres actifs, nouveaux)", tag: "Info" },
                  { icon: "🔍", cmd: "/userinfo++", desc: "Infos étendues sur un membre : avertissements, temps passé, rôles", tag: "Info" },
                  { icon: "🤖", cmd: "/automod-log", desc: "Voir un résumé des 20 dernières actions de l'automod sur le serveur", tag: "Auto-mod" },
                  { icon: "🎭", cmd: "/roleplay", desc: "Envoyer un message en tant qu'un rôle/personnage (webhook déguisé)", tag: "Fun" },
                ] as const).map((item) => (
                  <div key={item.cmd} className="flex gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono font-bold text-primary">{item.cmd}</code>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">{item.tag}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Test alertes DM */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🔔 Test Alertes DM</CardTitle>
              <CardDescription>
                Envoie 10 messages d'alerte simulés en DM au développeur du bot pour vérifier que toutes les notifications fonctionnent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={runErrTest} disabled={errTestLoading} variant="outline" className="gap-2">
                {errTestLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi en cours…</>
                  : <><Send className="h-4 w-4" />Lancer les 10 tests d'alertes</>}
              </Button>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">Messages simulés :</p>
                <p>1. 🟢 Démarrage complet · 2. ❌ Erreur de commande · 3. ⚠️ Ping élevé · 4. 💥 Promesse rejetée</p>
                <p>5. 🔴 Arrêt · 6-9. 🔑 Captcha admin (déclenché / réussi / échoué / expiré) · 10. 📨 DM sécurité groupé</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
