import { kvSave, kvLoad } from "./kv-db.js";

export interface TicketData {
  channelId: string;
  ticketNumber: number;
  userId: string;
  username: string;
  guildId: string;
  createdAt: Date;
  claimedBy: string | null;
  claimedById: string | null;
  priority?: "haute" | "normale" | "basse";
}

interface SerializedTicket extends Omit<TicketData, "createdAt"> { createdAt: string; }

const KV_KEY = "tickets";
const byChannel = new Map<string, TicketData>();
const byUser = new Map<string, string>();
const counters = new Map<string, number>();

export async function initTicketStore(): Promise<void> {
  const saved = await kvLoad<{ tickets: SerializedTicket[]; counters: Record<string, number> }>(KV_KEY);
  if (!saved) return;
  for (const ticket of saved.tickets ?? []) {
    const t: TicketData = { ...ticket, createdAt: new Date(ticket.createdAt) };
    byChannel.set(t.channelId, t);
    byUser.set(`${t.guildId}-${t.userId}`, t.channelId);
  }
  for (const [guildId, count] of Object.entries(saved.counters ?? {})) {
    counters.set(guildId, count);
  }
}

function persist(): void {
  const payload = {
    tickets: [...byChannel.values()].map(t => ({ ...t, createdAt: t.createdAt.toISOString() })),
    counters: Object.fromEntries(counters.entries()),
  };
  kvSave(KV_KEY, payload);
}

export function nextTicketNumber(guildId: string): number {
  const next = (counters.get(guildId) ?? 0) + 1;
  counters.set(guildId, next);
  persist();
  return next;
}

export function openTicket(data: TicketData): void {
  byChannel.set(data.channelId, data);
  byUser.set(`${data.guildId}-${data.userId}`, data.channelId);
  persist();
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
  persist();
  return true;
}

export function reassignTicket(channelId: string, staffTag: string, staffId: string): boolean {
  return claimTicket(channelId, staffTag, staffId);
}

export function updateTicketPriority(
  channelId: string,
  priority: "haute" | "normale" | "basse"
): boolean {
  const data = byChannel.get(channelId);
  if (!data) return false;
  byChannel.set(channelId, { ...data, priority });
  persist();
  return true;
}

export function closeTicket(channelId: string): TicketData | undefined {
  const data = byChannel.get(channelId);
  if (!data) return undefined;
  byChannel.delete(channelId);
  byUser.delete(`${data.guildId}-${data.userId}`);
  persist();
  return data;
}

export function isTicketChannel(channelId: string): boolean {
  return byChannel.has(channelId);
}

export function getTicketsByGuild(guildId: string): TicketData[] {
  return [...byChannel.values()].filter((t) => t.guildId === guildId);
}

/**
 * Importe un ticket existant sans incrémenter le compteur de manière incontrôlée.
 * Met à jour le compteur si le numéro du ticket est plus grand que l'actuel.
 */
export function syncTicket(data: TicketData): void {
  byChannel.set(data.channelId, data);
  byUser.set(`${data.guildId}-${data.userId}`, data.channelId);
  const current = counters.get(data.guildId) ?? 0;
  if (data.ticketNumber > current) {
    counters.set(data.guildId, data.ticketNumber);
  }
  persist();
}

export function resetTickets(guildId: string): number {
  let count = 0;
  byChannel.forEach((data, channelId) => {
    if (data.guildId === guildId) {
      byChannel.delete(channelId);
      byUser.delete(`${guildId}-${data.userId}`);
      count++;
    }
  });
  if (count > 0) persist();
  return count;
}
