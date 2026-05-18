import { Client, Events, VoiceState } from "discord.js";

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
const store = new Map<string, VoiceEvent[]>();

function add(guildId: string, event: VoiceEvent) {
  let list = store.get(guildId);
  if (!list) { list = []; store.set(guildId, list); }
  list.unshift(event);
  if (list.length > MAX_PER_GUILD) list.length = MAX_PER_GUILD;
}

export function getVoiceLog(guildId: string): VoiceEvent[] {
  return store.get(guildId) ?? [];
}

export function clearVoiceLog(guildId: string): void {
  store.delete(guildId);
}

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
