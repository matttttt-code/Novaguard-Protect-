import { kvSave, kvLoad } from "./kv-db.js";

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
  antiRoleModifyEnabled: boolean;
  antiAuditBypassPerms: boolean;
  suspectKeywords: string[];
  blServers: string[];
  blTags: string[];
  autoRoleId: string | null;
  antiSpamEnabled: boolean;
  antiSpamMessages: number;
  antiSpamWindowSecs: number;
  antiSpamAction: "timeout" | "kick" | "ban";
  antiSpamTimeoutMins: number;
  // ── IA Mod ───────────────────────────────────────────────────────────────
  aiToxicityEnabled: boolean;
  aiToxicityThreshold: number;
  aiToxicityAction: "warn" | "timeout" | "kick";
  aiAutoPunishEnabled: boolean;
  aiAutoLockEnabled: boolean;
  aiRaidPredictEnabled: boolean;
  aiRaidPredictJoins: number;
  aiRaidPredictMinAge: number;
  ticketLogChannelId: string | null;
  // ── Voice Mod ─────────────────────────────────────────────────────────────
  voiceModEnabled: boolean;
  voiceModAction: "warn" | "mute" | "timeout";
  voiceModVolumeThreshold: number;
  voiceModLogChannelId: string | null;
  voiceModSttEnabled: boolean;
  // ── Commandes utilisateurs ────────────────────────────────────────────────
  supportChannelId: string | null;
  supportPingRoleIds: string[];
  roleRequestChannelId: string | null;
  roleRequestPingRoleIds: string[];
  supportLogChannelId: string | null;
  whitelistedRoleIds: string[];
  antiCapsEnabled: boolean;
  whitelistedMemberIds: string[];
  // ── Rôles Notifications ───────────────────────────────────────────────────
  notifRoles: { roleId: string; label: string; emoji: string }[];
  notifPanelChannelId: string | null;
  // ── Tiers d'Activité ─────────────────────────────────────────────────────
  activityTiersEnabled: boolean;
  activityTierPeriodDays: number;
  activityTiers: { name: string; minMessages: number; minVoiceMinutes: number; roleId: string | null }[];
}

export const DEFAULT_WELCOME_MSG = "👋 Bienvenue {user} sur **{server}** ! Tu es le **{count}**e membre. 🎉";
export const DEFAULT_LEAVE_MSG = "👋 **{username}** a quitté le serveur. Il reste **{count}** membres.";

function defaults(): GuildConfig {
  return {
    logChannelId: null, banLogChannelId: null, generalLogChannelId: null,
    raidMode: false, raidMode2: false, joinLock: false,
    ticketStaffRoleId: null, ticketCategoryId: null, transcriptChannelId: null, ticketLogChannelId: null,
    welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: DEFAULT_WELCOME_MSG,
    leaveEnabled: false, leaveChannelId: null, leaveMessage: DEFAULT_LEAVE_MSG,
    captchaEnabled: false, captchaChannelId: null, captchaUnverifiedRoleId: null, captchaVerifiedRoleId: null,
    sanctionDmEnabled: true, inviteLogChannelId: null, messageLogChannelId: null,
    securityLevel: 1, antiInsultEnabled: false, antiInsultWords: [], antiWebhookEnabled: false,
    suspiciousCheckEnabled: false, whitelistedInviteCodes: [], vpnCheckEnabled: false,
    vpnCheckMinAgeDays: 30, vpnCheckAction: "kick", vpnCheckRequireNoAvatar: false,
    antiRaiderEnabled: false, antiRaiderThreshold: 5, antiRaiderWindow: 10, antiRaiderAction: "timeout",
    antiMoveEnabled: false, antiMuteEnabled: false, antiDisconnectEnabled: false,
    antiBotEnabled: false, antiEveryoneEnabled: false, antiEveryoneTimeoutSecs: 3600,
    antiRoleModifyEnabled: false,
    antiAuditBypassPerms: true,
    suspectKeywords: [], blServers: [], blTags: [], autoRoleId: null,
    antiSpamEnabled: false, antiSpamMessages: 5, antiSpamWindowSecs: 5,
    antiSpamAction: "timeout", antiSpamTimeoutMins: 10, antiCapsEnabled: false,
    aiToxicityEnabled: false, aiToxicityThreshold: 70, aiToxicityAction: "warn",
    aiAutoPunishEnabled: false, aiAutoLockEnabled: false,
    aiRaidPredictEnabled: false, aiRaidPredictJoins: 5, aiRaidPredictMinAge: 7,
    voiceModEnabled: false, voiceModAction: "warn", voiceModVolumeThreshold: 8000, voiceModLogChannelId: null, voiceModSttEnabled: false,
    supportChannelId: null, supportPingRoleIds: [],
    roleRequestChannelId: null, roleRequestPingRoleIds: [],
    supportLogChannelId: null,
    whitelistedRoleIds: [],
    whitelistedMemberIds: [],
    notifRoles: [],
    notifPanelChannelId: null,
    activityTiersEnabled: false,
    activityTierPeriodDays: 30,
    activityTiers: [],
  };
}

