import { kvSave, kvLoad } from "./kv-db.js";
import { logger } from "../lib/logger.js";

export interface MessageEvent {
  userId: string;
  channelId: string;
  ts: number;
}

const MAX_EVENTS = 20000;
const KV_KEY = "activity-messages";

const store = new Map<string, MessageEvent[]>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const obj: Record<string, MessageEvent[]> = {};
    for (const [guildId, events] of store) obj[guildId] = events;
    kvSave(KV_KEY, obj);
  }, 5000);
}

export async function initActivityStore(): Promise<void> {
  const saved = await kvLoad<Record<string, MessageEvent[]>>(KV_KEY);
  if (!saved) return;
  for (const [guildId, events] of Object.entries(saved)) {
    if (Array.isArray(events)) store.set(guildId, events);
  }
  const total = [...store.values()].reduce((n, e) => n + e.length, 0);
  logger.info({ guilds: store.size, total }, "[activity-store] Messages chargés");
}

export function recordMessage(guildId: string, userId: string, channelId: string): void {
  let list = store.get(guildId);
  if (!list) { list = []; store.set(guildId, list); }
  list.push({ userId, channelId, ts: Date.now() });
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
  schedulePersist();
}

export interface MemberMessageStats {
  userId: string;
  count: number;
  byChannel: Record<string, number>;
}

export function getMessageRanking(
  guildId: string,
  opts: { since?: number; channelId?: string; limit?: number } = {}
): MemberMessageStats[] {
  const list = store.get(guildId) ?? [];
  const { since, channelId, limit = 50 } = opts;

  const filtered = list.filter((e) => {
    if (since && e.ts < since) return false;
    if (channelId && e.channelId !== channelId) return false;
    return true;
  });

  const map = new Map<string, { count: number; byChannel: Record<string, number> }>();
  for (const e of filtered) {
    let entry = map.get(e.userId);
    if (!entry) { entry = { count: 0, byChannel: {} }; map.set(e.userId, entry); }
    entry.count++;
    entry.byChannel[e.channelId] = (entry.byChannel[e.channelId] ?? 0) + 1;
  }

  return [...map.entries()]
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getMemberMessageStats(
  guildId: string,
  userId: string,
  opts: { since?: number } = {}
): { count: number; byChannel: Record<string, number> } {
  const list = store.get(guildId) ?? [];
  const { since } = opts;
  const byChannel: Record<string, number> = {};
  let count = 0;
  for (const e of list) {
    if (e.userId !== userId) continue;
    if (since && e.ts < since) continue;
    count++;
    byChannel[e.channelId] = (byChannel[e.channelId] ?? 0) + 1;
  }
  return { count, byChannel };
}
