import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface GuildConfig {
  logChannelId: string | null;
  banLogChannelId: string | null;
  generalLogChannelId: string | null;
  raidMode: boolean;
  raidMode2: boolean;
  joinLock: boolean;
  ticketStaffRoleId: string | null;
  ticketCategoryId: string | null;
  transcriptChannelId: string | null;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  leaveEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string;
  captchaEnabled: boolean;
  captchaChannelId: string | null;
  captchaUnverifiedRoleId: string | null;
  captchaVerifiedRoleId: string | null;
  sanctionDmEnabled: boolean;
  inviteLogChannelId: string | null;
  messageLogChannelId: string | null;
  securityLevel: 1 | 2 | 3;
  antiInsultEnabled: boolean;
  antiInsultWords: string[];
  antiWebhookEnabled: boolean;
  suspiciousCheckEnabled: boolean;
  whitelistedInviteCodes: string[];
  vpnCheckEnabled: boolean;
  vpnCheckMinAgeDays: number;
  vpnCheckAction: "kick" | "ban" | "flag";
  vpnCheckRequireNoAvatar: boolean;
  antiRaiderEnabled: boolean;
  antiRaiderThreshold: number;
  antiRaiderWindow: number;
  antiRaiderAction: "kick" | "timeout";
  antiMoveEnabled: boolean;
  antiMuteEnabled: boolean;
  antiDisconnectEnabled: boolean;
  antiBotEnabled: boolean;
  antiEveryoneEnabled: boolean;
  antiEveryoneTimeoutSecs: number;
  suspectKeywords: string[];
  blServers: string[];
  blTags: string[];
}

export const DEFAULT_WELCOME_MSG = "👋 Bienvenue {user} sur **{server}** ! Tu es le **{count}**e membre. 🎉";
export const DEFAULT_LEAVE_MSG = "👋 **{username}** a quitté le serveur. Il reste **{count}** membres.";

function defaults(): GuildConfig {
  return {
    logChannelId: null,
    banLogChannelId: null,
    generalLogChannelId: null,
    raidMode: false,
    raidMode2: false,
    joinLock: false,
    ticketStaffRoleId: null,
    ticketCategoryId: null,
    transcriptChannelId: null,
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: DEFAULT_WELCOME_MSG,
    leaveEnabled: false,
    leaveChannelId: null,
    leaveMessage: DEFAULT_LEAVE_MSG,
    captchaEnabled: false,
    captchaChannelId: null,
    captchaUnverifiedRoleId: null,
    captchaVerifiedRoleId: null,
    sanctionDmEnabled: true,
    inviteLogChannelId: null,
    messageLogChannelId: null,
    securityLevel: 1,
    antiInsultEnabled: false,
    antiInsultWords: [],
    antiWebhookEnabled: false,
    suspiciousCheckEnabled: false,
    whitelistedInviteCodes: [],
    vpnCheckEnabled: false,
    vpnCheckMinAgeDays: 30,
    vpnCheckAction: "kick",
    vpnCheckRequireNoAvatar: false,
    antiRaiderEnabled: false,
    antiRaiderThreshold: 5,
    antiRaiderWindow: 10,
    antiRaiderAction: "timeout",
    antiMoveEnabled: false,
    antiMuteEnabled: false,
    antiDisconnectEnabled: false,
    antiBotEnabled: false,
    antiEveryoneEnabled: false,
    antiEveryoneTimeoutSecs: 300,
    suspectKeywords: [],
    blServers: [],
    blTags: [],
  };
}

const DATA_DIR = join(process.cwd(), "data");
const CONFIG_FILE = join(DATA_DIR, "guild-configs.json");

const configs = new Map<string, GuildConfig>();

function saveToDisk(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const obj: Record<string, GuildConfig> = {};
    configs.forEach((v, k) => { obj[k] = v; });
    writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (err) {
    console.error("[guild-config-store] Impossible de sauvegarder :", err);
  }
}

function loadFromDisk(): void {
  try {
    if (!existsSync(CONFIG_FILE)) return;
    const raw = readFileSync(CONFIG_FILE, "utf8");
    const obj = JSON.parse(raw) as Record<string, Partial<GuildConfig>>;
    Object.entries(obj).forEach(([guildId, partial]) => {
      configs.set(guildId, { ...defaults(), ...partial });
    });
  } catch (err) {
    console.error("[guild-config-store] Impossible de charger :", err);
  }
}

loadFromDisk();

