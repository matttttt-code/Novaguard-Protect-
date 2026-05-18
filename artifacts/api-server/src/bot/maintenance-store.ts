import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../../data/maintenance.json");

interface MaintenanceState {
  active: boolean;
  message: string;
}

type Store = Record<string, MaintenanceState>;

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

const DEFAULT_MSG = "🔧 Le bot est actuellement en maintenance. Revenez bientôt !";

export function isMaintenanceMode(guildId: string): boolean {
  return data[guildId]?.active === true;
}

export function getMaintenanceMessage(guildId: string): string {
  return data[guildId]?.message ?? DEFAULT_MSG;
}

export function setMaintenance(guildId: string, active: boolean, message?: string): void {
  data[guildId] = { active, message: message ?? data[guildId]?.message ?? DEFAULT_MSG };
  save();
}

export function getMaintenanceState(guildId: string): MaintenanceState {
  return data[guildId] ?? { active: false, message: DEFAULT_MSG };
}
