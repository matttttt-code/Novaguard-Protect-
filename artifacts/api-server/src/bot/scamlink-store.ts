import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger.js";

// Domaines de scam connus — liste de base
export const BUILTIN_SCAM_DOMAINS = [
  "discord.gift", "discordapp.gift", "discordnitro.gift", "discordgift.site",
  "discordnitro.com", "discord-nitro.ru", "free-nitro.ru", "discordfree.com",
  "steamcommunity.ru", "steam-community.ru", "steamgift.ru", "steamgifts.cc",
  "nitro-discord.com", "discord-nitrogift.com", "discord-gift.com",
  "freegiftcard.com", "claimnitro.com", "getnitro.gift", "nitro.gift",
  "dlscord.com", "dlscordapp.com", "discorcl.com", "discrod.com",
  "airdrop-discord.com", "discord-airdrop.com",
];

export interface ScamlinkConfig {
  enabled: boolean;
  customDomains: string[];
  action: "delete" | "warn" | "timeout" | "ban";
  timeoutMinutes: number;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "scamlink.json");
type Store = Record<string, ScamlinkConfig>;
let data: Store = {};

function defaultConfig(): ScamlinkConfig {
  return { enabled: true, customDomains: [], action: "ban", timeoutMinutes: 60 };
}

function save(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[scamlink-store] save failed"); }
}

function load(): void {
  try {
    if (!existsSync(FILE)) return;
    data = JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch (err) { logger.error({ err }, "[scamlink-store] load failed"); }
}

load();

export function getScamlinkConfig(guildId: string): ScamlinkConfig {
  return data[guildId] ?? defaultConfig();
}

export function setScamlinkConfig(guildId: string, patch: Partial<ScamlinkConfig>): ScamlinkConfig {
  data[guildId] = { ...defaultConfig(), ...data[guildId], ...patch };
  save();
  return data[guildId]!;
}

export function isScamDomain(domain: string, guildId: string): boolean {
  const cfg = getScamlinkConfig(guildId);
  if (!cfg.enabled) return false;
  const all = [...BUILTIN_SCAM_DOMAINS, ...cfg.customDomains];
  return all.some((d) => domain === d || domain.endsWith(`.${d}`));
}
