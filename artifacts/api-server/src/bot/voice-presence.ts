import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
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

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  } catch (err) {
    connection.destroy();
    throw new Error("Impossible de rejoindre le salon vocal (timeout)");
  }

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

export async function updateVoicePresence(
  guild: Guild,
  patch: { selfMute?: boolean; selfDeaf?: boolean }
): Promise<VoicePresenceState> {
  const state = presenceMap.get(guild.id);
  if (!state || !state.connected) throw new Error("Le bot n'est pas dans un salon vocal");

  const newSelfMute = patch.selfMute ?? state.selfMute;
  const newSelfDeaf = patch.selfDeaf ?? state.selfDeaf;

  const existing = getVoiceConnection(guild.id);
  if (existing) existing.destroy();

  const channel = guild.channels.cache.get(state.channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error("Salon vocal introuvable");
  }

  const connection = joinVoiceChannel({
    channelId: state.channelId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfMute: newSelfMute,
    selfDeaf: newSelfDeaf,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  } catch {
    connection.destroy();
    throw new Error("Impossible de mettre à jour la présence vocale");
  }

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    const s = presenceMap.get(guild.id);
    if (s) presenceMap.set(guild.id, { ...s, connected: false });
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    presenceMap.delete(guild.id);
  });

  const updated: VoicePresenceState = {
    ...state,
    selfMute: newSelfMute,
    selfDeaf: newSelfDeaf,
    connected: true,
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
  return { ...state, connected: connection.state.status === VoiceConnectionStatus.Ready };
}
