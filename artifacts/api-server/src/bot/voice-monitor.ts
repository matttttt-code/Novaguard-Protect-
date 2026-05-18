import { Client, Events, VoiceState } from "discord.js";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface VoiceEvent {
  timestamp: string;
  guildId: string;
  userId: string;
  userTag: string;
  type: string;
  channelId: string | null;
  channelName: string | null;
  fromChannelId?: string | null;
  fromChannelName?: string | null;
}

const MAX_PER_GUILD = 500;
const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "voice-log.json");

const store = new Map<string, VoiceEvent[]>();

// ── Persistance ───────────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await mkdir(DATA_DIR, { recursive: true });
      const obj: Record<string, VoiceEvent[]> = {};
      for (const [guildId, events] of store) obj[guildId] = events;
      await writeFile(FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (e) {
      logger.error({ err: e }, "[voice-monitor] Erreur sauvegarde");
    }
  }, 2000);
}

async function load(): Promise<void> {
  try {
    const raw = await readFile(FILE, "utf-8");
    const obj = JSON.parse(raw) as Record<string, VoiceEvent[]>;
    for (const [guildId, events] of Object.entries(obj)) {
      if (Array.isArray(events)) store.set(guildId, events);
    }
    const total = [...store.values()].reduce((n, e) => n + e.length, 0);
    logger.info({ guilds: store.size, total }, "[voice-monitor] Historique vocal chargé");
  } catch { /* premier démarrage ou fichier absent */ }
}

void load();

// ── API ───────────────────────────────────────────────────────────────────────

function add(guildId: string, event: VoiceEvent) {
  let list = store.get(guildId);
  if (!list) { list = []; store.set(guildId, list); }
  list.unshift(event);
  if (list.length > MAX_PER_GUILD) list.length = MAX_PER_GUILD;
  scheduleSave();
}

export function getVoiceLog(guildId: string): VoiceEvent[] {
  return store.get(guildId) ?? [];
}

export function clearVoiceLog(guildId: string): void {
  store.delete(guildId);
  scheduleSave();
}

// ── Listener Discord ──────────────────────────────────────────────────────────

export function registerVoiceMonitor(client: Client): void {
  client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
    const user = newState.member?.user ?? oldState.member?.user;
    if (!user || user.bot) return;
    const guildId = newState.guild.id;
    const base = { timestamp: new Date().toISOString(), guildId, userId: user.id, userTag: user.tag };

    if (!oldState.channelId && newState.channelId) {
      add(guildId, { ...base, type: "join", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
    } else if (oldState.channelId && !newState.channelId) {
      add(guildId, { ...base, type: "leave", channelId: oldState.channelId, channelName: oldState.channel?.name ?? null });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      add(guildId, { ...base, type: "move", channelId: newState.channelId, channelName: newState.channel?.name ?? null, fromChannelId: oldState.channelId, fromChannelName: oldState.channel?.name ?? null });
    } else {
      if (oldState.selfMute !== newState.selfMute)
        add(guildId, { ...base, type: newState.selfMute ? "mute" : "unmute", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
      if (oldState.selfDeaf !== newState.selfDeaf)
        add(guildId, { ...base, type: newState.selfDeaf ? "sourd" : "non-sourd", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
      if (oldState.serverMute !== newState.serverMute)
        add(guildId, { ...base, type: newState.serverMute ? "mute-serveur" : "unmute-serveur", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
      if (oldState.serverDeaf !== newState.serverDeaf)
        add(guildId, { ...base, type: newState.serverDeaf ? "sourd-serveur" : "non-sourd-serveur", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
      if (!oldState.streaming && newState.streaming)
        add(guildId, { ...base, type: "stream-début", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
      if (oldState.streaming && !newState.streaming)
        add(guildId, { ...base, type: "stream-fin", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
      if (!oldState.selfVideo && newState.selfVideo)
        add(guildId, { ...base, type: "caméra", channelId: newState.channelId, channelName: newState.channel?.name ?? null });
    }
  });
}
