/**
 * Helpers de réponse avec log automatique.
 * Chaque appel envoie la réponse Discord ET enregistre un log bot_reply.
 */
import type { ChatInputCommandInteraction, InteractionResponse, Message } from "discord.js";
import { logBotReply } from "./event-log-store.js";

// ── Slash commands ────────────────────────────────────────────────────────────

export function replyErr(
  interaction: ChatInputCommandInteraction,
  text: string,
): Promise<InteractionResponse<boolean>> {
  logBotReply(interaction.guildId, interaction.commandName, "error", text, interaction.user.id, interaction.user.tag);
  return interaction.reply({ content: text, ephemeral: true });
}

export function replyWarn(
  interaction: ChatInputCommandInteraction,
  text: string,
): Promise<InteractionResponse<boolean>> {
  logBotReply(interaction.guildId, interaction.commandName, "warn", text, interaction.user.id, interaction.user.tag);
  return interaction.reply({ content: text, ephemeral: true });
}

export function replyInfo(
  interaction: ChatInputCommandInteraction,
  text: string,
): Promise<InteractionResponse<boolean>> {
  logBotReply(interaction.guildId, interaction.commandName, "info", text, interaction.user.id, interaction.user.tag);
  return interaction.reply({ content: text, ephemeral: true });
}

// ── Prefix commands ───────────────────────────────────────────────────────────

export function msgErr(
  message: Message,
  commandName: string,
  text: string,
): Promise<Message<boolean>> {
  logBotReply(message.guild?.id ?? null, commandName, "error", text, message.author.id, message.author.tag);
  return message.reply(text);
}

export function msgWarn(
  message: Message,
  commandName: string,
  text: string,
): Promise<Message<boolean>> {
  logBotReply(message.guild?.id ?? null, commandName, "warn", text, message.author.id, message.author.tag);
  return message.reply(text);
}

export function msgInfo(
  message: Message,
  commandName: string,
  text: string,
): Promise<Message<boolean>> {
  logBotReply(message.guild?.id ?? null, commandName, "info", text, message.author.id, message.author.tag);
  return message.reply(text);
}
