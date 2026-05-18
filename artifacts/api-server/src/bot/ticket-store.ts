import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";

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

const DATA_DIR = join(process.cwd(), "data");
const TICKET_FILE = join(DATA_DIR, "tickets.json");

const byChannel = new Map<string, TicketData>();
const byUser = new Map<string, string>();
const counters = new Map<string, number>();

async function saveToDisk(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const payload = {
      tickets: [...byChannel.values()].map(t => ({ ...t, createdAt: t.createdAt.toISOString() })),
      counters: Object.fromEntries(counters.entries()),
    };
    await writeFile(TICKET_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch { /* ignore */ }
}

async function loadFromDisk(): Promise<void> {
  try {
    const raw = await readFile(TICKET_FILE, "utf-8");
    const payload = JSON.parse(raw) as {
      tickets: (Omit<TicketData, "createdAt"> & { createdAt: string })[];
      counters: Record<string, number>;
    };
    for (const ticket of payload.tickets) {
      const t: TicketData = { ...ticket, createdAt: new Date(ticket.createdAt) };
      byChannel.set(t.channelId, t);
      byUser.set(`${t.guildId}-${t.userId}`, t.channelId);
    }
    for (const [guildId, count] of Object.entries(payload.counters)) {
      counters.set(guildId, count);
    }
  } catch { /* Fichier inexistant au premier démarrage — normal */ }
}

void loadFromDisk();

export function nextTicketNumber(guildId: string): number {
  const next = (counters.get(guildId) ?? 0) + 1;
  counters.set(guildId, next);
  void saveToDisk();
  return next;
}

export function openTicket(data: TicketData): void {
  byChannel.set(data.channelId, data);
  byUser.set(`${data.guildId}-${data.userId}`, data.channelId);
  void saveToDisk();
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
  void saveToDisk();
  return true;
}

export function closeTicket(channelId: string): TicketData | undefined {
  const data = byChannel.get(channelId);
  if (!data) return undefined;
  byChannel.delete(channelId);
  byUser.delete(`${data.guildId}-${data.userId}`);
  void saveToDisk();
  return data;
}

export function isTicketChannel(channelId: string): boolean {
  return byChannel.has(channelId);
}

export function getTicketsByGuild(guildId: string): TicketData[] {
  return [...byChannel.values()].filter((t) => t.guildId === guildId);
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
  if (count > 0) void saveToDisk();
  return count;
}
