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
  Clock, Pencil, Unlock, Zap, Ticket, Users, Tag,
  Wifi, WifiOff, Radio, Activity, Server,
  BookOpen, Download, Copy, ScrollText, Link2Off,
  Wrench, Globe, SearchCode, Upload, Command, Pause, MailX, Gavel, ListFilter,
  UserCheck, ChevronRight, ExternalLink, Unlink, MessageSquareWarning, ShieldAlert,
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

type Role = { id: string; name: string; color: string; position: number };
type AutomodCfg = {
  antiInsultEnabled: boolean; antiInsultWords: string[]; antiWebhookEnabled: boolean;
  securityLevel: 1 | 2 | 3; antilinkEnabled: boolean;
  antilinkAction: "delete" | "warn" | "timeout"; antilinkTimeoutMinutes: number;
  antilinkAllowedDomains: string[];
};
type ActiveTicket = {
  channelId: string; ticketNumber: number; userId: string; username: string;
  claimedBy: string | null; createdAt: string;
};
type BotStatusInfo = {
  online: boolean; wsStatus: number; ping: number; uptime: number | null;
  guildCount: number; userCount: number; memory: number;
  username: string | null; tag: string | null; avatarURL: string | null;
  presence: { status: string; activities: { name: string; type: number }[] } | null;
};

type BotSettings = {
  guildId: string; captchaEnabled: boolean; captchaChannelId: string | null;
  captchaRoleId: string | null; captchaVerifiedRoleId: string | null;
  captchaTimeoutMins: number; captchaMaxAttempts: number; captchaMode: string;
  welcomeEnabled: boolean; welcomeChannelId: string | null; welcomeMessage: string | null;
};
type AntiProtection = {
  antiRaiderEnabled: boolean; antiRaiderThreshold: number; antiRaiderWindow: number; antiRaiderAction: string;
  antiMoveEnabled: boolean; antiMuteEnabled: boolean; antiDisconnectEnabled: boolean; antiBotEnabled: boolean;
};
type NoteEntry = { id: number; content: string; moderator: string; moderatorId: string; timestamp: string };
type NotesByUser = { userId: string; notes: NoteEntry[] };
type InviteBlEntry = { userId: string; userTag: string; reason: string; moderatorTag: string; moderatorId: string; timestamp: string };
type ActionLogEntry = { timestamp: string; method: string; path: string; body: Record<string, unknown> };
type GuildInfo = { id: string; name: string; memberCount: number; iconURL: string | null };
type QuarantineEntry = { userId: string; userTag: string; guildId: string; reason: string; triggerCount: number; windowSeconds: number; timestamp: string };
type VoiceEvent = { timestamp: string; guildId: string; userId: string; userTag: string; type: string; channelId: string | null; channelName: string | null; fromChannelId?: string | null; fromChannelName?: string | null };

