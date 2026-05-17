export interface PendingRaid2 {
  guildId: string;
  guildName: string;
  requesterId: string;
  requesterTag: string;
  timestamp: number;
}

const pending = new Map<string, PendingRaid2>();

export function addPendingRaid2(req: PendingRaid2): void {
  pending.set(req.guildId, req);
  setTimeout(() => pending.delete(req.guildId), 15 * 60_000);
}

export function getPendingRaid2(guildId: string): PendingRaid2 | null {
  return pending.get(guildId) ?? null;
}

export function removePendingRaid2(guildId: string): void {
  pending.delete(guildId);
}
