export interface TicketData {
  channelId: string;
  ticketNumber: number;
  userId: string;
  username: string;
  guildId: string;
  createdAt: Date;
  claimedBy: string | null;
  claimedById: string | null;
}

const byChannel = new Map<string, TicketData>();
const byUser = new Map<string, string>();
const counters = new Map<string, number>();

export function nextTicketNumber(guildId: string): number {
  const next = (counters.get(guildId) ?? 0) + 1;
  counters.set(guildId, next);
  return next;
}

export function openTicket(data: TicketData): void {
  byChannel.set(data.channelId, data);
  byUser.set(`${data.guildId}-${data.userId}`, data.channelId);
}

export function getTicketByChannel(channelId: string): TicketData | undefined {
  return byChannel.get(channelId);
}

export function getTicketChannelByUser(guildId: string, userId: string): string | undefined {
  return byUser.get(`${guildId}-${userId}`);
}

export function claimTicket(channelId: string, staffTag: string, staffId: string): boolean {
  const data = byChannel.get(channelId);
  if (!data) return false;
  byChannel.set(channelId, { ...data, claimedBy: staffTag, claimedById: staffId });
  return true;
}

export function closeTicket(channelId: string): TicketData | undefined {
  const data = byChannel.get(channelId);
  if (!data) return undefined;
  byChannel.delete(channelId);
  byUser.delete(`${data.guildId}-${data.userId}`);
  return data;
}

export function isTicketChannel(channelId: string): boolean {
  return byChannel.has(channelId);
}
