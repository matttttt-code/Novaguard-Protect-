import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface BlacklistedServer {
  guildId: string;
  label: string;
  addedAt: string;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "server-blacklist.json");

const store = new Map<string, BlacklistedServer>();

async function save(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify([...store.values()], null, 2), "utf-8");
  } catch (e) {
    logger.error({ err: e }, "[server-blacklist] Erreur sauvegarde");
  }
}

async function load(): Promise<void> {
  try {
    const raw = await readFile(FILE, "utf-8");
    const entries = JSON.parse(raw) as BlacklistedServer[];
    for (const e of entries) store.set(e.guildId, e);
    logger.info({ count: store.size }, "[server-blacklist] Serveurs blacklistés chargés");
  } catch { /* premier démarrage */ }
}

void load();

export function addBlacklistedServer(guildId: string, label: string): BlacklistedServer {
  const entry: BlacklistedServer = { guildId, label: label.trim() || guildId, addedAt: new Date().toISOString() };
  store.set(guildId, entry);
  void save();
  return entry;
}

export function removeBlacklistedServer(guildId: string): boolean {
  const existed = store.has(guildId);
  if (existed) { store.delete(guildId); void save(); }
  return existed;
}

export function getBlacklistedServers(): BlacklistedServer[] {
  return [...store.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function isServerBlacklisted(guildId: string): boolean {
  return store.has(guildId);
}

export function getBlacklistedServerIds(): Set<string> {
  return new Set(store.keys());
}
