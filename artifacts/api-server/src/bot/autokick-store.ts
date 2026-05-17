import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface AutokickConfig {
  enabled: boolean;
  warnThreshold: number;
  action: "kick" | "ban" | "timeout";
  timeoutHours: number;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "autokick.json");
type Store = Record<string, AutokickConfig>;
let data: Store = {};

function defaultConfig(): AutokickConfig {
  return { enabled: false, warnThreshold: 3, action: "kick", timeoutHours: 24 };
}

function save(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[autokick-store] save failed"); }
}

function load(): void {
  try {
    if (!existsSync(FILE)) return;
    data = JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch (err) { logger.error({ err }, "[autokick-store] load failed"); }
}

load();

export function getAutokickConfig(guildId: string): AutokickConfig {
  return data[guildId] ?? defaultConfig();
}

export function setAutokickConfig(guildId: string, patch: Partial<AutokickConfig>): AutokickConfig {
  data[guildId] = { ...defaultConfig(), ...data[guildId], ...patch };
  save();
  return data[guildId]!;
}
