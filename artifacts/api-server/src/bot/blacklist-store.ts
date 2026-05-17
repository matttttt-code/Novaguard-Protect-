export interface BlacklistEntry {
  userId: string;
  userTag: string;
  reason: string;
  moderatorTag: string;
  moderatorId: string;
  timestamp: Date;
}

export interface PendingUnban {
  userId: string;
  userTag: string;
  guildId: string;
  requesterId: string;
  requesterTag: string;
  reason: string;
}

const store = new Map<string, Map<string, BlacklistEntry>>();
const pendingUnbans = new Map<string, PendingUnban>();

const globalBlacklist = new Map<string, BlacklistEntry>();

export function addToBlacklist(guildId: string, entry: BlacklistEntry): void {
  if (!store.has(guildId)) store.set(guildId, new Map());
  store.get(guildId)!.set(entry.userId, entry);
}

export function removeFromBlacklist(guildId: string, userId: string): boolean {
  return store.get(guildId)?.delete(userId) ?? false;
}

export function isBlacklisted(guildId: string, userId: string): boolean {
  return store.get(guildId)?.has(userId) ?? false;
}

export function getBlacklistEntry(guildId: string, userId: string): BlacklistEntry | undefined {
  return store.get(guildId)?.get(userId);
}

export function getBlacklist(guildId: string): BlacklistEntry[] {
  return [...(store.get(guildId)?.values() ?? [])];
}

export function addToGlobalBlacklist(entry: BlacklistEntry): void {
  globalBlacklist.set(entry.userId, entry);
}

export function removeFromGlobalBlacklist(userId: string): boolean {
  return globalBlacklist.delete(userId);
}

export function isGloballyBlacklisted(userId: string): boolean {
  return globalBlacklist.has(userId);
}

export function getGlobalBlacklistEntry(userId: string): BlacklistEntry | undefined {
  return globalBlacklist.get(userId);
}

export function getAllGlobalBlacklisted(): BlacklistEntry[] {
  return [...globalBlacklist.values()];
}

export function addPendingUnban(entry: PendingUnban): void {
  pendingUnbans.set(entry.userId, entry);
}

export function getPendingUnban(userId: string): PendingUnban | undefined {
  return pendingUnbans.get(userId);
}

export function removePendingUnban(userId: string): void {
  pendingUnbans.delete(userId);
}
