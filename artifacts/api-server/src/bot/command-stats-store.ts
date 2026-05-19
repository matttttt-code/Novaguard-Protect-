import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "command-stats.json");

type Stats = Record<string, Record<string, number>>;

let data: Stats = {};

function load() {
  try {
    if (existsSync(FILE)) data = JSON.parse(readFileSync(FILE, "utf8")) as Stats;
  } catch { data = {}; }
}

function save() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch { /* ignore */ }
}

load();

export function trackCommand(guildId: string, commandName: string): void {
  if (!data[guildId]) data[guildId] = {};
  data[guildId][commandName] = (data[guildId][commandName] ?? 0) + 1;
  save();
}

export function getCommandStats(guildId: string): Record<string, number> {
  return data[guildId] ?? {};
}

export function getAllCommandStats(): Stats {
  return data;
}

export function resetCommandStats(guildId: string): void {
  delete data[guildId];
  save();
}
