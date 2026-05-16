export interface Warning {
  reason: string;
  moderator: string;
  moderatorId: string;
  timestamp: Date;
}

const store = new Map<string, Map<string, Warning[]>>();

function getGuildWarnings(guildId: string): Map<string, Warning[]> {
  if (!store.has(guildId)) store.set(guildId, new Map());
  return store.get(guildId)!;
}

export function addWarning(guildId: string, userId: string, warning: Warning): void {
  const guildWarnings = getGuildWarnings(guildId);
  if (!guildWarnings.has(userId)) guildWarnings.set(userId, []);
  guildWarnings.get(userId)!.push(warning);
}

export function getWarnings(guildId: string, userId: string): Warning[] {
  return getGuildWarnings(guildId).get(userId) ?? [];
}

export function clearWarnings(guildId: string, userId: string): number {
  const guildWarnings = getGuildWarnings(guildId);
  const count = guildWarnings.get(userId)?.length ?? 0;
  guildWarnings.delete(userId);
  return count;
}