const configs = new Map<string, GuildConfig>();
const KV_KEY = "guild-configs";

export async function initGuildConfigStore(): Promise<void> {
  const saved = await kvLoad<Record<string, Partial<GuildConfig>>>(KV_KEY);
  if (saved) {
    Object.entries(saved).forEach(([guildId, partial]) => {
      configs.set(guildId, { ...defaults(), ...partial });
    });
  }
}

function persist(): void {
  const obj: Record<string, GuildConfig> = {};
  configs.forEach((v, k) => { obj[k] = v; });
  kvSave(KV_KEY, obj);
}

function getOrCreate(guildId: string): GuildConfig {
  if (!configs.has(guildId)) configs.set(guildId, defaults());
  return configs.get(guildId)!;
}

export function getConfig(guildId: string): GuildConfig {
  return configs.get(guildId) ?? defaults();
}

function set(guildId: string, patch: Partial<GuildConfig>): void {
  configs.set(guildId, { ...getOrCreate(guildId), ...patch });
  persist();
}

export function setConfig(guildId: string, patch: Partial<GuildConfig>): void { set(guildId, patch); }
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
export function setTicketLogChannel(guildId: string, channelId: string): void { set(guildId, { ticketLogChannelId: channelId }); }
export function setVoiceMod(guildId: string, patch: Partial<Pick<GuildConfig, "voiceModEnabled" | "voiceModAction" | "voiceModVolumeThreshold" | "voiceModLogChannelId" | "voiceModSttEnabled">>): void { set(guildId, patch); }
export function setWelcomeEnabled(guildId: string, enabled: boolean): void { set(guildId, { welcomeEnabled: enabled }); }
export function setWelcomeChannel(guildId: string, channelId: string): void { set(guildId, { welcomeChannelId: channelId }); }
export function setWelcomeMessage(guildId: string, message: string): void { set(guildId, { welcomeMessage: message }); }
export function setLeaveEnabled(guildId: string, enabled: boolean): void { set(guildId, { leaveEnabled: enabled }); }
export function setLeaveChannel(guildId: string, channelId: string): void { set(guildId, { leaveChannelId: channelId }); }
export function setLeaveMessage(guildId: string, message: string): void { set(guildId, { leaveMessage: message }); }
export function setCaptchaEnabled(guildId: string, enabled: boolean): void { set(guildId, { captchaEnabled: enabled }); }
export function setSanctionDm(guildId: string, enabled: boolean): void { set(guildId, { sanctionDmEnabled: enabled }); }
export function setInviteLogChannel(guildId: string, channelId: string | null): void { set(guildId, { inviteLogChannelId: channelId }); }
export function setMessageLogChannel(guildId: string, channelId: string | null): void { set(guildId, { messageLogChannelId: channelId }); }
export function setSecurityLevel(guildId: string, level: 1 | 2 | 3): void { set(guildId, { securityLevel: level }); }
export function setAntiInsult(guildId: string, enabled: boolean, words?: string[]): void {
  const patch: Partial<GuildConfig> = { antiInsultEnabled: enabled };
  if (words !== undefined) patch.antiInsultWords = words;
  set(guildId, patch);
}
export function setAntiWebhook(guildId: string, enabled: boolean): void { set(guildId, { antiWebhookEnabled: enabled }); }
export function setSuspiciousCheck(guildId: string, enabled: boolean): void { set(guildId, { suspiciousCheckEnabled: enabled }); }
export function setVpnCheck(guildId: string, patch: Partial<Pick<GuildConfig, "vpnCheckEnabled"|"vpnCheckMinAgeDays"|"vpnCheckAction"|"vpnCheckRequireNoAvatar">>): void { set(guildId, patch); }
export function setAntiRaider(guildId: string, patch: Partial<Pick<GuildConfig, "antiRaiderEnabled"|"antiRaiderThreshold"|"antiRaiderWindow"|"antiRaiderAction">>): void { set(guildId, patch); }
export function setAntiMove(guildId: string, enabled: boolean): void { set(guildId, { antiMoveEnabled: enabled }); }
export function setAntiMute(guildId: string, enabled: boolean): void { set(guildId, { antiMuteEnabled: enabled }); }
export function setAntiDisconnect(guildId: string, enabled: boolean): void { set(guildId, { antiDisconnectEnabled: enabled }); }
export function setAntiBot(guildId: string, enabled: boolean): void { set(guildId, { antiBotEnabled: enabled }); }
export function setAntiEveryone(guildId: string, enabled: boolean, timeoutSecs?: number): void {
  const patch: Partial<GuildConfig> = { antiEveryoneEnabled: enabled };
  if (timeoutSecs !== undefined) patch.antiEveryoneTimeoutSecs = timeoutSecs;
  set(guildId, patch);
}
// Captcha setters accept null to clear the value
export function setCaptchaChannel(guildId: string, channelId: string | null): void { set(guildId, { captchaChannelId: channelId }); }
export function setCaptchaUnverifiedRole(guildId: string, roleId: string | null): void { set(guildId, { captchaUnverifiedRoleId: roleId }); }
export function setCaptchaVerifiedRole(guildId: string, roleId: string | null): void { set(guildId, { captchaVerifiedRoleId: roleId }); }

