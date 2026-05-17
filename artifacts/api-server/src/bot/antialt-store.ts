import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface AntialtConfig {
  enabled: boolean;
  minAgeDays: number;
  action: "kick" | "ban";
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "antialt.json");
type Store = Record<string, AntialtConfig>;
let data: Store = {};

function defaultConfig(): AntialtConfig {
  return { enabled: false, minAgeDays: 7, action: "kick" };
}

function save(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[antialt-store] save failed"); }
}

function load(): void {
  try {
    if (!existsSync(FILE)) return;
    data = JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch (err) { logger.error({ err }, "[antialt-store] load failed"); }
}

load();

export function getAntialtConfig(guildId: string): AntialtConfig {
  return data[guildId] ?? defaultConfig();
}

export function setAntialtConfig(guildId: string, patch: Partial<AntialtConfig>): AntialtConfig {
  data[guildId] = { ...defaultConfig(), ...data[guildId], ...patch };
  save();
  return data[guildId]!;
}
