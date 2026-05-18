export interface PendingSupportRequest {
  guildId: string;
  guildName: string;
  channelId: string | null;
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

// ── Stockage des réponses au formulaire support (pour transcript dans le ticket) ──
const supportResponses = new Map<string, string>();

export function saveSupportResponse(userId: string, content: string): void {
  supportResponses.set(userId, content);
}

export function consumeSupportResponse(userId: string): string | undefined {
  const content = supportResponses.get(userId);
  supportResponses.delete(userId);
  return content;
}
