export interface PendingSupportRequest {
  guildId: string;
  guildName: string;
  channelId: string;
  expiresAt: number;
}

const pending = new Map<string, PendingSupportRequest>();

export function addSupportRequest(userId: string, req: PendingSupportRequest): void {
  pending.set(userId, req);
}

export function getSupportRequest(userId: string): PendingSupportRequest | undefined {
  const req = pending.get(userId);
  if (!req) return undefined;
  if (Date.now() > req.expiresAt) {
    pending.delete(userId);
    return undefined;
  }
  return req;
}

export function removeSupportRequest(userId: string): void {
  pending.delete(userId);
}

export function hasSupportRequest(userId: string): boolean {
  return getSupportRequest(userId) !== undefined;
}
