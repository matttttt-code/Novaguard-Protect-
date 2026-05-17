import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface GuildConfig {
  logChannelId: string | null;
  banLogChannelId: string | null;
  raidMode: boolean;
  joinLock: boolean;
  ticketStaffRoleId: string | null;
  ticketCategoryId: string | null;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  leaveEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string;
}

export const DEFAULT_WELCOME_MSG = "👋 Bienvenue {user} sur **{server}** ! Tu es le **{count}**e membre. 🎉";
export const DEFAULT_LEAVE_MSG = "👋 **{username}** a quitté le serveur. Il reste **{count}** membres.";

function defaults(): GuildConfig {
  return {
    logChannelId: null,
    banLogChannelId: null,
    raidMode: false,
    joinLock: false,
    ticketStaffRoleId: null,
    ticketCategoryId: null,
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: DEFAULT_WELCOME_MSG,
    leaveEnabled: false,
    leaveChannelId: null,
    leaveMessage: DEFAULT_LEAVE_MSG,
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

export function setLogChannel(guildId: string, channelId: string): void {
  set(guildId, { logChannelId: channelId });
}

export function setBanLogChannel(guildId: string, channelId: string): void {
  set(guildId, { banLogChannelId: channelId });
}

export function setRaidMode(guildId: string, enabled: boolean): void {
  set(guildId, { raidMode: enabled });
}

export function isRaidMode(guildId: string): boolean {
  return configs.get(guildId)?.raidMode ?? false;
}

export function setJoinLock(guildId: string, enabled: boolean): void {
  set(guildId, { joinLock: enabled });
}

export function isJoinLocked(guildId: string): boolean {
  return configs.get(guildId)?.joinLock ?? false;
}

export function setTicketStaffRole(guildId: string, roleId: string): void {
  set(guildId, { ticketStaffRoleId: roleId });
}

export function setTicketCategory(guildId: string, categoryId: string): void {
  set(guildId, { ticketCategoryId: categoryId });
}

export function setWelcomeEnabled(guildId: string, enabled: boolean): void {
  set(guildId, { welcomeEnabled: enabled });
}

export function setWelcomeChannel(guildId: string, channelId: string): void {
  set(guildId, { welcomeChannelId: channelId });
}

export function setWelcomeMessage(guildId: string, message: string): void {
  set(guildId, { welcomeMessage: message });
}

export function setLeaveEnabled(guildId: string, enabled: boolean): void {
  set(guildId, { leaveEnabled: enabled });
}

export function setLeaveChannel(guildId: string, channelId: string): void {
  set(guildId, { leaveChannelId: channelId });
}

export function setLeaveMessage(guildId: string, message: string): void {
  set(guildId, { leaveMessage: message });
}
