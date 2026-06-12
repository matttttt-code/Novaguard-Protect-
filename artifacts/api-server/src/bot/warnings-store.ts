import { kvSave, kvLoad } from "./kv-db.js";

export interface Warning {
  caseId: number;
  reason: string;
  moderator: string;
  moderatorId: string;
  timestamp: Date;
}

interface SerializedWarning {
  caseId: number;
  reason: string;
  moderator: string;
  moderatorId: string;
  timestamp: string;
}

interface StoredData {
  warnings: Record<string, Record<string, SerializedWarning[]>>;
  caseCounters: Record<string, number>;
}

const KV_KEY = "warnings";
const store = new Map<string, Map<string, Warning[]>>();
const caseCounters = new Map<string, number>();

export async function initWarningsStore(): Promise<void> {
  const saved = await kvLoad<StoredData>(KV_KEY);
  if (!saved) return;
  Object.entries(saved.warnings ?? {}).forEach(([guildId, userMap]) => {
    const guildStore = new Map<string, Warning[]>();
    Object.entries(userMap).forEach(([userId, warningList]) => {
      guildStore.set(userId, warningList.map(w => ({ ...w, timestamp: new Date(w.timestamp) })));
    });
    store.set(guildId, guildStore);
  });
  Object.entries(saved.caseCounters ?? {}).forEach(([guildId, count]) => {
    caseCounters.set(guildId, count);
  });
}

function persist(): void {
  const warnings: Record<string, Record<string, SerializedWarning[]>> = {};
  store.forEach((userMap, guildId) => {
    warnings[guildId] = {};
    userMap.forEach((warningList, userId) => {
      warnings[guildId]![userId] = warningList.map(w => ({ ...w, timestamp: w.timestamp.toISOString() }));
    });
  });
  const counters: Record<string, number> = {};
  caseCounters.forEach((val, key) => { counters[key] = val; });
  kvSave(KV_KEY, { warnings, caseCounters: counters });
}

function getGuildWarnings(guildId: string): Map<string, Warning[]> {
  if (!store.has(guildId)) store.set(guildId, new Map());
  return store.get(guildId)!;
}

function nextCaseId(guildId: string): number {
  const next = (caseCounters.get(guildId) ?? 0) + 1;
  caseCounters.set(guildId, next);
  return next;
}

export function addWarning(guildId: string, userId: string, warning: Omit<Warning, "caseId">): number {
  const guildWarnings = getGuildWarnings(guildId);
  if (!guildWarnings.has(userId)) guildWarnings.set(userId, []);
  const caseId = nextCaseId(guildId);
  guildWarnings.get(userId)!.push({ ...warning, caseId });
  persist();
  return caseId;
}

export function getWarnings(guildId: string, userId: string): Warning[] {
  return getGuildWarnings(guildId).get(userId) ?? [];
}

export function clearWarnings(guildId: string, userId: string): number {
  const guildWarnings = getGuildWarnings(guildId);
  const count = guildWarnings.get(userId)?.length ?? 0;
  guildWarnings.delete(userId);
  persist();
  return count;
}

export function getAllWarningsForGuild(guildId: string): { userId: string; warnings: Warning[] }[] {
  const guildWarnings = store.get(guildId);
  if (!guildWarnings) return [];
  const result: { userId: string; warnings: Warning[] }[] = [];
  guildWarnings.forEach((warns, userId) => { if (warns.length > 0) result.push({ userId, warnings: warns }); });
  return result;
}

export function getAllWarnings(): { guildId: string; userId: string; warnings: Warning[] }[] {
  const result: { guildId: string; userId: string; warnings: Warning[] }[] = [];
  store.forEach((guildWarnings, guildId) => {
    guildWarnings.forEach((warns, userId) => { if (warns.length > 0) result.push({ guildId, userId, warnings: warns }); });
  });
  return result;
}

export function removeWarningByCase(guildId: string, userId: string, caseId: number): boolean {
  const guildWarnings = getGuildWarnings(guildId);
  const warns = guildWarnings.get(userId);
  if (!warns) return false;
  const idx = warns.findIndex(w => w.caseId === caseId);
  if (idx === -1) return false;
  warns.splice(idx, 1);
  persist();
  return true;
}

export function editWarning(
  guildId: string,
  userId: string,
  caseId: number,
  newReason: string,
): Warning | null {
  const guildWarnings = getGuildWarnings(guildId);
  const warns = guildWarnings.get(userId);
  if (!warns) return null;
  const warn = warns.find(w => w.caseId === caseId);
  if (!warn) return null;
  warn.reason = newReason;
  persist();
  return warn;
}

export function findWarningByCase(guildId: string, caseId: number): { userId: string; warning: Warning } | null {
  const guildWarnings = store.get(guildId);
  if (!guildWarnings) return null;
  for (const [userId, warns] of guildWarnings) {
    const w = warns.find(w => w.caseId === caseId);
    if (w) return { userId, warning: w };
  }
  return null;
}
