import { kvSave, kvLoad } from "./kv-db.js";
import { logger } from "../lib/logger.js";

export interface ConnectionSession {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  manual?: boolean;
}

export interface UserConnectionData {
  totalConnections: number;
  totalMs: number;
  sessions: ConnectionSession[];
}

const KV_KEY = "connection-system";
const MAX_SESSIONS = 500;

const store = new Map<string, Map<string, UserConnectionData>>();
const active = new Map<string, Map<string, number>>();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const obj: Record<string, Record<string, UserConnectionData>> = {};
    for (const [guildId, users] of store) {
      obj[guildId] = {};
      for (const [userId, data] of users) obj[guildId]![userId] = data;
    }
    kvSave(KV_KEY, obj);
  }, 5000);
}

export async function initConnectionStore(): Promise<void> {
  const saved = await kvLoad<Record<string, Record<string, UserConnectionData>>>(KV_KEY);
  if (!saved) return;
  for (const [guildId, users] of Object.entries(saved)) {
    const map = new Map<string, UserConnectionData>();
    for (const [userId, data] of Object.entries(users)) map.set(userId, data);
    store.set(guildId, map);
  }
  logger.info({ guilds: store.size }, "[connection-store] Données connexions chargées");
}

function getOrCreate(guildId: string, userId: string): UserConnectionData {
  let gMap = store.get(guildId);
  if (!gMap) { gMap = new Map(); store.set(guildId, gMap); }
  let data = gMap.get(userId);
  if (!data) { data = { totalConnections: 0, totalMs: 0, sessions: [] }; gMap.set(userId, data); }
  return data;
}

export function isConnected(guildId: string, userId: string): boolean {
  return active.get(guildId)?.has(userId) ?? false;
}

export function connect(guildId: string, userId: string): boolean {
  let gActive = active.get(guildId);
  if (!gActive) { gActive = new Map(); active.set(guildId, gActive); }
  if (gActive.has(userId)) return false;
  gActive.set(userId, Date.now());
  return true;
}

export function disconnect(guildId: string, userId: string): { durationMs: number } | null {
  const gActive = active.get(guildId);
  const joinedAt = gActive?.get(userId);
  if (joinedAt === undefined) return null;
  gActive!.delete(userId);

  const endedAt = Date.now();
  const durationMs = endedAt - joinedAt;

  const data = getOrCreate(guildId, userId);
  data.totalConnections++;
  data.totalMs += durationMs;
  data.sessions.unshift({ startedAt: joinedAt, endedAt, durationMs });
  if (data.sessions.length > MAX_SESSIONS) data.sessions.length = MAX_SESSIONS;
  schedulePersist();
  return { durationMs };
}

export function forceConnect(guildId: string, userId: string): boolean {
  return connect(guildId, userId);
}

export function forceDisconnect(guildId: string, userId: string): { durationMs: number } | null {
  return disconnect(guildId, userId);
}

export function addConnections(guildId: string, userId: string, count: number): void {
  const data = getOrCreate(guildId, userId);
  data.totalConnections += count;
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    data.sessions.unshift({ startedAt: now - 60_000, endedAt: now, durationMs: 60_000, manual: true });
  }
  if (data.sessions.length > MAX_SESSIONS) data.sessions.length = MAX_SESSIONS;
  schedulePersist();
}

export function removeConnections(guildId: string, userId: string, count: number): void {
  const data = getOrCreate(guildId, userId);
  data.totalConnections = Math.max(0, data.totalConnections - count);
  schedulePersist();
}

export function deleteUser(guildId: string, userId: string): void {
  const gActive = active.get(guildId);
  gActive?.delete(userId);
  store.get(guildId)?.delete(userId);
  schedulePersist();
}

export function resetGuild(guildId: string): void {
  const gActive = active.get(guildId);
  if (gActive) gActive.clear();
  store.delete(guildId);
  schedulePersist();
}

export function getConnectedUsers(guildId: string): string[] {
  const gActive = active.get(guildId);
  if (!gActive) return [];
  return [...gActive.keys()];
}

export function getMemberStats(guildId: string, userId: string): UserConnectionData & { isConnected: boolean; currentSessionMs: number } {
  const data = getOrCreate(guildId, userId);
  const joinedAt = active.get(guildId)?.get(userId);
  const currentSessionMs = joinedAt ? Date.now() - joinedAt : 0;
  return { ...data, isConnected: !!joinedAt, currentSessionMs };
}

export interface LeaderboardEntry {
  userId: string;
  totalConnections: number;
  totalMs: number;
  isConnected: boolean;
}

export function getLeaderboard(guildId: string, limit = 50): LeaderboardEntry[] {
  const gMap = store.get(guildId);
  if (!gMap) return [];
  const gActive = active.get(guildId);
  return [...gMap.entries()]
    .map(([userId, data]) => ({
      userId,
      totalConnections: data.totalConnections,
      totalMs: data.totalMs,
      isConnected: gActive?.has(userId) ?? false,
    }))
    .sort((a, b) => b.totalConnections - a.totalConnections)
    .slice(0, limit);
}

export function rewindConnections(
  guildId: string,
  fromMs: number,
  toMs: number
): { userId: string; sessions: ConnectionSession[] }[] {
  const gMap = store.get(guildId);
  if (!gMap) return [];
  const result: { userId: string; sessions: ConnectionSession[] }[] = [];
  for (const [userId, data] of gMap) {
    const sessions = data.sessions.filter((s) => s.startedAt >= fromMs && s.endedAt <= toMs);
    if (sessions.length > 0) result.push({ userId, sessions });
  }
  return result;
}