// Suspect keywords helpers
export function getSuspectKeywords(guildId: string): string[] { return getConfig(guildId).suspectKeywords; }
export function setSuspectKeywords(guildId: string, keywords: string[]): void { set(guildId, { suspectKeywords: keywords }); }
export function addSuspectKeyword(guildId: string, kw: string): void {
  const c = getOrCreate(guildId);
  if (!c.suspectKeywords.includes(kw)) set(guildId, { suspectKeywords: [...c.suspectKeywords, kw] });
}
export function removeSuspectKeyword(guildId: string, kw: string): void {
  const c = getOrCreate(guildId);
  set(guildId, { suspectKeywords: c.suspectKeywords.filter(k => k !== kw) });
}

// BL servers helpers
export function getBlServers(guildId: string): string[] { return getConfig(guildId).blServers; }
export function setBlServers(guildId: string, servers: string[]): void { set(guildId, { blServers: servers }); }
export function addBlServer(guildId: string, servId: string): void {
  const c = getOrCreate(guildId);
  if (!c.blServers.includes(servId)) set(guildId, { blServers: [...c.blServers, servId] });
}
export function removeBlServer(guildId: string, servId: string): void {
  const c = getOrCreate(guildId);
  set(guildId, { blServers: c.blServers.filter(s => s !== servId) });
}
export function getAllBlServerIds(guildId?: string): string[] {
  if (guildId !== undefined) return getConfig(guildId).blServers;
  const all = new Set<string>();
  configs.forEach(c => c.blServers.forEach(id => all.add(id)));
  return [...all];
}

// BL tags helpers
export function getBlTags(guildId: string): string[] { return getConfig(guildId).blTags; }
export function setBlTags(guildId: string, tags: string[]): void { set(guildId, { blTags: tags }); }
export function addBlTag(guildId: string, tag: string): void {
  const c = getOrCreate(guildId);
  if (!c.blTags.includes(tag)) set(guildId, { blTags: [...c.blTags, tag] });
}
export function removeBlTag(guildId: string, tag: string): void {
  const c = getOrCreate(guildId);
  set(guildId, { blTags: c.blTags.filter(t => t !== tag) });
}

// Security level getter
export function getSecurityLevel(guildId: string): 1 | 2 | 3 { return getConfig(guildId).securityLevel; }

