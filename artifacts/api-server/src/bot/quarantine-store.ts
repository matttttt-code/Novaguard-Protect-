import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../../data/quarantine.json");

export interface QuarantineEntry {
  userId: string;
  userTag: string;
  guildId: string;
  reason: string;
  triggerCount: number;
  windowSeconds: number;
  timestamp: string;
}

type Store = Record<string, Record<string, QuarantineEntry>>;

let data: Store = {};

function load() {
  try {
    if (fs.existsSync(DATA_PATH)) data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  } catch { data = {}; }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch { /* ignore */ }
}

load();

export function isQuarantined(guildId: string, userId: string): boolean {
  return !!data[guildId]?.[userId];
}

export function addQuarantine(entry: QuarantineEntry): void {
  if (!data[entry.guildId]) data[entry.guildId] = {};
  data[entry.guildId]![entry.userId] = entry;
  save();
}

export function removeQuarantine(guildId: string, userId: string): boolean {
  if (!data[guildId]?.[userId]) return false;
  delete data[guildId]![userId];
  save();
  return true;
}

export function getQuarantineList(guildId: string): QuarantineEntry[] {
  return Object.values(data[guildId] ?? {});
}
