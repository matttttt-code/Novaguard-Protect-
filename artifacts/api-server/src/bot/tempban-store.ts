import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Client } from "discord.js";
import { logger } from "../lib/logger.js";
import { sendLog, logEmbed } from "./log.js";

interface TempBan {
  guildId: string;
  userId: string;
  userTag: string;
  moderatorTag: string;
  reason: string;
  expiresAt: number;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "tempbans.json");

const store = new Map<string, TempBan>();

function key(guildId: string, userId: string) { return `${guildId}:${userId}`; }

function saveToDisk(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const obj: Record<string, TempBan> = {};
    store.forEach((v, k) => { obj[k] = v; });
    writeFileSync(FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[tempban-store] save failed"); }
}

function loadFromDisk(): void {
  try {
    if (!existsSync(FILE)) return;
    const obj = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, TempBan>;
    Object.entries(obj).forEach(([k, v]) => store.set(k, v));
  } catch (err) { logger.error({ err }, "[tempban-store] load failed"); }
}

loadFromDisk();

export function addTempBan(ban: TempBan): void {
  store.set(key(ban.guildId, ban.userId), ban);
  saveToDisk();
}

export function removeTempBan(guildId: string, userId: string): boolean {
  const deleted = store.delete(key(guildId, userId));
  if (deleted) saveToDisk();
  return deleted;
}

export function hasTempBan(guildId: string, userId: string): boolean {
  return store.has(key(guildId, userId));
}

export function getTempBan(guildId: string, userId: string): TempBan | undefined {
  return store.get(key(guildId, userId));
}

export function startTempBanScheduler(client: Client): void {
  const CHECK_INTERVAL = 30_000;

  const check = async () => {
    const now = Date.now();
    for (const [k, ban] of store) {
      if (now < ban.expiresAt) continue;
      store.delete(k);
      saveToDisk();
      try {
        const guild = await client.guilds.fetch(ban.guildId).catch(() => null);
        if (!guild) continue;
        await guild.members.unban(ban.userId, "Tempban expiré");
        await sendLog(client, logEmbed(0x22c55e, "🔓 Tempban expiré — Dé-banni automatiquement", [
          { name: "Membre", value: `${ban.userTag} (\`${ban.userId}\`)`, inline: true },
          { name: "Raison initiale", value: ban.reason },
        ], { tag: "Système", id: "0" }), { guildId: ban.guildId, logType: "ban" });
      } catch (err) {
        logger.warn({ err, userId: ban.userId }, "[tempban] Impossible de débannir");
      }
    }
  };

  setInterval(() => void check(), CHECK_INTERVAL);
  void check();
}
