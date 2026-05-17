export interface GuildConfig {
  logChannelId: string | null;
  banLogChannelId: string | null;
  raidMode: boolean;
  joinLock: boolean;
  ticketStaffRoleId: string | null;
  ticketCategoryId: string | null;
}

const configs = new Map<string, GuildConfig>();

function getOrCreate(guildId: string): GuildConfig {
  if (!configs.has(guildId)) {
    configs.set(guildId, {
      logChannelId: null,
      banLogChannelId: null,
      raidMode: false,
      joinLock: false,
      ticketStaffRoleId: null,
      ticketCategoryId: null,
    });
  }
  return configs.get(guildId)!;
}

export function getConfig(guildId: string): GuildConfig {
  return configs.get(guildId) ?? {
    logChannelId: null,
    banLogChannelId: null,
    raidMode: false,
    joinLock: false,
    ticketStaffRoleId: null,
    ticketCategoryId: null,
  };
}

export function setLogChannel(guildId: string, channelId: string): void {
  const c = getOrCreate(guildId);
  configs.set(guildId, { ...c, logChannelId: channelId });
}

export function setBanLogChannel(guildId: string, channelId: string): void {
  const c = getOrCreate(guildId);
  configs.set(guildId, { ...c, banLogChannelId: channelId });
}

export function setRaidMode(guildId: string, enabled: boolean): void {
  const c = getOrCreate(guildId);
  configs.set(guildId, { ...c, raidMode: enabled });
}

export function isRaidMode(guildId: string): boolean {
  return configs.get(guildId)?.raidMode ?? false;
}

export function setJoinLock(guildId: string, enabled: boolean): void {
  const c = getOrCreate(guildId);
  configs.set(guildId, { ...c, joinLock: enabled });
}

export function isJoinLocked(guildId: string): boolean {
  return configs.get(guildId)?.joinLock ?? false;
}

export function setTicketStaffRole(guildId: string, roleId: string): void {
  const c = getOrCreate(guildId);
  configs.set(guildId, { ...c, ticketStaffRoleId: roleId });
}

export function setTicketCategory(guildId: string, categoryId: string): void {
  const c = getOrCreate(guildId);
  configs.set(guildId, { ...c, ticketCategoryId: categoryId });
}