type Warning = { caseId: number; reason: string; moderatorTag: string; timestamp: string };
type TempBanEntry = { guildId: string; userId: string; userTag: string; moderatorTag: string; reason: string; expiresAt: number };
type TimeoutEntry = { userId: string; userTag: string; displayName: string; avatarURL: string; until: string | null };
type Invite = { code: string; url: string; uses: number | null; maxUses: number | null; creatorTag: string | null; channelName: string | null; temporary: boolean; expiresAt: string | null; createdAt: string | null };
type AuditEntry = { id: string; action: number; actionType: string; executorTag: string | null; executorId: string | null; targetId: string | null; reason: string | null; createdAt: string };
type LogChannels = { logChannelId: string | null; banLogChannelId: string | null; generalLogChannelId: string | null; inviteLogChannelId: string | null; messageLogChannelId: string | null };
type CustomCmd = { name: string; response: string; createdBy: string; createdAt: string };
type GlobalMemberResult = { guildId: string; guildName: string; userTag: string; displayName: string; avatarURL: string; joinedAt: string | null; roles: { id: string; name: string }[]; timedOut: boolean; warnCount: number };
type BotReplyLog = { id: string; type: string; guildId: string | null; timestamp: number; command?: string; userId?: string; userTag?: string; level?: "error" | "warn" | "info"; replyText?: string; errCode?: string; errMessage?: string };
type BotStatusEvent = { id: string; type: string; timestamp: number; detail: string; ping?: number; errCode?: string };
type UserCmd = { id: number; type: string; guildId: string | null; guildName: string | null; userId: string; userTag: string; data: Record<string, unknown>; createdAt: string };
type SuspectAcc = { id: number; guildId: string; guildName: string; userId: string; userTag: string; accountAgeDays: number; hasNoAvatar: boolean; reasons: string[]; actionTaken: string; securityLevel: number; detectedAt: string };
type MemberProfile = {
  userId: string; userTag: string | null; displayName: string | null; avatarURL: string | null;
  joinedAt: string | null; roles: { id: string; name: string; color: string }[];
  timed_out_until: string | null; warns: Warning[]; notes: NoteEntry[];
  tempban: TempBanEntry | null; quarantine: QuarantineEntry | null; voiceEvents: VoiceEvent[];
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

  // ── Embed builder state ────────────────────────────────────────────────────
  const [embedChannelId, setEmbedChannelId] = useState("");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDesc, setEmbedDesc] = useState("");
  const [embedColor, setEmbedColor] = useState("#5865f2");
  const [embedImage, setEmbedImage] = useState("");
  const [embedFooter, setEmbedFooter] = useState("");
  const [sendingEmbed, setSendingEmbed] = useState(false);

  // ── Schedule message state ─────────────────────────────────────────────────
  const [schedChannelId, setSchedChannelId] = useState("");
  const [schedContent, setSchedContent] = useState("");
  const [schedDelay, setSchedDelay] = useState("10");
  const [scheduling, setScheduling] = useState(false);

  // ── Edit message state ─────────────────────────────────────────────────────
  const [editChannelId, setEditChannelId] = useState("");
  const [editMsgId, setEditMsgId] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);

  // ── Unban state ────────────────────────────────────────────────────────────
  const [unbanId, setUnbanId] = useState("");
  const [unbanReason, setUnbanReason] = useState("");
  const [unbanning, setUnbanning] = useState(false);

  // ── Role management state ──────────────────────────────────────────────────
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleMemberId, setRoleMemberId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleAction, setRoleAction] = useState<"add" | "remove">("add");
  const [roleAssignLoading, setRoleAssignLoading] = useState(false);
  const [roleFilterId, setRoleFilterId] = useState("");

  // ── Channel moderation state ───────────────────────────────────────────────
  const [lockChannelId, setLockChannelId] = useState("");
  const [locking, setLocking] = useState(false);
  const [purgeChannelId, setPurgeChannelId] = useState("");
  const [purgeLimit, setPurgeLimit] = useState("50");
  const [purgeUserId, setPurgeUserId] = useState("");
  const [purging, setPurging] = useState(false);
  const [slowChannelId, setSlowChannelId] = useState("");
  const [slowSeconds, setSlowSeconds] = useState("5");
  const [slowing, setSlowing] = useState(false);

  // ── Automod state ──────────────────────────────────────────────────────────
  const [automodCfg, setAutomodCfg] = useState<AutomodCfg | null>(null);
  const [amLoading, setAmLoading] = useState(false);
  const [amSaving, setAmSaving] = useState(false);
  const [amNewWord, setAmNewWord] = useState("");
  const [amNewDomain, setAmNewDomain] = useState("");

  // ── Anti-protection state ────────────────────────────────────────────────────
  const [antiProtection, setAntiProtection] = useState<AntiProtection | null>(null);
  const [apLoading, setApLoading] = useState(false);
  const [apSaving, setApSaving] = useState(false);
  const [stripRoleId, setStripRoleId] = useState("");
  const [strippingPerms, setStrippingPerms] = useState(false);

  // ── Bot status state ────────────────────────────────────────────────────────
  const [botStatus, setBotStatus] = useState<BotStatusInfo | null>(null);
  const [botStatusLoading, setBotStatusLoading] = useState(false);
  const [botStatusEvents, setBotStatusEvents] = useState<BotStatusEvent[]>([]);
  const [bseLoading, setBseLoading] = useState(false);
  const [botActionLoading, setBotActionLoading] = useState<string>("");
  const [presenceStatus, setPresenceStatus] = useState<"online" | "idle" | "dnd" | "invisible">("online");
  const [presenceActivityType, setPresenceActivityType] = useState("0");
  const [presenceActivityText, setPresenceActivityText] = useState("");
  const [presenceSaving, setPresenceSaving] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResults, setBroadcastResults] = useState<{ guildName: string; ok: boolean; error?: string }[]>([]);

  // ── Tickets state ──────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<ActiveTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [closingTicket, setClosingTicket] = useState("");
  const [closeTicketReason, setCloseTicketReason] = useState("");

  // ── Notes state ────────────────────────────────────────────────────────────
  const [notesByUser, setNotesByUser] = useState<NotesByUser[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");

  // ── Clone config state ─────────────────────────────────────────────────────
  const [allGuilds, setAllGuilds] = useState<GuildInfo[]>([]);
  const [cloneTarget, setCloneTarget] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Invite blacklist state ─────────────────────────────────────────────────
  const [inviteBl, setInviteBl] = useState<InviteBlEntry[]>([]);
  const [inviteBlLoading, setInviteBlLoading] = useState(false);
  const [iblSearch, setIblSearch] = useState("");

  // ── Action log state ───────────────────────────────────────────────────────
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [actionLogLoading, setActionLogLoading] = useState(false);

  // ── Quarantaine state ──────────────────────────────────────────────────────
  const [quarantineList, setQuarantineList] = useState<QuarantineEntry[]>([]);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [liftingQ, setLiftingQ] = useState("");

  // ── Voice log state ────────────────────────────────────────────────────────
  const [voiceLog, setVoiceLog] = useState<VoiceEvent[]>([]);
  const [voiceLogLoading, setVoiceLogLoading] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");

  // ── Fiche membre ───────────────────────────────────────────────────────────
  const [profileId, setProfileId] = useState("");
  const [profileData, setProfileData] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Warns ─────────────────────────────────────────────────────────────────
  const [warnsUserId, setWarnsUserId] = useState("");
  const [warnsData, setWarnsData] = useState<Warning[] | null>(null);
  const [warnsLoading, setWarnsLoading] = useState(false);

  // ── Tempbans ──────────────────────────────────────────────────────────────
  const [tempbans, setTempbans] = useState<TempBanEntry[]>([]);
  const [tempbansLoading, setTempbansLoading] = useState(false);

  // ── Timeouts ──────────────────────────────────────────────────────────────
  const [timeouts, setTimeouts] = useState<TimeoutEntry[]>([]);
  const [timeoutsLoading, setTimeoutsLoading] = useState(false);

  // ── Maintenance ───────────────────────────────────────────────────────────
  const [maintenanceState, setMaintenanceState] = useState<{ active: boolean; message: string } | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMsgDraft, setMaintenanceMsgDraft] = useState("");

  // ── User Commands state ────────────────────────────────────────────────────
  const [userCmds, setUserCmds] = useState<UserCmd[]>([]);
  const [ucLoading, setUcLoading] = useState(false);
  const [ucTypeFilter, setUcTypeFilter] = useState<"all" | "rolerequest" | "suggestion">("all");
  const [ucSearch, setUcSearch] = useState("");

  // ── Suspect Accounts state ─────────────────────────────────────────────────
  const [suspectAccounts, setSuspectAccounts] = useState<SuspectAcc[]>([]);
  const [saLoading, setSaLoading] = useState(false);
  const [saActionLoading, setSaActionLoading] = useState<number | null>(null);

  // ── Masse-action ──────────────────────────────────────────────────────────
  const [massRoleId, setMassRoleId] = useState("");
  const [massAction, setMassAction] = useState<"kick" | "ban" | "timeout">("kick");
  const [massReason, setMassReason] = useState("");
  const [massTimeoutMins, setMassTimeoutMins] = useState(60);
  const [massLoading, setMassLoading] = useState(false);

  // ── Invitations ───────────────────────────────────────────────────────────
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [newInviteChannelId, setNewInviteChannelId] = useState("");
  const [newInviteMaxAge, setNewInviteMaxAge] = useState(0);
  const [newInviteMaxUses, setNewInviteMaxUses] = useState(0);
  const [newInviteTemporary, setNewInviteTemporary] = useState(false);

  // ── Audit Log ─────────────────────────────────────────────────────────────
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Log Channels ──────────────────────────────────────────────────────────
  const [logChannels, setLogChannels] = useState<LogChannels | null>(null);
  const [logChannelsDraft, setLogChannelsDraft] = useState<LogChannels>({ logChannelId: null, banLogChannelId: null, generalLogChannelId: null, inviteLogChannelId: null, messageLogChannelId: null });
  const [logChannelsLoading, setLogChannelsLoading] = useState(false);
  const [logChannelsSaving, setLogChannelsSaving] = useState(false);

  // ── Config JSON ───────────────────────────────────────────────────────────
  const [configImportJson, setConfigImportJson] = useState("");
  const [configImportLoading, setConfigImportLoading] = useState(false);
  const [configExportLoading, setConfigExportLoading] = useState(false);

  // ── Commandes custom ──────────────────────────────────────────────────────
  const [customCmds, setCustomCmds] = useState<CustomCmd[]>([]);
  const [customCmdsLoading, setCustomCmdsLoading] = useState(false);
  const [ccNewName, setCcNewName] = useState("");
  const [ccNewResponse, setCcNewResponse] = useState("");
  const [customCmdSaving, setCustomCmdSaving] = useState(false);

  // ── Mots globaux ──────────────────────────────────────────────────────────
  const [wordBl, setWordBl] = useState<string[]>([]);
  const [wordBlLoading, setWordBlLoading] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [wordBlSaving, setWordBlSaving] = useState(false);

  // ── Recherche globale ─────────────────────────────────────────────────────
  const [searchId, setSearchId] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalMemberResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Logs Bot (bot_reply) ───────────────────────────────────────────────────
  const [botReplyLogs, setBotReplyLogs] = useState<BotReplyLog[]>([]);
  const [botReplyLoading, setBotReplyLoading] = useState(false);
  const [botReplyFilter, setBotReplyFilter] = useState<"all" | "error" | "warn" | "info">("all");

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

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/roles`);
      if (r.ok) setRoles(await r.json());
    } finally { setRolesLoading(false); }
  }, [guildId]);

  const fetchAutomod = useCallback(async () => {
    setAmLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/automod`);
      if (r.ok) setAutomodCfg(await r.json());
    } finally { setAmLoading(false); }
  }, [guildId]);

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/tickets`);
      if (r.ok) setTickets(await r.json());
    } finally { setTicketsLoading(false); }
  }, [guildId]);

  const fetchAntiProtectionCb = useCallback(async () => {
    setApLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/anti-protection`);
      if (r.ok) setAntiProtection(await r.json() as AntiProtection);
    } finally { setApLoading(false); }
  }, [guildId]);

  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    Promise.all([fetchChannels(), fetchMembers(), fetchGuildMeta()]).finally(() => setLoading(false));
    fetchBlacklist();
    fetchDisabledCmds();
    fetchTranscripts();
    fetchBotSettings();
    fetchAntiProtectionCb();
    fetchCaptchaLogs();
    fetchTestBots();
    fetchRoles();
    fetchAutomod();
    fetchTickets();
  }, [unlocked, fetchChannels, fetchMembers, fetchGuildMeta, fetchBlacklist, fetchDisabledCmds, fetchTranscripts, fetchBotSettings, fetchAntiProtectionCb, fetchCaptchaLogs, fetchTestBots, fetchRoles, fetchAutomod, fetchTickets]);

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

  // ── Messages advanced actions ──────────────────────────────────────────────
  async function sendEmbed() {
    if (!embedChannelId || (!embedTitle.trim() && !embedDesc.trim())) return;
    setSendingEmbed(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/send-embed`, {
        method: "POST",
        body: JSON.stringify({ channelId: embedChannelId, title: embedTitle.trim() || undefined, description: embedDesc.trim() || undefined, color: embedColor, imageURL: embedImage.trim() || undefined, footer: embedFooter.trim() || undefined }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Embed envoyé ✓", description: `ID: ${d.messageId}` }); setEmbedTitle(""); setEmbedDesc(""); setEmbedImage(""); setEmbedFooter(""); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setSendingEmbed(false); }
  }

  async function scheduleMessage() {
    if (!schedChannelId || !schedContent.trim() || Number(schedDelay) < 1) return;
    setScheduling(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/schedule-message`, {
        method: "POST",
        body: JSON.stringify({ channelId: schedChannelId, content: schedContent.trim(), delayMinutes: Number(schedDelay) }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Message planifié ✓", description: `Envoi prévu à ${d.scheduledAt}` }); setSchedContent(""); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setScheduling(false); }
  }

  async function editMessage() {
    if (!editChannelId || !editMsgId.trim() || !editContent.trim()) return;
    setEditing(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/channels/${editChannelId}/messages/${editMsgId.trim()}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editContent.trim() }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Message modifié ✓" }); setEditMsgId(""); setEditContent(""); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setEditing(false); }
  }

  // ── Member actions ─────────────────────────────────────────────────────────
  async function unbanUser() {
    if (!unbanId.trim()) return;
    setUnbanning(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/members/unban`, {
        method: "POST",
        body: JSON.stringify({ userId: unbanId.trim(), reason: unbanReason.trim() || undefined }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Utilisateur débanni ✓" }); setUnbanId(""); setUnbanReason(""); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setUnbanning(false); }
  }

  async function assignRole() {
    if (!roleMemberId.trim() || !roleId) return;
    setRoleAssignLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/members/${roleMemberId.trim()}/role`, {
        method: "POST",
        body: JSON.stringify({ roleId, action: roleAction }),
      });
      const d = await r.json();
      if (r.ok) toast({ title: roleAction === "add" ? "Rôle ajouté ✓" : "Rôle retiré ✓" });
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setRoleAssignLoading(false); }
  }

  // ── Channel actions ────────────────────────────────────────────────────────
  async function lockUnlockChannel(action: "lock" | "unlock") {
    if (!lockChannelId) return;
    setLocking(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/channels/${lockChannelId}/${action}`, { method: "POST" });
      const d = await r.json();
      if (r.ok) { toast({ title: action === "lock" ? "Salon verrouillé 🔒" : "Salon déverrouillé 🔓" }); await fetchChannels(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setLocking(false); }
  }

  async function purgeChannel() {
    if (!purgeChannelId) return;
    const limit = Math.max(1, Math.min(100, Number(purgeLimit) || 50));
    if (!confirm(`Supprimer jusqu'à ${limit} messages${purgeUserId.trim() ? " de cet utilisateur" : ""} ?`)) return;
    setPurging(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/channels/${purgeChannelId}/purge`, {
        method: "POST",
        body: JSON.stringify({ limit, userId: purgeUserId.trim() || undefined }),
      });
      const d = await r.json();
      if (r.ok) toast({ title: "Purge effectuée ✓", description: `${d.deleted} message(s) supprimé(s)` });
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setPurging(false); }
  }

  async function setSlowmode() {
    if (!slowChannelId) return;
    const s = Math.max(0, Math.min(21600, Number(slowSeconds) || 0));
    setSlowing(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/channels/${slowChannelId}/slowmode`, {
        method: "PATCH",
        body: JSON.stringify({ seconds: s }),
      });
      const d = await r.json();
      if (r.ok) toast({ title: s === 0 ? "Slowmode désactivé ✓" : `Slowmode ${s}s appliqué ✓` });
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setSlowing(false); }
  }

  // ── Automod actions ────────────────────────────────────────────────────────
  async function patchAutomod(patch: Partial<AutomodCfg>) {
    if (!automodCfg) return;
    setAmSaving(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/automod`, { method: "PATCH", body: JSON.stringify(patch) });
      const d = await r.json();
      if (r.ok) { setAutomodCfg(d); toast({ title: "Automod mis à jour ✓" }); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setAmSaving(false); }
  }

  async function addAmWord() {
    if (!amNewWord.trim() || !automodCfg) return;
    const w = amNewWord.trim().toLowerCase();
    if (automodCfg.antiInsultWords.includes(w)) { toast({ title: "Mot déjà présent", variant: "destructive" }); return; }
    await patchAutomod({ antiInsultWords: [...automodCfg.antiInsultWords, w] });
    setAmNewWord("");
  }

  async function removeAmWord(word: string) {
    if (!automodCfg) return;
    await patchAutomod({ antiInsultWords: automodCfg.antiInsultWords.filter((w) => w !== word) });
  }

  async function addAmDomain() {
    if (!amNewDomain.trim() || !automodCfg) return;
    const d = amNewDomain.trim().toLowerCase();
    if (automodCfg.antilinkAllowedDomains.includes(d)) { toast({ title: "Domaine déjà présent", variant: "destructive" }); return; }
    await patchAutomod({ antilinkAllowedDomains: [...automodCfg.antilinkAllowedDomains, d] });
    setAmNewDomain("");
  }

  async function removeAmDomain(domain: string) {
    if (!automodCfg) return;
    await patchAutomod({ antilinkAllowedDomains: automodCfg.antilinkAllowedDomains.filter((d) => d !== domain) });
  }

  // ── Bot status actions ─────────────────────────────────────────────────────
  async function saveAntiProtection() {
    if (!antiProtection) return;
    setApSaving(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/anti-protection`, { method: "PATCH", body: JSON.stringify(antiProtection) });
      const d = await r.json();
      if (r.ok) { setAntiProtection(d as AntiProtection); toast({ title: "Protections sauvegardées ✓" }); }
      else toast({ title: "Erreur", description: (d as { error?: string }).error, variant: "destructive" });
    } finally { setApSaving(false); }
  }

  async function stripRolePerms() {
    if (!stripRoleId) return;
    setStrippingPerms(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/roles/${stripRoleId}/strip-permissions`, { method: "POST" });
      const d = await r.json() as { ok?: boolean; roleName?: string; error?: string };
      if (r.ok) { toast({ title: `Permissions supprimées ✓`, description: `Rôle "${d.roleName}" vidé de toutes ses permissions.` }); setStripRoleId(""); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setStrippingPerms(false); }
  }

  const fetchBotStatus = useCallback(async () => {
    setBotStatusLoading(true);
    try {
      const r = await apiFetch("/api/owner/bot/status");
      if (r.ok) setBotStatus(await r.json());
    } finally { setBotStatusLoading(false); }
  }, []);

  const fetchBotStatusEvents = useCallback(async () => {
    setBseLoading(true);
    try {
      const r = await apiFetch("/api/owner/bot-status-events?limit=200");
      if (r.ok) setBotStatusEvents(await r.json() as BotStatusEvent[]);
    } finally { setBseLoading(false); }
  }, []);

  async function botAction(action: "restart" | "disconnect" | "reconnect") {
    setBotActionLoading(action);
    try {
      const r = await apiFetch(`/api/owner/bot/${action}`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        toast({ title: { restart: "Bot redémarré ✓", disconnect: "Bot déconnecté ✓", reconnect: "Bot reconnecté ✓" }[action] });
        setTimeout(fetchBotStatus, 3000);
      } else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setBotActionLoading(""); }
  }

  async function savePresence() {
    setPresenceSaving(true);
    try {
      const r = await apiFetch("/api/owner/bot/presence", {
        method: "PATCH",
        body: JSON.stringify({ status: presenceStatus, activityType: Number(presenceActivityType), activityText: presenceActivityText }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Présence mise à jour ✓" }); setTimeout(fetchBotStatus, 1500); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setPresenceSaving(false); }
  }

  async function doBroadcast() {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    setBroadcastResults([]);
    try {
      const r = await apiFetch("/api/owner/bot/broadcast", { method: "POST", body: JSON.stringify({ message: broadcastMsg.trim() }) });
      const d = await r.json();
      if (r.ok) { toast({ title: "Diffusion envoyée ✓" }); setBroadcastResults(d.results ?? []); setBroadcastMsg(""); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setBroadcasting(false); }
  }

  // ── Ticket actions ─────────────────────────────────────────────────────────
  async function doCloseTicket(channelId: string) {
    if (!closeTicketReason.trim()) { toast({ title: "Raison requise", variant: "destructive" }); return; }
    setClosingTicket(channelId);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/tickets/${channelId}/close`, {
        method: "POST",
        body: JSON.stringify({ reason: closeTicketReason.trim() }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Ticket fermé ✓" }); setCloseTicketReason(""); await fetchTickets(); void fetchTranscripts(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setClosingTicket(""); }
  }

  // ── Notes actions ─────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/notes`);
      if (r.ok) setNotesByUser(await r.json());
    } finally { setNotesLoading(false); }
  }, [guildId]);

  async function deleteNoteEntry(userId: string, noteId: number) {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/notes/${userId}/${noteId}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) { toast({ title: "Note supprimée ✓" }); await fetchNotes(); }
    else toast({ title: "Erreur", description: d.error, variant: "destructive" });
  }

  async function clearUserNotes(userId: string) {
    if (!confirm("Supprimer toutes les notes de cet utilisateur ?")) return;
    const r = await apiFetch(`/api/owner/guilds/${guildId}/notes/${userId}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) { toast({ title: `${d.count} note(s) effacée(s) ✓` }); await fetchNotes(); }
    else toast({ title: "Erreur", description: d.error, variant: "destructive" });
  }

  async function downloadSanctionsCsv() {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/sanctions/export`);
    if (!r.ok) { toast({ title: "Erreur lors de l'export", variant: "destructive" }); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sanctions-${guildId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Clone config actions ───────────────────────────────────────────────────
  const fetchAllGuilds = useCallback(async () => {
    const r = await apiFetch("/api/owner/guilds");
    if (r.ok) setAllGuilds(await r.json());
  }, []);

  async function doCloneConfig() {
    if (!cloneTarget) return;
    setCloning(true);
    setCloneResult(null);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/clone-config`, {
        method: "POST",
        body: JSON.stringify({ targetGuildId: cloneTarget }),
      });
      const d = await r.json();
      if (r.ok) {
        const name = allGuilds.find((g) => g.id === cloneTarget)?.name ?? cloneTarget;
        setCloneResult({ ok: true, msg: `Configuration clonée vers "${name}" avec succès ✓` });
        toast({ title: "Configuration clonée ✓" });
      } else {
        setCloneResult({ ok: false, msg: d.error ?? "Erreur inconnue" });
        toast({ title: "Erreur", description: d.error, variant: "destructive" });
      }
    } finally { setCloning(false); }
  }

  // ── Invite blacklist actions ───────────────────────────────────────────────
  const fetchInviteBl = useCallback(async () => {
    setInviteBlLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/invite-blacklist`);
      if (r.ok) setInviteBl(await r.json());
    } finally { setInviteBlLoading(false); }
  }, [guildId]);

  async function removeInviteBlEntry(userId: string) {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/invite-blacklist/${userId}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) { toast({ title: "Entrée retirée ✓" }); await fetchInviteBl(); }
    else toast({ title: "Erreur", description: d.error, variant: "destructive" });
  }

  // ── Action log ─────────────────────────────────────────────────────────────
  const fetchActionLog = useCallback(async () => {
    setActionLogLoading(true);
    try {
      const r = await apiFetch("/api/owner/action-log");
      if (r.ok) setActionLog(await r.json());
    } finally { setActionLogLoading(false); }
  }, []);

  // ── Quarantaine actions ────────────────────────────────────────────────────
  const fetchQuarantine = useCallback(async () => {
    setQuarantineLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/quarantine`);
      if (r.ok) setQuarantineList(await r.json());
    } finally { setQuarantineLoading(false); }
  }, [guildId]);

  async function liftQuarantine(userId: string) {
    setLiftingQ(userId);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/quarantine/${userId}`, { method: "DELETE" });
      const d = await r.json();
      if (r.ok) { toast({ title: "Quarantaine levée ✓" }); await fetchQuarantine(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setLiftingQ(""); }
  }

  // ── Voice log actions ──────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!profileId.trim()) return;
    setProfileLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/member-profile/${profileId.trim()}`);
      const d = await r.json() as MemberProfile & { error?: string };
      if (r.ok) setProfileData(d);
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setProfileLoading(false); }
  }, [guildId, profileId, toast]);

  const fetchWarns = useCallback(async () => {
    if (!warnsUserId.trim()) return;
    setWarnsLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/member-profile/${warnsUserId.trim()}`);
      const d = await r.json() as MemberProfile & { error?: string };
      if (r.ok) setWarnsData(d.warns ?? []);
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setWarnsLoading(false); }
  }, [guildId, warnsUserId, toast]);

  const fetchTempbans = useCallback(async () => {
    setTempbansLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/tempbans`);
      if (r.ok) setTempbans(await r.json() as TempBanEntry[]);
    } finally { setTempbansLoading(false); }
  }, [guildId]);

  const fetchTimeouts = useCallback(async () => {
    setTimeoutsLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/timeouts`);
      if (r.ok) setTimeouts(await r.json() as TimeoutEntry[]);
    } finally { setTimeoutsLoading(false); }
  }, [guildId]);

  const fetchMaintenance = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/maintenance`);
      if (r.ok) { const d = await r.json() as { active: boolean; message: string }; setMaintenanceState(d); setMaintenanceMsgDraft(d.message); }
    } finally { setMaintenanceLoading(false); }
  }, [guildId]);

  const fetchUserCmds = useCallback(async () => {
    setUcLoading(true);
    try {
      const r = await apiFetch(`/api/owner/user-commands?limit=200`);
      if (r.ok) setUserCmds(await r.json() as UserCmd[]);
    } finally { setUcLoading(false); }
  }, []);

  const fetchSuspectAccounts = useCallback(async () => {
    setSaLoading(true);
    try {
      const r = await apiFetch(`/api/owner/suspect-accounts?limit=200`);
      if (r.ok) setSuspectAccounts(await r.json() as SuspectAcc[]);
    } finally { setSaLoading(false); }
  }, []);

  async function doSuspectAction(sa: SuspectAcc, action: "timeout" | "kick" | "ban") {
    setSaActionLoading(sa.id);
    try {
      let r: Response;
      const reasonBase = `[Dashboard Owner] Compte suspect (${sa.reasons.join(", ")})`;
      if (action === "timeout") {
        r = await apiFetch(`/api/owner/guilds/${sa.guildId}/members/${sa.userId}/timeout`, {
          method: "POST", body: JSON.stringify({ durationMs: 24 * 3_600_000, reason: reasonBase }),
        });
      } else if (action === "kick") {
        r = await apiFetch(`/api/owner/guilds/${sa.guildId}/members/${sa.userId}/kick`, {
          method: "POST", body: JSON.stringify({ reason: reasonBase }),
        });
      } else {
        r = await apiFetch(`/api/owner/guilds/${sa.guildId}/members/${sa.userId}/ban`, {
          method: "POST", body: JSON.stringify({ reason: reasonBase }),
        });
      }
      const d = await r.json();
      if (r.ok) toast({ title: `Action appliquée ✓ (${action})` });
      else toast({ title: "Erreur", description: (d as { error?: string }).error, variant: "destructive" });
    } finally { setSaActionLoading(null); }
  }

  const fetchInvites = useCallback(async () => {
    setInvitesLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/invites`);
      if (r.ok) setInvites(await r.json() as Invite[]);
    } finally { setInvitesLoading(false); }
  }, [guildId]);

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/audit-log?limit=50`);
      if (r.ok) setAuditLog(await r.json() as AuditEntry[]);
    } finally { setAuditLoading(false); }
  }, [guildId]);

  const fetchLogChannels = useCallback(async () => {
    setLogChannelsLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/log-channels`);
      if (r.ok) { const d = await r.json() as LogChannels; setLogChannels(d); setLogChannelsDraft(d); }
    } finally { setLogChannelsLoading(false); }
  }, [guildId]);

  const saveLogChannels = async () => {
    setLogChannelsSaving(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/log-channels`, { method: "PATCH", body: JSON.stringify(logChannelsDraft) });
      if (r.ok) { setLogChannels(await r.json() as LogChannels); toast({ title: "Salons de logs mis à jour ✓" }); }
      else toast({ title: "Erreur", variant: "destructive" });
    } finally { setLogChannelsSaving(false); }
  };

  const fetchCustomCmds = useCallback(async () => {
    setCustomCmdsLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/custom-commands`);
      if (r.ok) setCustomCmds(await r.json() as CustomCmd[]);
    } finally { setCustomCmdsLoading(false); }
  }, [guildId]);

  const addCustomCmd = async () => {
    if (!ccNewName.trim() || !ccNewResponse.trim()) return;
    setCustomCmdSaving(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/custom-commands`, { method: "POST", body: JSON.stringify({ name: ccNewName.trim(), response: ccNewResponse.trim() }) });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (r.ok) { toast({ title: `Commande &${ccNewName.toLowerCase()} créée ✓` }); setCcNewName(""); setCcNewResponse(""); fetchCustomCmds(); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setCustomCmdSaving(false); }
  };

  const deleteCustomCmd = async (name: string) => {
    const r = await apiFetch(`/api/owner/guilds/${guildId}/custom-commands/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (r.ok) { setCustomCmds(prev => prev.filter(c => c.name !== name)); toast({ title: `Commande &${name} supprimée` }); }
  };

  const fetchWordBl = useCallback(async () => {
    setWordBlLoading(true);
    try {
      const r = await apiFetch("/api/owner/global/word-blacklist");
      if (r.ok) setWordBl(await r.json() as string[]);
    } finally { setWordBlLoading(false); }
  }, []);

  const addWord = async () => {
    if (!newWord.trim()) return;
    setWordBlSaving(true);
    try {
      const r = await apiFetch("/api/owner/global/word-blacklist", { method: "POST", body: JSON.stringify({ word: newWord.trim() }) });
      const d = await r.json() as { ok?: boolean; words?: string[]; error?: string };
      if (r.ok) { setWordBl(d.words ?? []); setNewWord(""); toast({ title: "Mot ajouté ✓" }); }
      else toast({ title: "Erreur", description: d.error, variant: "destructive" });
    } finally { setWordBlSaving(false); }
  };

  const removeWord = async (word: string) => {
    const r = await apiFetch(`/api/owner/global/word-blacklist/${encodeURIComponent(word)}`, { method: "DELETE" });
    const d = await r.json() as { words?: string[] };
    if (r.ok) setWordBl(d.words ?? []);
  };

  const doGlobalSearch = async () => {
    if (!searchId.trim()) return;
    setSearchLoading(true);
    try {
      const r = await apiFetch(`/api/owner/global/member/${searchId.trim()}`);
      if (r.ok) setSearchResults(await r.json() as GlobalMemberResult[]);
      else toast({ title: "Erreur", variant: "destructive" });
    } finally { setSearchLoading(false); }
  };

  const fetchBotReplyLogs = useCallback(async () => {
    setBotReplyLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/bot-reply-logs?limit=200`);
      if (r.ok) setBotReplyLogs(await r.json() as BotReplyLog[]);
    } finally { setBotReplyLoading(false); }
  }, [guildId]);

  const fetchVoiceLog = useCallback(async () => {
    setVoiceLogLoading(true);
    try {
      const r = await apiFetch(`/api/owner/guilds/${guildId}/voice-log`);
      if (r.ok) setVoiceLog(await r.json());
    } finally { setVoiceLogLoading(false); }
  }, [guildId]);

  async function clearVoiceLogAction() {
    if (!confirm("Effacer tout le journal vocal ?")) return;
    await apiFetch(`/api/owner/guilds/${guildId}/voice-log`, { method: "DELETE" });
    setVoiceLog([]);
    toast({ title: "Journal vocal effacé ✓" });
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
          <TabsTrigger value="automod" className="gap-1.5 text-xs" onClick={fetchAutomod}><Zap className="h-3.5 w-3.5" />Automod</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5 text-xs" onClick={fetchTickets}><Ticket className="h-3.5 w-3.5" />Tickets</TabsTrigger>
          <TabsTrigger value="botstatus" className="gap-1.5 text-xs" onClick={() => { void fetchBotStatus(); void fetchBotStatusEvents(); }}><Server className="h-3.5 w-3.5" />Statut Bot</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-xs" onClick={fetchNotes}><BookOpen className="h-3.5 w-3.5" />Notes</TabsTrigger>
          <TabsTrigger value="cloneconfig" className="gap-1.5 text-xs" onClick={fetchAllGuilds}><Copy className="h-3.5 w-3.5" />Clone Config</TabsTrigger>
          <TabsTrigger value="invitebl" className="gap-1.5 text-xs" onClick={fetchInviteBl}><Link2Off className="h-3.5 w-3.5" />Invites BL</TabsTrigger>
          <TabsTrigger value="actionlog" className="gap-1.5 text-xs" onClick={fetchActionLog}><ScrollText className="h-3.5 w-3.5" />Journal</TabsTrigger>
          <TabsTrigger value="quarantine" className="gap-1.5 text-xs" onClick={fetchQuarantine}><ShieldOff className="h-3.5 w-3.5" />Quarantaine</TabsTrigger>
          <TabsTrigger value="voicelog" className="gap-1.5 text-xs" onClick={fetchVoiceLog}><Volume2 className="h-3.5 w-3.5" />Vocaux</TabsTrigger>
          <TabsTrigger value="member-profile" className="gap-1.5 text-xs" onClick={() => setProfileData(null)}><UserCheck className="h-3.5 w-3.5" />Fiche Membre</TabsTrigger>
          <TabsTrigger value="warns" className="gap-1.5 text-xs" onClick={() => setWarnsData(null)}><AlertCircle className="h-3.5 w-3.5" />Warns</TabsTrigger>
          <TabsTrigger value="tempbans" className="gap-1.5 text-xs" onClick={fetchTempbans}><Ban className="h-3.5 w-3.5" />Tempbans</TabsTrigger>
          <TabsTrigger value="timeouts" className="gap-1.5 text-xs" onClick={fetchTimeouts}><Clock className="h-3.5 w-3.5" />Timeouts</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5 text-xs" onClick={fetchMaintenance}><Wrench className="h-3.5 w-3.5" />Maintenance</TabsTrigger>
          <TabsTrigger value="usercommands" className="gap-1.5 text-xs" onClick={fetchUserCmds}><MessageSquareWarning className="h-3.5 w-3.5" />Cmd. Users</TabsTrigger>
          <TabsTrigger value="suspectaccounts" className="gap-1.5 text-xs" onClick={fetchSuspectAccounts}><ShieldAlert className="h-3.5 w-3.5" />Suspects</TabsTrigger>
          <TabsTrigger value="mass-action" className="gap-1.5 text-xs"><Gavel className="h-3.5 w-3.5" />Masse-Action</TabsTrigger>
          <TabsTrigger value="invitations" className="gap-1.5 text-xs" onClick={fetchInvites}><Link2Off className="h-3.5 w-3.5" />Invitations</TabsTrigger>
          <TabsTrigger value="audit-log" className="gap-1.5 text-xs" onClick={fetchAuditLog}><ListFilter className="h-3.5 w-3.5" />Audit Log</TabsTrigger>
          <TabsTrigger value="log-channels" className="gap-1.5 text-xs" onClick={fetchLogChannels}><Hash className="h-3.5 w-3.5" />Logs Config</TabsTrigger>
          <TabsTrigger value="config-json" className="gap-1.5 text-xs"><Download className="h-3.5 w-3.5" />Config JSON</TabsTrigger>
          <TabsTrigger value="custom-cmds" className="gap-1.5 text-xs" onClick={fetchCustomCmds}><Command className="h-3.5 w-3.5" />Cmds Custom</TabsTrigger>
          <TabsTrigger value="word-bl" className="gap-1.5 text-xs" onClick={fetchWordBl}><Globe className="h-3.5 w-3.5" />Mots Globaux</TabsTrigger>
          <TabsTrigger value="global-search" className="gap-1.5 text-xs" onClick={() => setSearchResults(null)}><SearchCode className="h-3.5 w-3.5" />Recherche</TabsTrigger>
          <TabsTrigger value="bot-reply-logs" className="gap-1.5 text-xs" onClick={fetchBotReplyLogs}><MessageSquareWarning className="h-3.5 w-3.5" />Logs Bot</TabsTrigger>
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

          {/* Embed builder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🎨 Envoyer un Embed</CardTitle>
              <CardDescription>Construit et envoie un message embed avec titre, description et couleur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Salon</label>
                <Select value={embedChannelId} onValueChange={setEmbedChannelId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un salon..." /></SelectTrigger>
                  <SelectContent>
                    {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Titre</label>
                  <Input value={embedTitle} onChange={(e) => setEmbedTitle(e.target.value)} placeholder="Titre de l'embed..." maxLength={256} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Couleur</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} className="h-9 w-14 rounded border border-border cursor-pointer bg-transparent" />
                    <Input value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} placeholder="#5865f2" className="font-mono flex-1" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <Textarea value={embedDesc} onChange={(e) => setEmbedDesc(e.target.value)} placeholder="Contenu de l'embed (markdown Discord)..." rows={3} className="font-mono text-sm resize-none" maxLength={4096} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Image (URL, facultatif)</label>
                  <Input value={embedImage} onChange={(e) => setEmbedImage(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Footer (facultatif)</label>
                  <Input value={embedFooter} onChange={(e) => setEmbedFooter(e.target.value)} placeholder="Texte de bas de page..." maxLength={2048} />
                </div>
              </div>
              <Button onClick={sendEmbed} disabled={sendingEmbed || !embedChannelId || (!embedTitle.trim() && !embedDesc.trim())} className="gap-2">
                {sendingEmbed ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Envoyer l'embed</>}
              </Button>
            </CardContent>
          </Card>

          {/* Schedule message */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">⏰ Programmer un Message</CardTitle>
              <CardDescription>Envoie un message dans X minutes dans le salon choisi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Salon</label>
                  <Select value={schedChannelId} onValueChange={setSchedChannelId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un salon..." /></SelectTrigger>
                    <SelectContent>
                      {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Délai (minutes)</label>
                  <Input type="number" min="1" max="1440" value={schedDelay} onChange={(e) => setSchedDelay(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Contenu</label>
                <Textarea value={schedContent} onChange={(e) => setSchedContent(e.target.value)} placeholder="Message à envoyer dans X minutes..." rows={3} className="font-mono text-sm resize-none" />
              </div>
              <Button onClick={scheduleMessage} disabled={scheduling || !schedChannelId || !schedContent.trim() || Number(schedDelay) < 1} className="gap-2">
                {scheduling ? <><Loader2 className="h-4 w-4 animate-spin" />Planification…</> : <><Clock className="h-4 w-4" />Planifier</>}
              </Button>
            </CardContent>
          </Card>

          {/* Edit message */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">✏️ Modifier un Message du Bot</CardTitle>
              <CardDescription>Modifie le contenu d'un message envoyé par le bot via son ID.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Salon</label>
                  <Select value={editChannelId} onValueChange={setEditChannelId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un salon..." /></SelectTrigger>
                    <SelectContent>
                      {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ID du message</label>
                  <Input value={editMsgId} onChange={(e) => setEditMsgId(e.target.value)} placeholder="123456789012345678" className="font-mono" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nouveau contenu</label>
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="Nouveau texte du message..." rows={3} className="font-mono text-sm resize-none" />
              </div>
              <Button onClick={editMessage} disabled={editing || !editChannelId || !editMsgId.trim() || !editContent.trim()} className="gap-2">
                {editing ? <><Loader2 className="h-4 w-4 animate-spin" />Modification…</> : <><Pencil className="h-4 w-4" />Modifier</>}
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

          {/* Lock / Unlock */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🔒 Verrouiller / Déverrouiller</CardTitle>
              <CardDescription>Empêche ou restaure l'envoi de messages (@everyone) en un clic.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Salon cible</label>
                <Select value={lockChannelId} onValueChange={setLockChannelId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un salon texte..." /></SelectTrigger>
                  <SelectContent>
                    {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => lockUnlockChannel("lock")} disabled={locking || !lockChannelId} variant="destructive" className="gap-2">
                  {locking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Verrouiller
                </Button>
                <Button onClick={() => lockUnlockChannel("unlock")} disabled={locking || !lockChannelId} variant="outline" className="gap-2">
                  {locking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />} Déverrouiller
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Purge */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🗑️ Purge de Messages</CardTitle>
              <CardDescription>Supprime les X derniers messages d'un salon (max 100, ≤14 jours).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="text-sm font-medium mb-1.5 block">Salon</label>
                  <Select value={purgeChannelId} onValueChange={setPurgeChannelId}>
                    <SelectTrigger><SelectValue placeholder="Salon..." /></SelectTrigger>
                    <SelectContent>
                      {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nombre (1-100)</label>
                  <Input type="number" min="1" max="100" value={purgeLimit} onChange={(e) => setPurgeLimit(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ID utilisateur (optionnel)</label>
                  <Input value={purgeUserId} onChange={(e) => setPurgeUserId(e.target.value)} placeholder="ID ou vide pour tous" className="font-mono" />
                </div>
              </div>
              <Button onClick={purgeChannel} disabled={purging || !purgeChannelId} variant="destructive" className="gap-2">
                {purging ? <><Loader2 className="h-4 w-4 animate-spin" />Purge…</> : <><Trash2 className="h-4 w-4" />Purger</>}
              </Button>
            </CardContent>
          </Card>

          {/* Slowmode */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🐢 Slowmode Rapide</CardTitle>
              <CardDescription>Définit le délai entre messages dans un salon (0 = désactivé, max 21600s).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Salon</label>
                  <Select value={slowChannelId} onValueChange={setSlowChannelId}>
                    <SelectTrigger><SelectValue placeholder="Salon..." /></SelectTrigger>
                    <SelectContent>
                      {textChannels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Délai en secondes</label>
                  <Input type="number" min="0" max="21600" value={slowSeconds} onChange={(e) => setSlowSeconds(e.target.value)} placeholder="0 pour désactiver" />
                </div>
              </div>
              <Button onClick={setSlowmode} disabled={slowing || !slowChannelId} className="gap-2">
                {slowing ? <><Loader2 className="h-4 w-4 animate-spin" />Application…</> : <>🐢 Appliquer</>}
              </Button>
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

          {/* Unban */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🔓 Débannir un Membre</CardTitle>
              <CardDescription>Retire un bannissement via l'ID utilisateur Discord.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ID Utilisateur</label>
                  <Input value={unbanId} onChange={(e) => setUnbanId(e.target.value)} placeholder="123456789012345678" className="font-mono" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Raison (optionnel)</label>
                  <Input value={unbanReason} onChange={(e) => setUnbanReason(e.target.value)} placeholder="Raison du débannissement..." />
                </div>
              </div>
              <Button onClick={unbanUser} disabled={unbanning || !unbanId.trim()} className="gap-2">
                {unbanning ? <><Loader2 className="h-4 w-4 animate-spin" />Débannissement…</> : <>🔓 Débannir</>}
              </Button>
            </CardContent>
          </Card>

          {/* Role assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🏷️ Gérer les Rôles</CardTitle>
              <CardDescription>Ajoute ou retire un rôle sur un membre présent dans le serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Membre</label>
                  <Select value={roleMemberId} onValueChange={setRoleMemberId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un membre..." /></SelectTrigger>
                    <SelectContent>
                      {members.filter((m) => !m.bot).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Rôle</label>
                  <Select value={roleId} onValueChange={setRoleId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un rôle..." /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="flex items-center gap-2">
                            {r.color && r.color !== "#000000" && (
                              <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                            )}
                            {r.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setRoleAction("add"); setTimeout(assignRole, 0); }} disabled={rolesLoading || !roleMemberId || !roleId} className="gap-2">
                  {rolesLoading && roleAction === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />} Ajouter le rôle
                </Button>
                <Button onClick={() => { setRoleAction("remove"); setTimeout(assignRole, 0); }} disabled={rolesLoading || !roleMemberId || !roleId} variant="outline" className="gap-2">
                  {rolesLoading && roleAction === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />} Retirer le rôle
                </Button>
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

          {/* ── Protections Anti-Abus ───────────────────────────────────────── */}
          {apLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : antiProtection ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-mono uppercase">🚨 Anti-Raider Silencieux</CardTitle>
                  <CardDescription>Détecte automatiquement les vagues de joins et prend action en silence (sans log public).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40">
                    <label className="text-sm font-medium flex-1">Anti-Raider activé</label>
                    <Button size="sm" variant={antiProtection.antiRaiderEnabled ? "default" : "outline"}
                      onClick={() => setAntiProtection({ ...antiProtection, antiRaiderEnabled: !antiProtection.antiRaiderEnabled })}
                      className="gap-1.5 w-28">
                      {antiProtection.antiRaiderEnabled ? <><Power className="h-3.5 w-3.5" />Activé</> : <><PowerOff className="h-3.5 w-3.5" />Désactivé</>}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Seuil (joins · {antiProtection.antiRaiderThreshold})</label>
                      <Input type="number" min={2} max={50} value={antiProtection.antiRaiderThreshold}
                        onChange={(e) => setAntiProtection({ ...antiProtection, antiRaiderThreshold: Number(e.target.value) })} className="font-mono" />
                      <p className="text-xs text-muted-foreground mt-1">Nombre de joins déclenchant l'alerte</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Fenêtre (secondes · {antiProtection.antiRaiderWindow})</label>
                      <Input type="number" min={3} max={120} value={antiProtection.antiRaiderWindow}
                        onChange={(e) => setAntiProtection({ ...antiProtection, antiRaiderWindow: Number(e.target.value) })} className="font-mono" />
                      <p className="text-xs text-muted-foreground mt-1">Délai dans lequel compter les joins</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Action</label>
                      <Select value={antiProtection.antiRaiderAction} onValueChange={(v) => setAntiProtection({ ...antiProtection, antiRaiderAction: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timeout">Timeout 1h (silencieux)</SelectItem>
                          <SelectItem value="kick">Expulsion (silencieux)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-mono uppercase">🛡️ Protections Audit Log</CardTitle>
                  <CardDescription>Détecte et sanctionne les abus d'administration via le journal d'audit Discord. Nécessite l'intent GuildModeration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {([
                    { key: "antiMoveEnabled" as const, label: "Anti-Move", icon: "🔀", desc: "Détecte les déplacements forcés de membres en vocal — timeout exécuteur 1h" },
                    { key: "antiMuteEnabled" as const, label: "Anti-Mute", icon: "🔇", desc: "Détecte le mute serveur de membres — révoque le mute + timeout exécuteur 1h" },
                    { key: "antiDisconnectEnabled" as const, label: "Anti-Disconnect", icon: "🔌", desc: "Détecte les déconnexions forcées du vocal — timeout exécuteur 1h" },
                    { key: "antiBotEnabled" as const, label: "Anti-Bot", icon: "🤖", desc: "Expulse les bots ajoutés non autorisés — timeout de l'ajouteur 1h" },
                  ] as { key: keyof AntiProtection; label: string; icon: string; desc: string }[]).map(({ key, label, icon, desc }) => (
                    <div key={key} className="flex items-start gap-3 p-3 rounded-md bg-muted/40">
                      <span className="text-lg mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <Button size="sm" variant={antiProtection[key] ? "default" : "outline"}
                        onClick={() => setAntiProtection({ ...antiProtection, [key]: !antiProtection[key] })}
                        className="gap-1.5 w-28 shrink-0">
                        {antiProtection[key] ? <><Power className="h-3.5 w-3.5" />Activé</> : <><PowerOff className="h-3.5 w-3.5" />Désactivé</>}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-mono uppercase">🔑 Retirer les Permissions d'un Rôle</CardTitle>
                  <CardDescription>Vide entièrement les permissions d'un rôle (met toutes les permissions à 0). Action irréversible.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    <Select value={stripRoleId} onValueChange={setStripRoleId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Sélectionner un rôle…" /></SelectTrigger>
                      <SelectContent>
                        {roles.filter((r) => r.name !== "@everyone").map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <span className="flex items-center gap-2">
                              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color || "#6b7280" }} />
                              {r.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="destructive" disabled={!stripRoleId || strippingPerms} onClick={stripRolePerms} className="gap-2 shrink-0">
                      {strippingPerms ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                      Retirer les perms
                    </Button>
                  </div>
                  {stripRoleId && (
                    <p className="text-xs text-destructive font-medium">⚠️ Cette action retirera <strong>toutes</strong> les permissions du rôle sélectionné sur Discord. Elle ne peut pas être annulée depuis ici.</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={saveAntiProtection} disabled={apSaving} className="gap-2 font-mono uppercase tracking-widest">
                  {apSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Sauvegarde…</> : <><Shield className="h-4 w-4" />Sauvegarder les protections</>}
                </Button>
              </div>
            </>
          ) : null}
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

        {/* ── Automod ────────────────────────────────────────────────────────── */}
        <TabsContent value="automod" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🤖 Modules Automod</CardTitle>
              <CardDescription>Active ou désactive les modules de modération automatique du serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {automodCfg ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Anti-insultes */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">🤬 Anti-Insultes</p>
                        <p className="text-xs text-muted-foreground">Filtre les mots offensants définis ci-dessous.</p>
                      </div>
                      <Button
                        size="sm"
                        variant={automodCfg.antiInsultEnabled ? "default" : "outline"}
                        onClick={() => patchAutomod({ antiInsultEnabled: !automodCfg.antiInsultEnabled })}
                        className="gap-1.5 text-xs"
                      >
                        {automodCfg.antiInsultEnabled ? "✅ Activé" : "⬜ Désactivé"}
                      </Button>
                    </div>
                    {/* Anti-webhooks */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">🪝 Anti-Webhooks</p>
                        <p className="text-xs text-muted-foreground">Supprime les messages envoyés par des webhooks.</p>
                      </div>
                      <Button
                        size="sm"
                        variant={automodCfg.antiWebhookEnabled ? "default" : "outline"}
                        onClick={() => patchAutomod({ antiWebhookEnabled: !automodCfg.antiWebhookEnabled })}
                        className="gap-1.5 text-xs"
                      >
                        {automodCfg.antiWebhookEnabled ? "✅ Activé" : "⬜ Désactivé"}
                      </Button>
                    </div>
                    {/* Anti-liens */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">🔗 Anti-Liens</p>
                        <p className="text-xs text-muted-foreground">Bloque les liens selon la liste de domaines autorisés.</p>
                      </div>
                      <Button
                        size="sm"
                        variant={automodCfg.antilinkEnabled ? "default" : "outline"}
                        onClick={() => patchAutomod({ antilinkEnabled: !automodCfg.antilinkEnabled })}
                        className="gap-1.5 text-xs"
                      >
                        {automodCfg.antilinkEnabled ? "✅ Activé" : "⬜ Désactivé"}
                      </Button>
                    </div>
                    {/* Niveau de sécurité */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">🛡️ Niveau de Sécurité</p>
                        <p className="text-xs text-muted-foreground">Actuel : <strong>{automodCfg.securityLevel}</strong></p>
                      </div>
                      <Select
                        value={String(automodCfg.securityLevel)}
                        onValueChange={(v) => patchAutomod({ securityLevel: Number(v) as 1 | 2 | 3 })}
                      >
                        <SelectTrigger className="w-28 text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 — Bas</SelectItem>
                          <SelectItem value="2">2 — Moyen</SelectItem>
                          <SelectItem value="3">3 — Élevé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Action antilink */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">⚡ Action Anti-Liens</p>
                        <p className="text-xs text-muted-foreground">Actuel : <strong>{automodCfg.antilinkAction}</strong></p>
                      </div>
                      <Select
                        value={automodCfg.antilinkAction}
                        onValueChange={(v) => patchAutomod({ antilinkAction: v as AutomodCfg["antilinkAction"] })}
                      >
                        <SelectTrigger className="w-36 text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delete">Supprimer</SelectItem>
                          <SelectItem value="warn">Avertir</SelectItem>
                          <SelectItem value="timeout">Timeout</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Insult words editor */}
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium">📋 Mots Interdits</p>
                    <div className="flex flex-wrap gap-1.5">
                      {automodCfg.antiInsultWords.map((w) => (
                        <Badge key={w} variant="secondary" className="gap-1 pr-1">
                          {w}
                          <button onClick={() => removeAmWord(w)} className="ml-0.5 hover:text-destructive transition-colors">×</button>
                        </Badge>
                      ))}
                      {automodCfg.antiInsultWords.length === 0 && (
                        <span className="text-xs text-muted-foreground">Aucun mot défini.</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={amNewWord}
                        onChange={(e) => setAmNewWord(e.target.value)}
                        placeholder="Ajouter un mot interdit..."
                        className="flex-1 text-sm"
                        onKeyDown={(e) => { if (e.key === "Enter") addAmWord(); }}
                      />
                      <Button onClick={addAmWord} disabled={!amNewWord.trim()} size="sm" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Ajouter
                      </Button>
                    </div>
                  </div>

                  {/* Allowed domains editor */}
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium">✅ Domaines Autorisés (Anti-Liens)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {automodCfg.antilinkAllowedDomains.map((d) => (
                        <Badge key={d} variant="outline" className="gap-1 pr-1">
                          {d}
                          <button onClick={() => removeAmDomain(d)} className="ml-0.5 hover:text-destructive transition-colors">×</button>
                        </Badge>
                      ))}
                      {automodCfg.antilinkAllowedDomains.length === 0 && (
                        <span className="text-xs text-muted-foreground">Aucun domaine autorisé.</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={amNewDomain}
                        onChange={(e) => setAmNewDomain(e.target.value)}
                        placeholder="discord.com, exemple.fr..."
                        className="flex-1 text-sm font-mono"
                        onKeyDown={(e) => { if (e.key === "Enter") addAmDomain(); }}
                      />
                      <Button onClick={addAmDomain} disabled={!amNewDomain.trim()} size="sm" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Ajouter
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tickets ────────────────────────────────────────────────────────── */}
        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🎫 Tickets Actifs</CardTitle>
              <CardDescription>Liste tous les tickets ouverts. Ferme un ticket et génère son transcript.</CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 text-sm">Aucun ticket ouvert pour ce serveur.</div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <div key={t.channelId} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                      <Ticket className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Ticket #{t.ticketNumber}</p>
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {t.username}
                          {t.claimedBy && <> · Pris en charge : {t.claimedBy}</>}
                          {t.createdAt && <> · {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => doCloseTicket(t.channelId)}
                        className="gap-1.5 text-xs flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Clore
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={fetchTickets} className="gap-2">
                  <Loader2 className={`h-3.5 w-3.5 ${ticketsLoading ? "animate-spin" : "opacity-0"}`} />
                  Rafraîchir
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bot Status ─────────────────────────────────────────────────────── */}
        <TabsContent value="botstatus" className="space-y-4">

          {/* Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-mono uppercase">📊 Statut en Temps Réel</CardTitle>
                <CardDescription>Informations live sur la connexion et les ressources du bot.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchBotStatus} disabled={botStatusLoading} className="gap-2">
                <RefreshCw className={`h-3.5 w-3.5 ${botStatusLoading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </CardHeader>
            <CardContent>
              {!botStatus ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Bot identity */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                    {botStatus.avatarURL ? (
                      <img src={botStatus.avatarURL} alt="avatar" className="h-12 w-12 rounded-full" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><Server className="h-6 w-6" /></div>
                    )}
                    <div>
                      <p className="font-semibold">{botStatus.username ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{botStatus.tag ?? "non connecté"}</p>
                    </div>
                    <div className="ml-auto">
                      {botStatus.online ? (
                        <Badge className="gap-1.5 bg-green-500/20 text-green-400 border-green-500/30">
                          <Wifi className="h-3 w-3" /> En ligne
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1.5">
                          <WifiOff className="h-3 w-3" /> Hors ligne
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-border text-center">
                      <p className="text-2xl font-bold font-mono">{botStatus.ping >= 0 ? `${botStatus.ping}ms` : "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Ping WS</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border text-center">
                      <p className="text-2xl font-bold font-mono">
                        {botStatus.uptime != null
                          ? (() => { const h = Math.floor(botStatus.uptime / 3600000); const m = Math.floor((botStatus.uptime % 3600000) / 60000); return h > 0 ? `${h}h${m}m` : `${m}m`; })()
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Uptime</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border text-center">
                      <p className="text-2xl font-bold font-mono">{botStatus.guildCount}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Serveurs</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border text-center">
                      <p className="text-2xl font-bold font-mono">{(botStatus.memory / 1024 / 1024).toFixed(0)} MB</p>
                      <p className="text-xs text-muted-foreground mt-0.5">RAM (heap)</p>
                    </div>
                  </div>

                  {/* Current presence */}
                  {botStatus.presence && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      Présence actuelle :
                      <Badge variant="outline" className="text-xs capitalize">{botStatus.presence.status}</Badge>
                      {botStatus.presence.activities.length > 0 && (
                        <span className="font-mono text-xs">{botStatus.presence.activities[0].name}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bot status event log */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-mono uppercase">📋 Journal d'Événements Bot</CardTitle>
                  <CardDescription>Ping élevé, reconnexions Discord, DM échoués, erreurs non gérées, démarrages.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchBotStatusEvents} disabled={bseLoading} className="gap-1.5 shrink-0">
                  {bseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bseLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : botStatusEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Aucun événement enregistré depuis le dernier démarrage.</p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {botStatusEvents.map((ev) => {
                    const icons: Record<string, string> = {
                      ready: "🟢", ping_alert: "🟡", reconnect: "🔄",
                      shard_resume: "✅", shard_disconnect: "🔌",
                      dm_failed: "✉️", client_error: "🔴",
                      unhandled_rejection: "💥", shutdown: "🛑",
                    };
                    const colors: Record<string, string> = {
                      ready: "text-green-600 border-green-300 bg-green-500/10",
                      ping_alert: "text-yellow-600 border-yellow-300 bg-yellow-500/10",
                      reconnect: "text-blue-600 border-blue-300 bg-blue-500/10",
                      shard_resume: "text-green-600 border-green-300 bg-green-500/10",
                      shard_disconnect: "text-orange-600 border-orange-300 bg-orange-500/10",
                      dm_failed: "text-purple-600 border-purple-300 bg-purple-500/10",
                      client_error: "text-red-600 border-red-300 bg-red-500/10",
                      unhandled_rejection: "text-red-700 border-red-400 bg-red-500/15",
                      shutdown: "text-gray-600 border-gray-300 bg-gray-500/10",
                    };
                    const icon = icons[ev.type] ?? "❓";
                    const colorClass = colors[ev.type] ?? "text-muted-foreground border-border bg-muted/20";
                    return (
                      <div key={ev.id} className="flex items-start gap-2.5 rounded-md border border-border bg-muted/20 px-3 py-2">
                        <span className="shrink-0 mt-0.5">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 ${colorClass}`}>{ev.type.replace(/_/g, " ")}</Badge>
                            {ev.errCode && <span className="font-mono text-[10px] text-muted-foreground">{ev.errCode}</span>}
                            {ev.ping != null && <span className="text-[10px] text-yellow-600 font-mono">{ev.ping}ms</span>}
                            <span className="text-xs text-muted-foreground ml-auto shrink-0">{new Date(ev.timestamp).toLocaleString("fr-FR")}</span>
                          </div>
                          <p className="text-sm mt-0.5 break-words text-muted-foreground">{ev.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">⚡ Contrôle du Processus</CardTitle>
              <CardDescription>Redémarre, déconnecte ou reconnecte le bot Discord. L'API reste active en permanence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => botAction("restart")}
                  disabled={!!botActionLoading}
                  className="gap-2"
                >
                  {botActionLoading === "restart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Redémarrer
                </Button>
                <Button
                  onClick={() => botAction("disconnect")}
                  disabled={!!botActionLoading}
                  variant="destructive"
                  className="gap-2"
                >
                  {botActionLoading === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
                  Déconnecter
                </Button>
                <Button
                  onClick={() => botAction("reconnect")}
                  disabled={!!botActionLoading}
                  variant="outline"
                  className="gap-2"
                >
                  {botActionLoading === "reconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  Reconnecter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ <strong>Redémarrer</strong> = déconnexion + reconnexion immédiate. <strong>Déconnecter</strong> coupe le bot jusqu'au prochain "Reconnecter".
              </p>
            </CardContent>
          </Card>

          {/* Presence setter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🎭 Présence Personnalisée</CardTitle>
              <CardDescription>Change le statut et l'activité affichés sur le profil Discord du bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Statut</label>
                  <Select value={presenceStatus} onValueChange={(v) => setPresenceStatus(v as typeof presenceStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">🟢 En ligne</SelectItem>
                      <SelectItem value="idle">🟡 Absent</SelectItem>
                      <SelectItem value="dnd">🔴 Ne pas déranger</SelectItem>
                      <SelectItem value="invisible">⚫ Invisible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Type d'activité</label>
                  <Select value={presenceActivityType} onValueChange={setPresenceActivityType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">🎮 Joue à</SelectItem>
                      <SelectItem value="1">📡 Stream</SelectItem>
                      <SelectItem value="2">🎵 Écoute</SelectItem>
                      <SelectItem value="3">👁️ Regarde</SelectItem>
                      <SelectItem value="5">🏆 Participe à</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Texte de l'activité</label>
                  <Input
                    value={presenceActivityText}
                    onChange={(e) => setPresenceActivityText(e.target.value)}
                    placeholder="le serveur 🛡️ (vide = aucune activité)"
                  />
                </div>
              </div>
              <Button onClick={savePresence} disabled={presenceSaving} className="gap-2">
                {presenceSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Sauvegarde…</> : <>🎭 Appliquer la présence</>}
              </Button>
            </CardContent>
          </Card>

          {/* Broadcast */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">📢 Diffusion Globale</CardTitle>
              <CardDescription>Envoie un message dans le salon de logs de chaque serveur où le bot est présent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Message à envoyer dans tous les salons logs..."
                rows={3}
                className="font-mono text-sm resize-none"
              />
              <Button onClick={doBroadcast} disabled={broadcasting || !broadcastMsg.trim()} variant="destructive" className="gap-2">
                {broadcasting ? <><Loader2 className="h-4 w-4 animate-spin" />Diffusion…</> : <><Radio className="h-4 w-4" />Diffuser sur tous les serveurs</>}
              </Button>
              {broadcastResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                  {broadcastResults.map((r) => (
                    <div key={r.guildName} className={`flex items-center gap-2 px-2 py-1 rounded ${r.ok ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                      {r.ok ? "✅" : "❌"} <span className="font-medium">{r.guildName}</span>
                      {r.error && <span className="text-muted-foreground ml-auto">{r.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Notes ─────────────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">📝 Notes Membres</CardTitle>
              <CardDescription>Notes admin privées sur les membres de ce serveur. Chargement à l'ouverture de l'onglet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Filtrer par userId…" className="font-mono text-sm" />
                <Button variant="outline" size="sm" onClick={fetchNotes} disabled={notesLoading} className="gap-1.5 shrink-0">
                  {notesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              {notesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : notesByUser.filter((u) => !noteSearch || u.userId.includes(noteSearch)).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune note enregistrée sur ce serveur.</p>
              ) : (
                <div className="space-y-4 max-h-[40rem] overflow-y-auto pr-1">
                  {notesByUser
                    .filter((u) => !noteSearch || u.userId.includes(noteSearch))
                    .map((u) => (
                      <div key={u.userId} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold">{u.userId}</span>
                          <Button size="sm" variant="destructive" onClick={() => clearUserNotes(u.userId)} className="gap-1 text-xs h-7">
                            <Trash2 className="h-3 w-3" /> Tout effacer
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {u.notes.map((n) => (
                            <div key={n.id} className="flex items-start gap-2 bg-muted/50 rounded px-3 py-2 text-sm">
                              <span className="text-muted-foreground text-xs font-mono mt-0.5 shrink-0">#{n.id}</span>
                              <div className="flex-1 min-w-0">
                                <p className="break-words">{n.content}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{n.moderator} · {new Date(n.timestamp).toLocaleString("fr-FR")}</p>
                              </div>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteNoteEntry(u.userId, n.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">📊 Export Sanctions (CSV)</CardTitle>
              <CardDescription>Télécharge toutes les warns enregistrées par le bot sur ce serveur.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadSanctionsCsv} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Télécharger le CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Clone Config ──────────────────────────────────────────────────── */}
        <TabsContent value="cloneconfig" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">📋 Cloner la Configuration</CardTitle>
              <CardDescription>Copie la configuration complète du serveur actuel (antilink, antispam, logs, captcha, bienvenue, sécurité…) vers un autre serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">Source : <span className="font-mono text-primary">{guildName || guildId}</span></p>
                <p className="text-xs text-muted-foreground">Toutes les options de configuration du bot seront copiées vers le serveur cible. Les canaux logs / rôles / IDs devront être reconfigurés manuellement.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Serveur cible</label>
                {allGuilds.filter((g) => g.id !== guildId).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun autre serveur disponible.</p>
                ) : (
                  <Select value={cloneTarget} onValueChange={setCloneTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir le serveur cible…" />
                    </SelectTrigger>
                    <SelectContent>
                      {allGuilds.filter((g) => g.id !== guildId).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} <span className="text-muted-foreground text-xs ml-1">({g.memberCount} membres)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {cloneResult && (
                <Alert variant={cloneResult.ok ? "default" : "destructive"}>
                  <AlertDescription>{cloneResult.msg}</AlertDescription>
                </Alert>
              )}
              <Button onClick={doCloneConfig} disabled={cloning || !cloneTarget} variant="destructive" className="gap-2">
                {cloning ? <><Loader2 className="h-4 w-4 animate-spin" />Clonage en cours…</> : <><Copy className="h-4 w-4" />Cloner la configuration</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Invite Blacklist ──────────────────────────────────────────────── */}
        <TabsContent value="invitebl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🔗 Invitations Blacklistées ({inviteBl.length})</CardTitle>
              <CardDescription>Membres dont les invitations Discord sont bloquées sur ce serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={iblSearch} onChange={(e) => setIblSearch(e.target.value)} placeholder="Rechercher par tag ou ID…" className="text-sm" />
                <Button variant="outline" size="sm" onClick={fetchInviteBl} disabled={inviteBlLoading} className="gap-1.5 shrink-0">
                  {inviteBlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              {inviteBlLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : inviteBl.filter((e) => !iblSearch || e.userTag.toLowerCase().includes(iblSearch.toLowerCase()) || e.userId.includes(iblSearch)).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune entrée dans la blacklist d'invitations.</p>
              ) : (
                <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1">
                  {inviteBl
                    .filter((e) => !iblSearch || e.userTag.toLowerCase().includes(iblSearch.toLowerCase()) || e.userId.includes(iblSearch))
                    .map((e) => (
                      <div key={e.userId} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-semibold">{e.userTag}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.userId}</p>
                          <p className="text-xs mt-0.5">{e.reason} <span className="text-muted-foreground">· par {e.moderatorTag}</span></p>
                          <p className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString("fr-FR")}</p>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => removeInviteBlEntry(e.userId)} className="gap-1 text-xs shrink-0 h-8">
                          <Trash2 className="h-3 w-3" /> Retirer
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Action Log ────────────────────────────────────────────────────── */}
        <TabsContent value="actionlog" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">📋 Journal des Actions Owner</CardTitle>
              <CardDescription>Historique des 300 dernières actions mutantes effectuées depuis le panel (toutes sessions, en mémoire).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" onClick={fetchActionLog} disabled={actionLogLoading} className="gap-1.5">
                {actionLogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualiser
              </Button>
              {actionLogLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : actionLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune action enregistrée (redémarrage du bot efface le journal).</p>
              ) : (
                <div className="space-y-1 max-h-[36rem] overflow-y-auto">
                  {actionLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 text-xs font-mono">
                      <span className="text-muted-foreground shrink-0 w-36">{new Date(entry.timestamp).toLocaleString("fr-FR")}</span>
                      <Badge
                        variant={entry.method === "DELETE" ? "destructive" : entry.method === "POST" ? "default" : "secondary"}
                        className="text-xs shrink-0 w-16 justify-center"
                      >
                        {entry.method}
                      </Badge>
                      <span className="text-foreground break-all flex-1">{entry.path}</span>
                      {Object.keys(entry.body ?? {}).length > 0 && (
                        <span className="text-muted-foreground truncate max-w-[180px] shrink-0" title={JSON.stringify(entry.body)}>
                          {JSON.stringify(entry.body)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Quarantaine ───────────────────────────────────────────────────── */}
        <TabsContent value="quarantine" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🔒 Quarantaine Staff ({quarantineList.length})</CardTitle>
              <CardDescription>
                Membres staff mis en quarantaine automatiquement (≥ 10 commandes en 30s). Le timeout Discord de 27 jours est appliqué.
                <br />
                <span className="text-amber-500 font-medium">Seul ce panel peut lever une quarantaine.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" onClick={fetchQuarantine} disabled={quarantineLoading} className="gap-1.5">
                {quarantineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualiser
              </Button>
              {quarantineLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : quarantineList.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <ShieldOff className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Aucun membre en quarantaine sur ce serveur.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quarantineList.map((entry) => (
                    <div key={entry.userId} className="flex items-start gap-3 p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">QUARANTAINE</Badge>
                          <span className="font-mono text-sm font-semibold">{entry.userTag}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{entry.userId}</p>
                        <p className="text-xs">
                          <span className="text-amber-400 font-medium">Déclencheur :</span> {entry.triggerCount} commandes en {entry.windowSeconds}s
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.reason}</p>
                        <p className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString("fr-FR")}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => liftQuarantine(entry.userId)}
                        disabled={liftingQ === entry.userId}
                        className="gap-1.5 shrink-0 border-green-500/50 text-green-500 hover:bg-green-500/10"
                      >
                        {liftingQ === entry.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                        Lever
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vocaux ────────────────────────────────────────────────────────── */}
        <TabsContent value="voicelog" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono uppercase">🎙️ Surveillance Vocaux ({voiceLog.length})</CardTitle>
              <CardDescription>Événements vocaux en temps réel (max 500 par serveur, en mémoire). Se réinitialise au redémarrage du bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={voiceSearch} onChange={(e) => setVoiceSearch(e.target.value)} placeholder="Filtrer par tag, userId ou salon…" className="text-sm" />
                <Button variant="outline" size="sm" onClick={fetchVoiceLog} disabled={voiceLogLoading} className="gap-1.5 shrink-0">
                  {voiceLogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button variant="destructive" size="sm" onClick={clearVoiceLogAction} className="gap-1.5 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {voiceLogLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : voiceLog.filter((e) => !voiceSearch || e.userTag.toLowerCase().includes(voiceSearch.toLowerCase()) || e.userId.includes(voiceSearch) || (e.channelName ?? "").toLowerCase().includes(voiceSearch.toLowerCase())).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun événement vocal enregistré.</p>
              ) : (
                <div className="space-y-0.5 max-h-[40rem] overflow-y-auto font-mono text-xs">
                  {voiceLog
                    .filter((e) => !voiceSearch || e.userTag.toLowerCase().includes(voiceSearch.toLowerCase()) || e.userId.includes(voiceSearch) || (e.channelName ?? "").toLowerCase().includes(voiceSearch.toLowerCase()))
                    .map((e, i) => {
                      const typeColors: Record<string, string> = {
                        join: "text-green-400", leave: "text-red-400", move: "text-blue-400",
                        mute: "text-yellow-400", unmute: "text-green-300",
                        sourd: "text-orange-400", "non-sourd": "text-green-300",
                        "mute-serveur": "text-red-500", "unmute-serveur": "text-green-400",
                        "sourd-serveur": "text-red-500", "non-sourd-serveur": "text-green-400",
                        "stream-début": "text-purple-400", "stream-fin": "text-purple-300",
                        "caméra": "text-cyan-400",
                      };
                      const typeIcons: Record<string, string> = {
                        join: "🟢", leave: "🔴", move: "🔄",
                        mute: "🔇", unmute: "🔊", sourd: "🎧", "non-sourd": "🎙️",
                        "mute-serveur": "🚫", "unmute-serveur": "✅",
                        "sourd-serveur": "🚫", "non-sourd-serveur": "✅",
                        "stream-début": "📡", "stream-fin": "📴", caméra: "📷",
                      };
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-muted/40">
                          <span className="text-muted-foreground shrink-0 w-32">{new Date(e.timestamp).toLocaleTimeString("fr-FR")}</span>
                          <span className={`shrink-0 w-28 ${typeColors[e.type] ?? "text-foreground"}`}>
                            {typeIcons[e.type] ?? "•"} {e.type}
                          </span>
                          <span className="text-foreground font-semibold shrink-0 max-w-[140px] truncate">{e.userTag}</span>
                          <span className="text-muted-foreground">
                            {e.type === "move"
                              ? `${e.fromChannelName ?? e.fromChannelId} → ${e.channelName ?? e.channelId}`
                              : `# ${e.channelName ?? e.channelId}`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fiche Membre ──────────────────────────────────────────────────── */}
        <TabsContent value="member-profile" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base font-mono uppercase">👤 Fiche Complète d'un Membre</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="ID utilisateur Discord…" className="font-mono text-sm" />
                <Button onClick={fetchProfile} disabled={profileLoading || !profileId.trim()} className="gap-1.5 shrink-0">
                  {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Rechercher
                </Button>
              </div>
              {profileData && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border">
                    {profileData.avatarURL && <img src={profileData.avatarURL} className="h-14 w-14 rounded-full border border-border" alt="" />}
                    <div>
                      <p className="font-bold text-lg">{profileData.displayName ?? profileData.userTag ?? profileData.userId}</p>
                      <p className="text-sm text-muted-foreground font-mono">{profileData.userTag} · {profileData.userId}</p>
                      {profileData.joinedAt && <p className="text-xs text-muted-foreground">Rejoint : {new Date(profileData.joinedAt).toLocaleDateString("fr-FR")}</p>}
                      {profileData.timed_out_until && <Badge variant="destructive" className="mt-1">Timeout jusqu'au {new Date(profileData.timed_out_until).toLocaleString("fr-FR")}</Badge>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border p-3 text-center"><p className="text-2xl font-bold font-mono">{profileData.warns.length}</p><p className="text-xs text-muted-foreground uppercase">Warns</p></div>
                    <div className="rounded-lg border border-border p-3 text-center"><p className="text-2xl font-bold font-mono">{profileData.notes.length}</p><p className="text-xs text-muted-foreground uppercase">Notes</p></div>
                    <div className={`rounded-lg border p-3 text-center ${profileData.tempban ? "border-destructive bg-destructive/10" : "border-border"}`}><p className="text-xs text-muted-foreground uppercase">{profileData.tempban ? "🔨 Tempban Actif" : "Tempban"}</p>{profileData.tempban && <p className="text-xs font-mono mt-1">Exp : {new Date(profileData.tempban.expiresAt).toLocaleDateString("fr-FR")}</p>}</div>
                    <div className={`rounded-lg border p-3 text-center col-span-2 md:col-span-1 ${profileData.quarantine ? "border-yellow-500/50 bg-yellow-500/10" : "border-border"}`}><p className="text-xs text-muted-foreground uppercase">{profileData.quarantine ? "🔒 Quarantaine" : "Quarantaine"}</p>{profileData.quarantine && <p className="text-xs font-mono mt-1">{profileData.quarantine.reason}</p>}</div>
                  </div>
                  {profileData.roles.length > 0 && (
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Rôles</p>
                      <div className="flex flex-wrap gap-1">{profileData.roles.map(r => <Badge key={r.id} variant="outline" style={{ borderColor: r.color !== "#000000" ? r.color : undefined }} className="text-xs font-mono">{r.name}</Badge>)}</div>
                    </div>
                  )}
                  {profileData.warns.length > 0 && (
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Avertissements</p>
                      <div className="space-y-1">{profileData.warns.map(w => (
                        <div key={w.caseId} className="flex items-start gap-2 text-xs rounded bg-muted/30 px-3 py-2">
                          <span className="font-mono text-muted-foreground shrink-0">#{w.caseId}</span>
                          <span className="flex-1">{w.reason}</span>
                          <span className="text-muted-foreground shrink-0">{w.moderatorTag}</span>
                          <span className="text-muted-foreground shrink-0">{new Date(w.timestamp).toLocaleDateString("fr-FR")}</span>
                        </div>
                      ))}</div>
                    </div>
                  )}
                  {profileData.notes.length > 0 && (
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Notes</p>
                      <div className="space-y-1">{profileData.notes.map((n, i) => (
                        <div key={i} className="text-xs rounded bg-muted/30 px-3 py-2"><p>{n.content}</p><p className="text-muted-foreground mt-0.5">{n.moderator} · {new Date(n.timestamp).toLocaleDateString("fr-FR")}</p></div>
                      ))}</div>
                    </div>
                  )}
                  {profileData.voiceEvents.length > 0 && (
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Derniers événements vocaux</p>
                      <div className="space-y-0.5 font-mono text-xs max-h-40 overflow-y-auto">{profileData.voiceEvents.map((e, i) => (
                        <div key={i} className="flex gap-2 px-2 py-1 rounded hover:bg-muted/40">
                          <span className="text-muted-foreground shrink-0">{new Date(e.timestamp).toLocaleTimeString("fr-FR")}</span>
                          <span className="text-primary shrink-0">{e.type}</span>
                          <span className="text-muted-foreground">{e.channelName ?? e.channelId}</span>
                        </div>
                      ))}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Warns ─────────────────────────────────────────────────────────── */}
        <TabsContent value="warns" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base font-mono uppercase">⚠️ Gestion des Avertissements</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={warnsUserId} onChange={(e) => setWarnsUserId(e.target.value)} placeholder="ID utilisateur Discord…" className="font-mono text-sm" />
                <Button onClick={fetchWarns} disabled={warnsLoading || !warnsUserId.trim()} className="gap-1.5 shrink-0">
                  {warnsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Charger
                </Button>
              </div>
              {warnsData !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{warnsData.length} avertissement(s) pour {warnsUserId}</p>
                    {warnsData.length > 0 && (
                      <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={async () => {
                        const r = await apiFetch(`/api/owner/guilds/${guildId}/warns/${warnsUserId}`, { method: "DELETE" });
                        const d = await r.json() as { count?: number };
                        if (r.ok) { setWarnsData([]); toast({ title: `${d.count} warn(s) effacé(s) ✓` }); }
                      }}>
                        <Trash2 className="h-3.5 w-3.5" /> Tout effacer
                      </Button>
                    )}
                  </div>
                  {warnsData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucun avertissement.</p>
                  ) : (
                    <div className="space-y-1">{warnsData.map((w) => (
                      <div key={w.caseId} className="flex items-center gap-2 text-xs rounded bg-muted/30 px-3 py-2">
                        <span className="font-mono text-muted-foreground shrink-0">#{w.caseId}</span>
                        <span className="flex-1">{w.reason}</span>
                        <span className="text-muted-foreground shrink-0">{w.moderatorTag}</span>
                        <span className="text-muted-foreground shrink-0">{new Date(w.timestamp).toLocaleDateString("fr-FR")}</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={async () => {
                          const r = await apiFetch(`/api/owner/guilds/${guildId}/warns/${warnsUserId}/${w.caseId}`, { method: "DELETE" });
                          if (r.ok) { setWarnsData(prev => (prev ?? []).filter(x => x.caseId !== w.caseId)); toast({ title: `Warn #${w.caseId} supprimé` }); }
                        }}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tempbans ──────────────────────────────────────────────────────── */}
        <TabsContent value="tempbans" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">🔨 Bannissements Temporaires ({tempbans.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchTempbans} disabled={tempbansLoading} className="gap-1.5">
                  {tempbansLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tempbansLoading ? <Skeleton className="h-40 w-full" /> : tempbans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun tempban actif.</p>
              ) : (
                <div className="space-y-2">{tempbans.map((b) => (
                  <div key={b.userId} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm font-mono truncate">{b.userTag}</p>
                      <p className="text-xs text-muted-foreground">{b.reason} · par {b.moderatorTag}</p>
                      <p className="text-xs text-muted-foreground font-mono">Expire : {new Date(b.expiresAt).toLocaleString("fr-FR")}</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0 hover:bg-green-500/10 hover:border-green-500 hover:text-green-400" onClick={async () => {
                      const r = await apiFetch(`/api/owner/guilds/${guildId}/tempbans/${b.userId}`, { method: "DELETE" });
                      if (r.ok) { setTempbans(prev => prev.filter(x => x.userId !== b.userId)); toast({ title: "Tempban annulé ✓" }); }
                    }}>
                      <Unlock className="h-3.5 w-3.5" /> Annuler
                    </Button>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timeouts ──────────────────────────────────────────────────────── */}
        <TabsContent value="timeouts" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">⏱️ Timeouts Actifs ({timeouts.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchTimeouts} disabled={timeoutsLoading} className="gap-1.5">
                  {timeoutsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {timeoutsLoading ? <Skeleton className="h-40 w-full" /> : timeouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun membre en timeout.</p>
              ) : (
                <div className="space-y-2">{timeouts.map((t) => (
                  <div key={t.userId} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                    {t.avatarURL && <img src={t.avatarURL} className="h-8 w-8 rounded-full border border-border shrink-0" alt="" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm font-mono">{t.displayName} <span className="text-muted-foreground font-normal text-xs">({t.userTag})</span></p>
                      {t.until && <p className="text-xs text-muted-foreground font-mono">Jusqu'au : {new Date(t.until).toLocaleString("fr-FR")}</p>}
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0 hover:bg-green-500/10 hover:border-green-500 hover:text-green-400" onClick={async () => {
                      const r = await apiFetch(`/api/owner/guilds/${guildId}/timeouts/${t.userId}`, { method: "DELETE" });
                      if (r.ok) { setTimeouts(prev => prev.filter(x => x.userId !== t.userId)); toast({ title: "Timeout levé ✓" }); }
                      else { const d = await r.json() as { error?: string }; toast({ title: "Erreur", description: d.error, variant: "destructive" }); }
                    }}>
                      <Unlock className="h-3.5 w-3.5" /> Lever
                    </Button>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Maintenance ───────────────────────────────────────────────────── */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base font-mono uppercase">🔧 Mode Maintenance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {maintenanceLoading ? <Skeleton className="h-32 w-full" /> : !maintenanceState ? (
                <Button onClick={fetchMaintenance}>Charger</Button>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="font-semibold">Mode Maintenance</p>
                      <p className="text-sm text-muted-foreground">Bloque toutes les commandes (owner du serveur exclu)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={maintenanceState.active ? "destructive" : "secondary"}>{maintenanceState.active ? "ACTIF" : "INACTIF"}</Badge>
                      <Button size="sm" variant={maintenanceState.active ? "destructive" : "outline"} className="gap-1.5" onClick={async () => {
                        const r = await apiFetch(`/api/owner/guilds/${guildId}/maintenance`, { method: "PATCH", body: JSON.stringify({ active: !maintenanceState.active }) });
                        if (r.ok) { const d = await r.json() as { active: boolean; message: string }; setMaintenanceState(d); toast({ title: d.active ? "Maintenance activée 🔧" : "Maintenance désactivée ✓" }); }
                      }}>
                        <Pause className="h-3.5 w-3.5" /> {maintenanceState.active ? "Désactiver" : "Activer"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message affiché aux utilisateurs</label>
                    <Textarea value={maintenanceMsgDraft} onChange={(e) => setMaintenanceMsgDraft(e.target.value)} rows={3} className="font-mono text-sm resize-none" />
                    <Button size="sm" onClick={async () => {
                      const r = await apiFetch(`/api/owner/guilds/${guildId}/maintenance`, { method: "PATCH", body: JSON.stringify({ active: maintenanceState.active, message: maintenanceMsgDraft }) });
                      if (r.ok) { const d = await r.json() as { active: boolean; message: string }; setMaintenanceState(d); toast({ title: "Message mis à jour ✓" }); }
                    }}>Sauvegarder le message</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Masse-Action ──────────────────────────────────────────────────── */}
        <TabsContent value="mass-action" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base font-mono uppercase">⚡ Masse-Action par Rôle</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription className="text-sm">Action irréversible sur tous les membres ayant le rôle spécifié. Les bots et membres protégés sont ignorés.</AlertDescription></Alert>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">ID du Rôle cible</label><Input value={massRoleId} onChange={(e) => setMassRoleId(e.target.value)} placeholder="ID du rôle Discord…" className="font-mono text-sm" /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Action</label>
                  <Select value={massAction} onValueChange={(v) => setMassAction(v as typeof massAction)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kick">👢 Expulser</SelectItem>
                      <SelectItem value="ban">🔨 Bannir</SelectItem>
                      <SelectItem value="timeout">⏱️ Timeout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {massAction === "timeout" && <div className="space-y-2"><label className="text-sm font-medium">Durée (minutes)</label><Input type="number" min={1} value={massTimeoutMins} onChange={(e) => setMassTimeoutMins(Number(e.target.value))} className="font-mono text-sm" /></div>}
                <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Raison</label><Input value={massReason} onChange={(e) => setMassReason(e.target.value)} placeholder="Raison (optionnel)…" className="text-sm" /></div>
              </div>
              <Button variant="destructive" disabled={massLoading || !massRoleId.trim()} className="gap-1.5 w-full" onClick={async () => {
                if (!confirm(`Confirmer la masse-action "${massAction}" sur tous les membres du rôle ${massRoleId} ?`)) return;
                setMassLoading(true);
                try {
                  const r = await apiFetch(`/api/owner/guilds/${guildId}/mass-action`, { method: "POST", body: JSON.stringify({ action: massAction, roleId: massRoleId.trim(), reason: massReason, timeoutMinutes: massTimeoutMins }) });
                  const d = await r.json() as { count?: number; error?: string };
                  if (r.ok) toast({ title: `✓ ${d.count} membre(s) traité(s)` });
                  else toast({ title: "Erreur", description: d.error, variant: "destructive" });
                } finally { setMassLoading(false); }
              }}>
                {massLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Exécuter la masse-action
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Invitations ───────────────────────────────────────────────────── */}
        <TabsContent value="invitations" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">🔗 Invitations ({invites.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchInvites} disabled={invitesLoading} className="gap-1.5">
                  {invitesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-semibold">Générer une invitation</p>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">ID Salon (optionnel)</label><Input value={newInviteChannelId} onChange={(e) => setNewInviteChannelId(e.target.value)} placeholder="ID salon…" className="font-mono text-xs" /></div>
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">Durée (0=∞, en secondes)</label><Input type="number" min={0} value={newInviteMaxAge} onChange={(e) => setNewInviteMaxAge(Number(e.target.value))} className="font-mono text-xs" /></div>
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">Utilisations max (0=∞)</label><Input type="number" min={0} value={newInviteMaxUses} onChange={(e) => setNewInviteMaxUses(Number(e.target.value))} className="font-mono text-xs" /></div>
                </div>
                <Button size="sm" className="gap-1.5" onClick={async () => {
                  const r = await apiFetch(`/api/owner/guilds/${guildId}/invites/create`, { method: "POST", body: JSON.stringify({ channelId: newInviteChannelId || undefined, maxAge: newInviteMaxAge, maxUses: newInviteMaxUses, temporary: newInviteTemporary }) });
                  const d = await r.json() as { url?: string; error?: string };
                  if (r.ok && d.url) { navigator.clipboard.writeText(d.url).catch(() => null); toast({ title: "Invitation créée ✓", description: d.url }); fetchInvites(); }
                  else toast({ title: "Erreur", description: d.error, variant: "destructive" });
                }}><Plus className="h-4 w-4" /> Créer & Copier</Button>
              </div>
              {invitesLoading ? <Skeleton className="h-40 w-full" /> : invites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune invitation active.</p>
              ) : (
                <div className="space-y-1">{invites.map((inv) => (
                  <div key={inv.code} className="flex items-center gap-3 text-xs font-mono rounded bg-muted/20 px-3 py-2">
                    <span className="font-semibold text-primary w-20 shrink-0">{inv.code}</span>
                    <span className="text-muted-foreground shrink-0">{inv.uses ?? 0}/{inv.maxUses ?? "∞"}</span>
                    <span className="text-muted-foreground shrink-0 hidden md:block"># {inv.channelName ?? "?"}</span>
                    <span className="flex-1 text-muted-foreground hidden lg:block">{inv.creatorTag ?? "?"}</span>
                    <span className="text-muted-foreground shrink-0">{inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString("fr-FR") : "∞"}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 shrink-0" onClick={async () => {
                      const r = await apiFetch(`/api/owner/guilds/${guildId}/invites/${inv.code}`, { method: "DELETE" });
                      if (r.ok) { setInvites(prev => prev.filter(i => i.code !== inv.code)); toast({ title: "Invitation révoquée" }); }
                    }}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Audit Log ─────────────────────────────────────────────────────── */}
        <TabsContent value="audit-log" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">📋 Audit Log Discord</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchAuditLog} disabled={auditLoading} className="gap-1.5">
                  {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {auditLoading ? <Skeleton className="h-48 w-full" /> : auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune entrée d'audit.</p>
              ) : (
                <div className="space-y-1 max-h-[40rem] overflow-y-auto font-mono text-xs">
                  {auditLog.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted/40">
                      <span className="text-muted-foreground shrink-0 w-32">{new Date(e.createdAt).toLocaleString("fr-FR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{e.actionType.replace(/_/g, " ")}</Badge>
                      <span className="text-primary shrink-0">{e.executorTag ?? e.executorId ?? "?"}</span>
                      {e.targetId && <span className="text-muted-foreground">→ {e.targetId}</span>}
                      {e.reason && <span className="text-muted-foreground italic truncate">"{e.reason}"</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Log Channels ──────────────────────────────────────────────────── */}
        <TabsContent value="log-channels" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base font-mono uppercase">📡 Configuration des Salons de Logs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {logChannelsLoading ? <Skeleton className="h-48 w-full" /> : !logChannels ? (
                <Button onClick={fetchLogChannels}>Charger</Button>
              ) : (
                <>
                  {([
                    { key: "logChannelId" as const, label: "Salon de Logs Général", icon: "📝" },
                    { key: "banLogChannelId" as const, label: "Salon de Logs Bans", icon: "🔨" },
                    { key: "generalLogChannelId" as const, label: "Salon de Logs Serveur (vocal, salons, rôles…)", icon: "📊" },
                    { key: "inviteLogChannelId" as const, label: "Salon de Logs Invitations", icon: "🔗" },
                    { key: "messageLogChannelId" as const, label: "Salon de Logs Messages (éditions & suppressions)", icon: "✏️" },
                  ] as const).map(({ key, label, icon }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-sm font-medium">{icon} {label}</label>
                      <Input value={logChannelsDraft[key] ?? ""} onChange={(e) => setLogChannelsDraft(prev => ({ ...prev, [key]: e.target.value || null }))} placeholder="ID du salon Discord…" className="font-mono text-sm" />
                    </div>
                  ))}
                  <Button onClick={saveLogChannels} disabled={logChannelsSaving} className="gap-1.5 w-full">
                    {logChannelsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />} Sauvegarder les salons
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Config JSON ───────────────────────────────────────────────────── */}
        <TabsContent value="config-json" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base font-mono uppercase">📦 Import / Export de Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Exporter la configuration</p>
                <p className="text-xs text-muted-foreground">Télécharge un fichier JSON avec toute la config du serveur.</p>
                <Button variant="outline" disabled={configExportLoading} className="gap-1.5" onClick={async () => {
                  setConfigExportLoading(true);
                  try {
                    const token = getToken();
                    const r = await fetch(`/api/owner/guilds/${guildId}/config/export`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
                    if (!r.ok) { toast({ title: "Erreur export", variant: "destructive" }); return; }
                    const blob = await r.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `config-${guildId}.json`; a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "Config exportée ✓" });
                  } finally { setConfigExportLoading(false); }
                }}>
                  {configExportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Télécharger le JSON
                </Button>
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-sm font-semibold">Importer une configuration</p>
                <p className="text-xs text-muted-foreground">Coller le JSON d'une configuration précédemment exportée.</p>
                <Textarea value={configImportJson} onChange={(e) => setConfigImportJson(e.target.value)} rows={8} placeholder='{"guildId":"...","config":{...}}' className="font-mono text-xs resize-none" />
                <Button variant="outline" disabled={configImportLoading || !configImportJson.trim()} className="gap-1.5" onClick={async () => {
                  setConfigImportLoading(true);
                  try {
                    const parsed = JSON.parse(configImportJson);
                    const config = parsed.config ?? parsed;
                    const r = await apiFetch(`/api/owner/guilds/${guildId}/config/import`, { method: "POST", body: JSON.stringify({ config }) });
                    const d = await r.json() as { ok?: boolean; error?: string };
                    if (r.ok) { toast({ title: "Configuration importée ✓" }); setConfigImportJson(""); }
                    else toast({ title: "Erreur import", description: d.error, variant: "destructive" });
                  } catch { toast({ title: "JSON invalide", variant: "destructive" }); }
                  finally { setConfigImportLoading(false); }
                }}>
                  {configImportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Commandes Custom ──────────────────────────────────────────────── */}
        <TabsContent value="custom-cmds" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">⚙️ Commandes Personnalisées ({customCmds.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchCustomCmds} disabled={customCmdsLoading} className="gap-1.5">
                  {customCmdsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              <CardDescription className="font-mono text-xs">Les utilisateurs pourront taper <span className="text-primary">&amp;nom</span> pour obtenir la réponse configurée.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-semibold">Nouvelle commande</p>
                <div className="flex gap-2 items-center">
                  <span className="text-muted-foreground font-mono text-sm shrink-0">&amp;</span>
                  <Input value={ccNewName} onChange={(e) => setCcNewName(e.target.value.replace(/\s+/g, ""))} placeholder="nom" className="font-mono text-sm w-32" />
                  <span className="text-muted-foreground text-sm shrink-0">→</span>
                  <Input value={ccNewResponse} onChange={(e) => setCcNewResponse(e.target.value)} placeholder="Réponse du bot…" className="text-sm flex-1" />
                  <Button size="sm" disabled={customCmdSaving || !ccNewName.trim() || !ccNewResponse.trim()} onClick={addCustomCmd} className="gap-1.5 shrink-0">
                    {customCmdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {customCmdsLoading ? <Skeleton className="h-32 w-full" /> : customCmds.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune commande personnalisée.</p>
              ) : (
                <div className="space-y-1">{customCmds.map((cmd) => (
                  <div key={cmd.name} className="flex items-center gap-3 rounded bg-muted/20 px-3 py-2 text-sm">
                    <span className="font-mono text-primary font-bold shrink-0">&amp;{cmd.name}</span>
                    <span className="flex-1 truncate text-muted-foreground">{cmd.response}</span>
                    <span className="text-xs text-muted-foreground shrink-0 hidden md:block">{cmd.createdBy}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => deleteCustomCmd(cmd.name)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Mots Globaux ──────────────────────────────────────────────────── */}
        <TabsContent value="word-bl" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono uppercase">🌍 Blacklist de Mots Globale ({wordBl.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchWordBl} disabled={wordBlLoading} className="gap-1.5">
                  {wordBlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              <CardDescription className="text-xs">Mots bloqués sur <strong>tous</strong> les serveurs gérés par le bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="Ajouter un mot…" className="font-mono text-sm" onKeyDown={(e) => e.key === "Enter" && addWord()} />
                <Button onClick={addWord} disabled={wordBlSaving || !newWord.trim()} className="gap-1.5 shrink-0">
                  {wordBlSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
                </Button>
              </div>
              {wordBlLoading ? <Skeleton className="h-32 w-full" /> : wordBl.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun mot dans la blacklist globale.</p>
              ) : (
                <div className="flex flex-wrap gap-2">{wordBl.map((w) => (
                  <Badge key={w} variant="secondary" className="gap-1.5 font-mono text-sm pr-1">
                    {w}
                    <button onClick={() => removeWord(w)} className="ml-1 hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Recherche Globale ─────────────────────────────────────────────── */}
        <TabsContent value="global-search" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base font-mono uppercase">🔍 Recherche Globale d'un Utilisateur</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="ID utilisateur Discord…" className="font-mono text-sm" onKeyDown={(e) => e.key === "Enter" && doGlobalSearch()} />
                <Button onClick={doGlobalSearch} disabled={searchLoading || !searchId.trim()} className="gap-1.5 shrink-0">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCode className="h-4 w-4" />} Rechercher
                </Button>
              </div>
              {searchResults !== null && (
                searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Utilisateur introuvable sur tous les serveurs.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Présent sur <strong>{searchResults.length}</strong> serveur(s)</p>
                    {searchResults.map((r) => (
                      <div key={r.guildId} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                        <div className="flex items-center gap-3">
                          {r.avatarURL && <img src={r.avatarURL} className="h-10 w-10 rounded-full border border-border shrink-0" alt="" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{r.displayName} <span className="text-muted-foreground font-normal text-xs">({r.userTag})</span></p>
                            <p className="text-xs text-muted-foreground font-mono">{r.guildName}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {r.timedOut && <Badge variant="destructive" className="text-xs">Timeout</Badge>}
                            {r.warnCount > 0 && <Badge variant="secondary" className="text-xs font-mono">{r.warnCount} warn(s)</Badge>}
                          </div>
                        </div>
                        {r.roles.length > 0 && (
                          <div className="flex flex-wrap gap-1">{r.roles.slice(0, 8).map(role => <Badge key={role.id} variant="outline" className="text-xs font-mono">{role.name}</Badge>)}</div>
                        )}
                        {r.joinedAt && <p className="text-xs text-muted-foreground">Rejoint le {new Date(r.joinedAt).toLocaleDateString("fr-FR")}</p>}
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs Bot (bot_reply) ──────────────────────────────────────────── */}
        <TabsContent value="bot-reply-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-mono uppercase">💬 Réponses du Bot ({botReplyLogs.length})</CardTitle>
                  <CardDescription>Messages d'erreur ou d'information envoyés aux utilisateurs lors de l'exécution des commandes.</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={botReplyFilter}
                    onChange={(e) => setBotReplyFilter(e.target.value as typeof botReplyFilter)}
                    className="border border-border rounded px-2 py-1 text-xs bg-background"
                  >
                    <option value="all">Tous</option>
                    <option value="error">Erreurs</option>
                    <option value="warn">Avertissements</option>
                    <option value="info">Info</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={fetchBotReplyLogs} disabled={botReplyLoading} className="gap-1.5 shrink-0">
                    {botReplyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Actualiser
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {botReplyLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : botReplyLogs.filter((l) => botReplyFilter === "all" || l.level === botReplyFilter).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Aucun log de réponse pour ce filtre.</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {botReplyLogs
                    .filter((l) => botReplyFilter === "all" || l.level === botReplyFilter)
                    .map((l) => {
                      const lvl = l.level ?? (l.errCode as typeof l.level) ?? "info";
                      const text = l.replyText ?? l.errMessage ?? "";
                      const badgeClass = lvl === "error"
                        ? "bg-red-500/15 text-red-600 border-red-300"
                        : lvl === "warn"
                          ? "bg-yellow-500/15 text-yellow-600 border-yellow-300"
                          : "bg-blue-500/15 text-blue-600 border-blue-300";
                      const icon = lvl === "error" ? "🔴" : lvl === "warn" ? "🟡" : "🔵";
                      return (
                        <div key={l.id} className="flex items-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                          <span className="shrink-0 mt-0.5 text-sm">{icon}</span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] font-mono uppercase px-1.5 py-0 ${badgeClass}`}>{lvl}</Badge>
                              {l.command && <span className="font-mono text-xs text-muted-foreground">/{l.command}</span>}
                              {l.userTag && <span className="text-xs text-muted-foreground truncate">par {l.userTag}</span>}
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">{new Date(l.timestamp).toLocaleString("fr-FR")}</span>
                            </div>
                            <p className="text-sm break-words">{text}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COMMANDES USERS ─────────────────────────────────────────────── */}
        <TabsContent value="usercommands" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                <MessageSquareWarning className="h-4 w-4 text-indigo-500" />
                Commandes Utilisateurs
              </CardTitle>
              <CardDescription>Historique des demandes de rôle et suggestions reçues.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-1">
                  {(["all", "rolerequest", "suggestion"] as const).map((t) => (
                    <Button key={t} size="sm" variant={ucTypeFilter === t ? "default" : "outline"} className="text-xs h-7"
                      onClick={() => setUcTypeFilter(t)}>
                      {t === "all" ? "Tout" : t === "rolerequest" ? "📋 Demandes rôle" : "💡 Suggestions"}
                    </Button>
                  ))}
                </div>
                <Input placeholder="Rechercher un utilisateur…" value={ucSearch} onChange={(e) => setUcSearch(e.target.value)} className="h-7 text-xs max-w-48" />
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={fetchUserCmds} disabled={ucLoading}>
                  {ucLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "↺"} Rafraîchir
                </Button>
              </div>

              {ucLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : userCmds.filter((c) =>
                (ucTypeFilter === "all" || c.type === ucTypeFilter) &&
                (!ucSearch || c.userTag.toLowerCase().includes(ucSearch.toLowerCase()) || c.userId.includes(ucSearch))
              ).length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">Aucune commande utilisateur enregistrée.</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {userCmds
                    .filter((c) =>
                      (ucTypeFilter === "all" || c.type === ucTypeFilter) &&
                      (!ucSearch || c.userTag.toLowerCase().includes(ucSearch.toLowerCase()) || c.userId.includes(ucSearch))
                    )
                    .map((c) => {
                      const isRoleReq = c.type === "rolerequest";
                      const d = c.data;
                      return (
                        <div key={c.id} className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] font-mono uppercase px-1.5 py-0 ${isRoleReq ? "bg-indigo-500/10 text-indigo-500 border-indigo-300" : "bg-amber-500/10 text-amber-600 border-amber-300"}`}>
                              {isRoleReq ? "📋 rôle" : "💡 suggestion"}
                            </Badge>
                            <span className="text-xs font-medium">{c.userTag}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{c.userId}</span>
                            {c.guildName && <Badge variant="secondary" className="text-[10px]">{c.guildName}</Badge>}
                            <span className="text-xs text-muted-foreground ml-auto">{new Date(c.createdAt).toLocaleString("fr-FR")}</span>
                          </div>
                          {isRoleReq ? (
                            <div className="text-xs space-y-0.5">
                              <p><span className="text-muted-foreground">Rôle demandé :</span> <span className="font-medium">{String(d.roleName ?? "")}</span></p>
                              <p><span className="text-muted-foreground">Raison :</span> {String(d.reason ?? "")}</p>
                              <p className="text-muted-foreground">Via : {String(d.via ?? "")}</p>
                            </div>
                          ) : (
                            <div className="text-xs space-y-0.5">
                              <p><span className="text-muted-foreground">Catégorie :</span> {String(d.categorie ?? "")}</p>
                              <p className="break-words">{String(d.texte ?? "")}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COMPTES SUSPECTS ────────────────────────────────────────────── */}
        <TabsContent value="suspectaccounts" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono uppercase flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-500" />
                Comptes Suspects
              </CardTitle>
              <CardDescription>
                Historique des comptes signalés comme suspects à l'arrivée sur les serveurs. Actions rapides disponibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={fetchSuspectAccounts} disabled={saLoading}>
                  {saLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "↺"} Rafraîchir
                </Button>
                <span className="text-xs text-muted-foreground">{suspectAccounts.length} entrée(s)</span>
              </div>

              <div className="rounded-md border border-orange-200 bg-orange-500/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
                ⚠️ Les actions rapides agissent <strong>immédiatement</strong> sur le membre dans son serveur d'origine. Assure-toi que le bot y est toujours présent.
              </div>

              {saLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : suspectAccounts.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">Aucun compte suspect enregistré. Les comptes suspects sont détectés à l'arrivée (niveau sécurité ≥ 2 ou détection activée).</p>
              ) : (
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                  {suspectAccounts.map((sa) => (
                    <div key={sa.id} className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-mono uppercase px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-300">
                          🕵️ suspect
                        </Badge>
                        <span className="text-xs font-medium">{sa.userTag}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{sa.userId}</span>
                        <Badge variant="secondary" className="text-[10px]">{sa.guildName || sa.guildId}</Badge>
                        <Badge variant="outline" className="text-[10px]">Niv. sécu {sa.securityLevel}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">{new Date(sa.detectedAt).toLocaleString("fr-FR")}</span>
                      </div>
                      <div className="text-xs space-y-0.5">
                        <p><span className="text-muted-foreground">Âge du compte :</span> <span className="font-medium">{sa.accountAgeDays < 1 ? "< 1 jour" : `${sa.accountAgeDays} jour(s)`}</span></p>
                        {sa.hasNoAvatar && <p className="text-amber-600">• Aucune photo de profil</p>}
                        {sa.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sa.reasons.map((r, i) => <Badge key={i} variant="secondary" className="text-[9px] font-normal">{r}</Badge>)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                          disabled={saActionLoading === sa.id}
                          onClick={() => doSuspectAction(sa, "timeout")}>
                          {saActionLoading === sa.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Clock className="h-2.5 w-2.5" />}
                          Timeout 24h
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                          disabled={saActionLoading === sa.id}
                          onClick={() => doSuspectAction(sa, "kick")}>
                          {saActionLoading === sa.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <UserX className="h-2.5 w-2.5" />}
                          Expulser
                        </Button>
                        <Button size="sm" variant="destructive" className="h-6 text-[10px] gap-1"
                          disabled={saActionLoading === sa.id}
                          onClick={() => { if (confirm(`Bannir ${sa.userTag} de ${sa.guildName} ?`)) doSuspectAction(sa, "ban"); }}>
                          {saActionLoading === sa.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Ban className="h-2.5 w-2.5" />}
                          Bannir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
