import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface BadnameConfig {
  enabled: boolean;
  hoistChars: boolean;
  bannedWords: string[];
  replacement: string;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "badname.json");
type Store = Record<string, BadnameConfig>;
let data: Store = {};

const HOIST_CHARS = /^[!\"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~\u00a0\u2000-\u200f\u2028-\u202f\u205f-\u206f«»]/;

function defaultConfig(): BadnameConfig {
  return { enabled: false, hoistChars: true, bannedWords: [], replacement: "Modéré" };
}

function save(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[badname-store] save failed"); }
}

function load(): void {
  try {
    if (!existsSync(FILE)) return;
    data = JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch (err) { logger.error({ err }, "[badname-store] load failed"); }
}

load();

export function getBadnameConfig(guildId: string): BadnameConfig {
  return data[guildId] ?? defaultConfig();
}

export function setBadnameConfig(guildId: string, patch: Partial<BadnameConfig>): BadnameConfig {
  data[guildId] = { ...defaultConfig(), ...data[guildId], ...patch };
  save();
  return data[guildId]!;
}

export function isBadName(displayName: string, guildId: string): boolean {
  const cfg = getBadnameConfig(guildId);
  if (!cfg.enabled) return false;
  if (cfg.hoistChars && HOIST_CHARS.test(displayName)) return true;
  const lower = displayName.toLowerCase();
  return cfg.bannedWords.some((w) => lower.includes(w.toLowerCase()));
}

export function shouldRename(displayName: string, guildId: string): boolean {
  return isBadName(displayName, guildId);
}