// Anti-insult helpers
export function setAntiInsultEnabled(guildId: string, enabled: boolean): void { set(guildId, { antiInsultEnabled: enabled }); }
export function addAntiInsultWord(guildId: string, word: string): void {
  const c = getOrCreate(guildId);
  const w = word.toLowerCase().trim();
  if (!c.antiInsultWords.includes(w)) set(guildId, { antiInsultWords: [...c.antiInsultWords, w] });
}
export function removeAntiInsultWord(guildId: string, word: string): boolean {
  const c = getOrCreate(guildId);
  const w = word.toLowerCase().trim();
  if (!c.antiInsultWords.includes(w)) return false;
  set(guildId, { antiInsultWords: c.antiInsultWords.filter(x => x !== w) });
  return true;
}
export function setAntiInsultWords(guildId: string, words: string[]): void { set(guildId, { antiInsultWords: words }); }

// Aliases for backwards compat
export function setSanctionDmEnabled(guildId: string, enabled: boolean): void { set(guildId, { sanctionDmEnabled: enabled }); }
export function setSuspiciousCheckEnabled(guildId: string, enabled: boolean): void { setSuspiciousCheck(guildId, enabled); }
export function setAntiWebhookEnabled(guildId: string, enabled: boolean): void { setAntiWebhook(guildId, enabled); }

// Whitelist invite returns boolean
export function addWhitelistedInvite(guildId: string, code: string): boolean {
  const c = getOrCreate(guildId);
  if (c.whitelistedInviteCodes.includes(code)) return false;
  set(guildId, { whitelistedInviteCodes: [...c.whitelistedInviteCodes, code] });
  return true;
}
export function removeWhitelistedInvite(guildId: string, code: string): boolean {
  const c = getOrCreate(guildId);
  if (!c.whitelistedInviteCodes.includes(code)) return false;
  set(guildId, { whitelistedInviteCodes: c.whitelistedInviteCodes.filter(x => x !== code) });
  return true;
}

export function setAutoRole(guildId: string, roleId: string | null): void { set(guildId, { autoRoleId: roleId }); }
export function getAutoRole(guildId: string): string | null { return getConfig(guildId).autoRoleId ?? null; }

// ── Role whitelist (protection suppression) ───────────────────────────────────
export function addWhitelistedRole(guildId: string, roleId: string): boolean {
  const c = getOrCreate(guildId);
  if (c.whitelistedRoleIds.includes(roleId)) return false;
  set(guildId, { whitelistedRoleIds: [...c.whitelistedRoleIds, roleId] });
  return true;
}
export function removeWhitelistedRole(guildId: string, roleId: string): boolean {
  const c = getOrCreate(guildId);
  if (!c.whitelistedRoleIds.includes(roleId)) return false;
  set(guildId, { whitelistedRoleIds: c.whitelistedRoleIds.filter(x => x !== roleId) });
  return true;
}
export function isRoleWhitelisted(guildId: string, roleId: string): boolean {
  return getConfig(guildId).whitelistedRoleIds.includes(roleId);
}
// ── Tiers d'Activité ─────────────────────────────────────────────────────────
export function setActivityTiersEnabled(guildId: string, enabled: boolean): void { set(guildId, { activityTiersEnabled: enabled }); }
export function setActivityTierPeriodDays(guildId: string, days: number): void { set(guildId, { activityTierPeriodDays: days }); }
export function setActivityTiers(guildId: string, tiers: GuildConfig["activityTiers"]): void { set(guildId, { activityTiers: tiers }); }
export function getActivityTiersConfig(guildId: string): Pick<GuildConfig, "activityTiersEnabled"|"activityTierPeriodDays"|"activityTiers"> {
  const c = getConfig(guildId);
  return { activityTiersEnabled: c.activityTiersEnabled, activityTierPeriodDays: c.activityTierPeriodDays, activityTiers: c.activityTiers };
}

export function setAntiSpamConfig(guildId: string, patch: Partial<Pick<GuildConfig, "antiSpamEnabled"|"antiSpamMessages"|"antiSpamWindowSecs"|"antiSpamAction"|"antiSpamTimeoutMins">>): void { set(guildId, patch); }
export function getAntiSpamConfig(guildId: string): Pick<GuildConfig, "antiSpamEnabled"|"antiSpamMessages"|"antiSpamWindowSecs"|"antiSpamAction"|"antiSpamTimeoutMins"> {
  const c = getConfig(guildId);
  return { antiSpamEnabled: c.antiSpamEnabled, antiSpamMessages: c.antiSpamMessages, antiSpamWindowSecs: c.antiSpamWindowSecs, antiSpamAction: c.antiSpamAction, antiSpamTimeoutMins: c.antiSpamTimeoutMins };
}
