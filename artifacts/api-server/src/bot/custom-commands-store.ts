import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../../data/custom-commands.json");

export interface CustomCommand {
  name: string;
  response: string;
  createdBy: string;
  createdAt: string;
}

type Store = Record<string, Record<string, CustomCommand>>;

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

export function getCustomCommands(guildId: string): CustomCommand[] {
  return Object.values(data[guildId] ?? {});
}

export function getCustomCommand(guildId: string, name: string): CustomCommand | undefined {
  return data[guildId]?.[name.toLowerCase()];
}

export function addCustomCommand(guildId: string, cmd: CustomCommand): boolean {
  const key = cmd.name.toLowerCase();
  if (!data[guildId]) data[guildId] = {};
  const exists = !!data[guildId]![key];
  data[guildId]![key] = { ...cmd, name: key };
  save();
  return !exists;
}

export function removeCustomCommand(guildId: string, name: string): boolean {
  const key = name.toLowerCase();
  if (!data[guildId]?.[key]) return false;
  delete data[guildId]![key];
  save();
  return true;
}

export function countAllCustomCommands(): number {
  return Object.values(data).reduce((sum, g) => sum + Object.keys(g).length, 0);
}
