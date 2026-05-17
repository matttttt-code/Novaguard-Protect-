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

const configs = new Map<string, GuildConfig>();

function getOrCreate(guildId: string): GuildConfig {
  if (!configs.has(guildId)) configs.set(guildId, defaults());
  return configs.get(guildId)!;
}

export function getConfig(guildId: string): GuildConfig {
  return configs.get(guildId) ?? defaults();
}

export function setLogChannel(guildId: string, channelId: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), logChannelId: channelId });
}

export function setBanLogChannel(guildId: string, channelId: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), banLogChannelId: channelId });
}

export function setRaidMode(guildId: string, enabled: boolean): void {
  configs.set(guildId, { ...getOrCreate(guildId), raidMode: enabled });
}

export function isRaidMode(guildId: string): boolean {
  return configs.get(guildId)?.raidMode ?? false;
}

export function setJoinLock(guildId: string, enabled: boolean): void {
  configs.set(guildId, { ...getOrCreate(guildId), joinLock: enabled });
}

export function isJoinLocked(guildId: string): boolean {
  return configs.get(guildId)?.joinLock ?? false;
}

export function setTicketStaffRole(guildId: string, roleId: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), ticketStaffRoleId: roleId });
}

export function setTicketCategory(guildId: string, categoryId: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), ticketCategoryId: categoryId });
}

export function setWelcomeEnabled(guildId: string, enabled: boolean): void {
  configs.set(guildId, { ...getOrCreate(guildId), welcomeEnabled: enabled });
}

export function setWelcomeChannel(guildId: string, channelId: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), welcomeChannelId: channelId });
}

export function setWelcomeMessage(guildId: string, message: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), welcomeMessage: message });
}

export function setLeaveEnabled(guildId: string, enabled: boolean): void {
  configs.set(guildId, { ...getOrCreate(guildId), leaveEnabled: enabled });
}

export function setLeaveChannel(guildId: string, channelId: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), leaveChannelId: channelId });
}

export function setLeaveMessage(guildId: string, message: string): void {
  configs.set(guildId, { ...getOrCreate(guildId), leaveMessage: message });
}