function getOrCreate(guildId: string): GuildConfig {
  if (!configs.has(guildId)) configs.set(guildId, defaults());
  return configs.get(guildId)!;
}

export function getConfig(guildId: string): GuildConfig {
  return configs.get(guildId) ?? defaults();
}

function set(guildId: string, patch: Partial<GuildConfig>): void {
  configs.set(guildId, { ...getOrCreate(guildId), ...patch });
  saveToDisk();
}

export function setConfig(guildId: string, patch: Partial<GuildConfig>): void {
  set(guildId, patch);
}

export function setLogChannel(guildId: string, channelId: string): void { set(guildId, { logChannelId: channelId }); }
export function setBanLogChannel(guildId: string, channelId: string): void { set(guildId, { banLogChannelId: channelId }); }
export function setGeneralLogChannel(guildId: string, channelId: string | null): void { set(guildId, { generalLogChannelId: channelId }); }
export function setRaidMode(guildId: string, enabled: boolean): void { set(guildId, { raidMode: enabled }); }
export function isRaidMode(guildId: string): boolean { return configs.get(guildId)?.raidMode ?? false; }
export function setRaidMode2(guildId: string, enabled: boolean): void { set(guildId, { raidMode2: enabled }); }
export function isRaidMode2(guildId: string): boolean { return configs.get(guildId)?.raidMode2 ?? false; }
export function setJoinLock(guildId: string, enabled: boolean): void { set(guildId, { joinLock: enabled }); }
export function isJoinLocked(guildId: string): boolean { return configs.get(guildId)?.joinLock ?? false; }
export function setTicketStaffRole(guildId: string, roleId: string): void { set(guildId, { ticketStaffRoleId: roleId }); }
export function setTicketCategory(guildId: string, categoryId: string): void { set(guildId, { ticketCategoryId: categoryId }); }
export function setTranscriptChannel(guildId: string, channelId: string): void { set(guildId, { transcriptChannelId: channelId }); }
export function setWelcomeEnabled(guildId: string, enabled: boolean): void { set(guildId, { welcomeEnabled: enabled }); }
export function setWelcomeChannel(guildId: string, channelId: string): void { set(guildId, { welcomeChannelId: channelId }); }
export function setWelcomeMessage(guildId: string, message: string): void { set(guildId, { welcomeMessage: message }); }
export function setLeaveEnabled(guildId: string, enabled: boolean): void { set(guildId, { leaveEnabled: enabled }); }
export function setLeaveChannel(guildId: string, channelId: string): void { set(guildId, { leaveChannelId: channelId }); }
export function setLeaveMessage(guildId: string, message: string): void { set(guildId, { leaveMessage: message }); }
export function setCaptchaEnabled(guildId: string, enabled: boolean): void { set(guildId, { captchaEnabled: enabled }); }
export function setCaptchaChannel(guildId: string, channelId: string | null): void { set(guildId, { captchaChannelId: channelId }); }
export function setCaptchaUnverifiedRole(guildId: string, roleId: string | null): void { set(guildId, { captchaUnverifiedRoleId: roleId }); }
export function setCaptchaVerifiedRole(guildId: string, roleId: string | null): void { set(guildId, { captchaVerifiedRoleId: roleId }); }
export function setSanctionDmEnabled(guildId: string, enabled: boolean): void { set(guildId, { sanctionDmEnabled: enabled }); }
export function setInviteLogChannel(guildId: string, channelId: string | null): void { set(guildId, { inviteLogChannelId: channelId }); }
export function setMessageLogChannel(guildId: string, channelId: string | null): void { set(guildId, { messageLogChannelId: channelId }); }

export function setSecurityLevel(guildId: string, level: 1 | 2 | 3): void { set(guildId, { securityLevel: level }); }
export function getSecurityLevel(guildId: string): 1 | 2 | 3 { return configs.get(guildId)?.securityLevel ?? 1; }

export function setAntiInsultEnabled(guildId: string, enabled: boolean): void { set(guildId, { antiInsultEnabled: enabled }); }
export function setAntiInsultWords(guildId: string, words: string[]): void { set(guildId, { antiInsultWords: words }); }

export function addAntiInsultWord(guildId: string, word: string): void {
  const cfg = getOrCreate(guildId);
  const words = [...cfg.antiInsultWords, word.toLowerCase()].filter((v, i, a) => a.indexOf(v) === i);
  set(guildId, { antiInsultWords: words });
}

