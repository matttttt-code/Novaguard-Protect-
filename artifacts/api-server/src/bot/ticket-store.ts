export interface TicketData {
  channelId: string;
  userId: string;
  username: string;
  guildId: string;
  createdAt: Date;
}

const byChannel = new Map<string, TicketData>();
const byUser = new Map<string, string>();

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
