export interface GuildConfig {
  logChannelId: string | null;
  banLogChannelId: string | null;
  raidMode: boolean;
}

const configs = new Map<string, GuildConfig>();

function getOrCreate(guildId: string): GuildConfig {
  if (!configs.has(guildId)) {
    configs.set(guildId, { logChannelId: null, banLogChannelId: null, raidMode: false });
  }
  return configs.get(guildId)!;
}

export function getConfig(guildId: string): GuildConfig {
  return configs.get(guildId) ?? { logChannelId: null, banLogChannelId: null, raidMode: false };
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