export function removeAntiInsultWord(guildId: string, word: string): boolean {
  const cfg = getOrCreate(guildId);
  const words = cfg.antiInsultWords.filter((w) => w !== word.toLowerCase());
  const removed = words.length < cfg.antiInsultWords.length;
  set(guildId, { antiInsultWords: words });
  return removed;
}

export function setAntiWebhookEnabled(guildId: string, enabled: boolean): void { set(guildId, { antiWebhookEnabled: enabled }); }
export function setSuspiciousCheckEnabled(guildId: string, enabled: boolean): void { set(guildId, { suspiciousCheckEnabled: enabled }); }

export function setAntiRaiderConfig(guildId: string, patch: Partial<Pick<GuildConfig, "antiRaiderEnabled" | "antiRaiderThreshold" | "antiRaiderWindow" | "antiRaiderAction">>): void { set(guildId, patch); }
export function setAntiMoveEnabled(guildId: string, v: boolean): void { set(guildId, { antiMoveEnabled: v }); }
export function setAntiMuteEnabled(guildId: string, v: boolean): void { set(guildId, { antiMuteEnabled: v }); }
export function setAntiDisconnectEnabled(guildId: string, v: boolean): void { set(guildId, { antiDisconnectEnabled: v }); }
export function setAntiBotEnabled(guildId: string, v: boolean): void { set(guildId, { antiBotEnabled: v }); }

export function setAntiEveryoneEnabled(guildId: string, v: boolean): void { set(guildId, { antiEveryoneEnabled: v }); }
export function setAntiEveryoneTimeoutSecs(guildId: string, secs: number): void { set(guildId, { antiEveryoneTimeoutSecs: secs }); }

export function getSuspectKeywords(guildId: string): string[] { return getConfig(guildId).suspectKeywords ?? []; }
export function addSuspectKeyword(guildId: string, word: string): void {
  const cfg = getOrCreate(guildId);
  const words = [...cfg.suspectKeywords, word.toLowerCase()].filter((v, i, a) => a.indexOf(v) === i);
  set(guildId, { suspectKeywords: words });
}
export function removeSuspectKeyword(guildId: string, word: string): boolean {
  const cfg = getOrCreate(guildId);
  const words = cfg.suspectKeywords.filter((w) => w !== word.toLowerCase());
  const removed = words.length < cfg.suspectKeywords.length;
  set(guildId, { suspectKeywords: words });
  return removed;
}

export function getBlServers(guildId: string): string[] { return getConfig(guildId).blServers ?? []; }
export function addBlServer(guildId: string, serverId: string): void {
  const cfg = getOrCreate(guildId);
  const list = [...(cfg.blServers ?? []), serverId].filter((v, i, a) => a.indexOf(v) === i);
  set(guildId, { blServers: list });
}
export function removeBlServer(guildId: string, serverId: string): boolean {
  const cfg = getOrCreate(guildId);
  const list = (cfg.blServers ?? []).filter((s) => s !== serverId);
  const removed = list.length < (cfg.blServers ?? []).length;
  set(guildId, { blServers: list });
  return removed;
}

export function getBlTags(guildId: string): string[] { return getConfig(guildId).blTags ?? []; }
export function addBlTag(guildId: string, tag: string): void {
  const cfg = getOrCreate(guildId);
  const list = [...(cfg.blTags ?? []), tag.toLowerCase()].filter((v, i, a) => a.indexOf(v) === i);
  set(guildId, { blTags: list });
}
export function removeBlTag(guildId: string, tag: string): boolean {
  const cfg = getOrCreate(guildId);
  const list = (cfg.blTags ?? []).filter((t) => t !== tag.toLowerCase());
  const removed = list.length < (cfg.blTags ?? []).length;
  set(guildId, { blTags: list });
  return removed;
}

export function addWhitelistedInvite(guildId: string, code: string): void {
  const cfg = getOrCreate(guildId);
  const codes = [...cfg.whitelistedInviteCodes, code].filter((v, i, a) => a.indexOf(v) === i);
  set(guildId, { whitelistedInviteCodes: codes });
}

export function removeWhitelistedInvite(guildId: string, code: string): boolean {
  const cfg = getOrCreate(guildId);
  const codes = cfg.whitelistedInviteCodes.filter((c) => c !== code);
  const removed = codes.length < cfg.whitelistedInviteCodes.length;
  set(guildId, { whitelistedInviteCodes: codes });
  return removed;
}
