import { kvSave, kvLoad } from "./kv-db.js";
import { logger } from "../lib/logger.js";

export interface VoiceSession {
  channelId: string;
  channelName: string | null;
  joinedAt: number;
  leftAt: number;
  durationMs: number;
}

interface UserVoiceData {
  totalMs: number;
  sessions: VoiceSession[];
}

const KV_KEY = "activity-voice-time";
const MAX_SESSIONS = 200;

const store = new Map<string, Map<string, UserVoiceData>>();
const activeSessions = new Map<string, Map<string, { channelId: string; channelName: string | null; joinedAt: number }>>();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const obj: Record<string, Record<string, UserVoiceData>> = {};
    for (const [guildId, users] of store) {
      obj[guildId] = {};
      for (const [userId, data] of users) obj[guildId]![userId] = data;
    }
    kvSave(KV_KEY, obj);
  }, 5000);
}

export async function initVoiceTimeStore(): Promise<void> {
  const saved = await kvLoad<Record<string, Record<string, UserVoiceData>>>(KV_KEY);
  if (!saved) return;
  for (const [guildId, users] of Object.entries(saved)) {
    const map = new Map<string, UserVoiceData>();
    for (const [userId, data] of Object.entries(users)) map.set(userId, data);
    store.set(guildId, map);
  }
  logger.info({ guilds: store.size }, "[voice-time-store] Temps vocaux chargés");
}

function getOrCreateUser(guildId: string, userId: string): UserVoiceData {
  let guildMap = store.get(guildId);
  if (!guildMap) { guildMap = new Map(); store.set(guildId, guildMap); }
  let data = guildMap.get(userId);
  if (!data) { data = { totalMs: 0, sessions: [] }; guildMap.set(userId, data); }
  return data;
}

export function recordVoiceJoin(guildId: string, userId: string, channelId: string, channelName: string | null): void {
  let guildActive = activeSessions.get(guildId);
  if (!guildActive) { guildActive = new Map(); activeSessions.set(guildId, guildActive); }
  guildActive.set(userId, { channelId, channelName, joinedAt: Date.now() });
}

export function recordVoiceLeave(guildId: string, userId: string, channelId: string, channelName: string | null): void {
  const guildActive = activeSessions.get(guildId);
  const session = guildActive?.get(userId);
  if (!session) return;
  guildActive!.delete(userId);

  const leftAt = Date.now();
  const durationMs = leftAt - session.joinedAt;
  if (durationMs < 1000) return;

  const data = getOrCreateUser(guildId, userId);
  data.totalMs += durationMs;
  data.sessions.unshift({
    channelId: session.channelId,
    channelName: session.channelName,
    joinedAt: session.joinedAt,
    leftAt,
    durationMs,
  });
  if (data.sessions.length > MAX_SESSIONS) data.sessions.length = MAX_SESSIONS;
  schedulePersist();
}

export function recordVoiceMove(
  guildId: string,
  userId: string,
  fromChannelId: string,
  fromChannelName: string | null,
  toChannelId: string,
  toChannelName: string | null,
): void {
  recordVoiceLeave(guildId, userId, fromChannelId, fromChannelName);
  recordVoiceJoin(guildId, userId, toChannelId, toChannelName);
}

export interface MemberVoiceStats {
  userId: string;
  totalMs: number;
  totalMinutes: number;
}

export function getVoiceRanking(
  guildId: string,
  opts: { since?: number; limit?: number } = {}
): MemberVoiceStats[] {
  const { since, limit = 50 } = opts;
  const guildMap = store.get(guildId);
  if (!guildMap) return [];

  const result: MemberVoiceStats[] = [];
  for (const [userId, data] of guildMap) {
    let totalMs = data.totalMs;

    if (since) {
      totalMs = 0;
      for (const s of data.sessions) {
        if (s.joinedAt >= since) totalMs += s.durationMs;
        else if (s.leftAt >= since) totalMs += s.leftAt - Math.max(s.joinedAt, since);
      }
      const active = activeSessions.get(guildId)?.get(userId);
      if (active && active.joinedAt >= since) totalMs += Date.now() - active.joinedAt;
    } else {
      const active = activeSessions.get(guildId)?.get(userId);
      if (active) totalMs += Date.now() - active.joinedAt;
    }

    if (totalMs <= 0) continue;
    result.push({ userId, totalMs, totalMinutes: Math.round(totalMs / 60000) });
  }

  return result.sort((a, b) => b.totalMs - a.totalMs).slice(0, limit);
}

export function getMemberVoiceStats(
  guildId: string,
  userId: string,
  opts: { since?: number } = {}
): { totalMs: number; totalMinutes: number; sessions: VoiceSession[] } {
  const { since } = opts;
  const data = store.get(guildId)?.get(userId);
  if (!data) return { totalMs: 0, totalMinutes: 0, sessions: [] };

  let totalMs = data.totalMs;
  let sessions = data.sessions;

  if (since) {
    sessions = sessions.filter((s) => s.leftAt >= since);
    totalMs = 0;
    for (const s of sessions) totalMs += s.durationMs;
    const active = activeSessions.get(guildId)?.get(userId);
    if (active && active.joinedAt >= since) totalMs += Date.now() - active.joinedAt;
  } else {
    const active = activeSessions.get(guildId)?.get(userId);
    if (active) totalMs += Date.now() - active.joinedAt;
  }

  return { totalMs, totalMinutes: Math.round(totalMs / 60000), sessions: sessions.slice(0, 50) };
}
