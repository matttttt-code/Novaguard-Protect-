import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface InviteBlacklistEntry {
  userId: string;
  userTag: string;
  reason: string;
  moderatorTag: string;
  moderatorId: string;
  timestamp: string;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "invite-blacklist.json");

const store = new Map<string, Map<string, InviteBlacklistEntry>>();

function saveToDisk(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const obj: Record<string, Record<string, InviteBlacklistEntry>> = {};
    store.forEach((gMap, gId) => {
      obj[gId] = {};
      gMap.forEach((entry, uid) => { obj[gId]![uid] = entry; });
    });
    writeFileSync(FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (err) {
    logger.error({ err }, "[invite-blacklist-store] Impossible de sauvegarder");
  }
}

function loadFromDisk(): void {
  try {
    if (!existsSync(FILE)) return;
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, Record<string, InviteBlacklistEntry>>;
    for (const [gId, gMap] of Object.entries(raw)) {
      const m = new Map<string, InviteBlacklistEntry>();
      for (const [uid, entry] of Object.entries(gMap)) m.set(uid, entry);
      store.set(gId, m);
    }
  } catch (err) {
    logger.error({ err }, "[invite-blacklist-store] Impossible de charger");
  }
}

loadFromDisk();

export function addInviteBlacklist(guildId: string, entry: InviteBlacklistEntry): void {
  const gMap = store.get(guildId) ?? new Map();
  gMap.set(entry.userId, entry);
  store.set(guildId, gMap);
  saveToDisk();
}

export function removeInviteBlacklist(guildId: string, userId: string): boolean {
  const gMap = store.get(guildId);
  if (!gMap?.has(userId)) return false;
  gMap.delete(userId);
  saveToDisk();
  return true;
}

export function isInviteBlacklisted(guildId: string, userId: string): boolean {
  return store.get(guildId)?.has(userId) ?? false;
}

export function getInviteBlacklist(guildId: string): InviteBlacklistEntry[] {
  const gMap = store.get(guildId);
  if (!gMap) return [];
  return [...gMap.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getInviteBlacklistEntry(guildId: string, userId: string): InviteBlacklistEntry | null {
  return store.get(guildId)?.get(userId) ?? null;
}
