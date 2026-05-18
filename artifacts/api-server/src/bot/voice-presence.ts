import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  getVoiceConnection,
} from "@discordjs/voice";
import { ChannelType, Guild } from "discord.js";
import { logger } from "../lib/logger.js";

export interface VoicePresenceState {
  channelId: string;
  channelName: string;
  selfMute: boolean;
  selfDeaf: boolean;
  connected: boolean;
}

const presenceMap = new Map<string, VoicePresenceState>();

function sendVoiceStateUpdate(guild: Guild, channelId: string | null, selfMute: boolean, selfDeaf: boolean) {
  guild.shard.send({
    op: 4,
    d: {
      guild_id: guild.id,
      channel_id: channelId,
      self_mute: selfMute,
      self_deaf: selfDeaf,
    },
  });
}

export async function joinVoicePresence(
  guild: Guild,
  channelId: string,
  selfMute: boolean,
  selfDeaf: boolean
): Promise<void> {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error("Salon vocal introuvable ou non accessible");
  }

  const existing = getVoiceConnection(guild.id);
  if (existing) existing.destroy();

  const connection = joinVoiceChannel({
    channelId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfMute,
    selfDeaf,
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    const state = presenceMap.get(guild.id);
    if (state) presenceMap.set(guild.id, { ...state, connected: false });
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    presenceMap.delete(guild.id);
  });

  presenceMap.set(guild.id, {
    channelId,
    channelName: channel.name,
    selfMute,
    selfDeaf,
    connected: true,
  });

  logger.info({ guildId: guild.id, channelId, selfMute, selfDeaf }, "[voice-presence] Bot rejoint le salon vocal");
}

export function leaveVoicePresence(guildId: string): void {
  const connection = getVoiceConnection(guildId);
  if (connection) connection.destroy();
  presenceMap.delete(guildId);
  logger.info({ guildId }, "[voice-presence] Bot a quitté le salon vocal");
}

export function updateVoicePresence(
  guild: Guild,
  patch: { selfMute?: boolean; selfDeaf?: boolean }
): VoicePresenceState {
  const state = presenceMap.get(guild.id);
  if (!state || !state.connected) throw new Error("Le bot n'est pas dans un salon vocal");

  const newSelfMute = patch.selfMute ?? state.selfMute;
  const newSelfDeaf = patch.selfDeaf ?? state.selfDeaf;

  sendVoiceStateUpdate(guild, state.channelId, newSelfMute, newSelfDeaf);

  const updated: VoicePresenceState = {
    ...state,
    selfMute: newSelfMute,
    selfDeaf: newSelfDeaf,
  };
  presenceMap.set(guild.id, updated);
  return updated;
}

export function getVoicePresenceState(guildId: string): VoicePresenceState | null {
  const state = presenceMap.get(guildId);
  if (!state) return null;
  const connection = getVoiceConnection(guildId);
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    presenceMap.delete(guildId);
    return null;
  }
  return { ...state, connected: true };
}
