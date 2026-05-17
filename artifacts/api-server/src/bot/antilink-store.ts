import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface AntilinkConfig {
  enabled: boolean;
  allowedDomains: string[];
  action: "delete" | "warn" | "timeout";
  timeoutMinutes: number;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "antilink.json");

type Store = Record<string, AntilinkConfig>;
let data: Store = {};

function defaultConfig(): AntilinkConfig {
  return { enabled: false, allowedDomains: [], action: "delete", timeoutMinutes: 10 };
}

function save(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[antilink-store] save failed"); }
}

function load(): void {
  try {
    if (!existsSync(FILE)) return;
    data = JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch (err) { logger.error({ err }, "[antilink-store] load failed"); }
}

load();

export function getAntilinkConfig(guildId: string): AntilinkConfig {
  return data[guildId] ?? defaultConfig();
}

export function setAntilinkConfig(guildId: string, patch: Partial<AntilinkConfig>): AntilinkConfig {
  data[guildId] = { ...defaultConfig(), ...data[guildId], ...patch };
  save();
  return data[guildId]!;
}
