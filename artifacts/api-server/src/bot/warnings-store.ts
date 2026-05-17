import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

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

interface DiskData {
  warnings: Record<string, Record<string, SerializedWarning[]>>;
  caseCounters: Record<string, number>;
}

const DATA_DIR = join(process.cwd(), "data");
const WARNINGS_FILE = join(DATA_DIR, "warnings.json");

const store = new Map<string, Map<string, Warning[]>>();
const caseCounters = new Map<string, number>();

function saveToDisk(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    const warnings: Record<string, Record<string, SerializedWarning[]>> = {};
    store.forEach((userMap, guildId) => {
      warnings[guildId] = {};
      userMap.forEach((warningList, userId) => {
        warnings[guildId]![userId] = warningList.map((w) => ({
          ...w,
          timestamp: w.timestamp.toISOString(),
        }));
      });
    });

    const counters: Record<string, number> = {};
    caseCounters.forEach((val, key) => { counters[key] = val; });

    const data: DiskData = { warnings, caseCounters: counters };
    writeFileSync(WARNINGS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[warnings-store] Impossible de sauvegarder sur disque :", err);
  }
}

function loadFromDisk(): void {
  try {
    if (!existsSync(WARNINGS_FILE)) return;
    const raw = readFileSync(WARNINGS_FILE, "utf8");
    const data = JSON.parse(raw) as DiskData;

    Object.entries(data.warnings ?? {}).forEach(([guildId, userMap]) => {
      const guildStore = new Map<string, Warning[]>();
      Object.entries(userMap).forEach(([userId, warningList]) => {
        guildStore.set(
          userId,
          warningList.map((w) => ({ ...w, timestamp: new Date(w.timestamp) }))
        );
      });
      store.set(guildId, guildStore);
    });

    Object.entries(data.caseCounters ?? {}).forEach(([guildId, count]) => {
      caseCounters.set(guildId, count);
    });
  } catch (err) {
    console.error("[warnings-store] Impossible de charger depuis le disque :", err);
  }
}

loadFromDisk();

function getGuildWarnings(guildId: string): Map<string, Warning[]> {
  if (!store.has(guildId)) store.set(guildId, new Map());
  return store.get(guildId)!;
}

function nextCaseId(guildId: string): number {
  const next = (caseCounters.get(guildId) ?? 0) + 1;
  caseCounters.set(guildId, next);
  return next;
}

export function addWarning(
  guildId: string,
  userId: string,
  warning: Omit<Warning, "caseId">
): number {
  const guildWarnings = getGuildWarnings(guildId);
  if (!guildWarnings.has(userId)) guildWarnings.set(userId, []);
  const caseId = nextCaseId(guildId);
  guildWarnings.get(userId)!.push({ ...warning, caseId });
  saveToDisk();
  return caseId;
}

export function getWarnings(guildId: string, userId: string): Warning[] {
  return getGuildWarnings(guildId).get(userId) ?? [];
}

export function clearWarnings(guildId: string, userId: string): number {
  const guildWarnings = getGuildWarnings(guildId);
  const count = guildWarnings.get(userId)?.length ?? 0;
  guildWarnings.delete(userId);
  saveToDisk();
  return count;
}

export function removeWarningByCase(
  guildId: string,
  userId: string,
  caseId: number
): boolean {
  const guildWarnings = getGuildWarnings(guildId);
  const warns = guildWarnings.get(userId);
  if (!warns) return false;
  const idx = warns.findIndex((w) => w.caseId === caseId);
  if (idx === -1) return false;
  warns.splice(idx, 1);
  saveToDisk();
  return true;
}
