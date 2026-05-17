export interface PendingSecurityLevel3 {
  guildId: string;
  guildName: string;
  requesterId: string;
  requesterTag: string;
  channelId: string;
  timestamp: number;
}

const pending = new Map<string, PendingSecurityLevel3>();

export function addPendingLevel3(req: PendingSecurityLevel3): void {
  pending.set(req.guildId, req);
  setTimeout(() => pending.delete(req.guildId), 15 * 60_000);
}

export function getPendingLevel3(guildId: string): PendingSecurityLevel3 | null {
  return pending.get(guildId) ?? null;
}

export function removePendingLevel3(guildId: string): void {
  pending.delete(guildId);
}
