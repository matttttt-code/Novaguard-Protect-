import {
  Client,
  Events,
  Message,
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { sendLog, logEmbed, LOG_CHANNEL_ID } from "./log.js";
import { sendSanctionDM } from "./dm-notify.js";
import { addWarning } from "./warnings-store.js";

const SPAM_LIMIT = 5;
const SPAM_WINDOW_MS = 5000;
const EMOJI_LIMIT = 5;
const TIMEOUT_DURATION_MS = 24 * 60 * 60 * 1000;
const MIN_CAPS_LENGTH = 8;
const AUTOMOD_SLOWMODE_SECONDS = 5;

const messageTimestamps = new Map<string, number[]>();

function countEmojis(text: string): number {
  const unicodeEmojis = [...text].filter((char) => {
    const cp = char.codePointAt(0) ?? 0;
    return (
      (cp >= 0x1f600 && cp <= 0x1f64f) || (cp >= 0x1f300 && cp <= 0x1f5ff) ||
      (cp >= 0x1f680 && cp <= 0x1f6ff) || (cp >= 0x1f700 && cp <= 0x1f77f) ||
      (cp >= 0x1f780 && cp <= 0x1f7ff) || (cp >= 0x1f800 && cp <= 0x1f8ff) ||
      (cp >= 0x1f900 && cp <= 0x1f9ff) || (cp >= 0x1fa00 && cp <= 0x1fa6f) ||
      (cp >= 0x1fa70 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x26ff) ||
      (cp >= 0x2700 && cp <= 0x27bf)
    );
  });
  const customEmojis = text.match(/<a?:\w+:\d+>/g) ?? [];
  return unicodeEmojis.length + customEmojis.length;
}

function containsLink(text: string): boolean {
  return /https?:\/\/\S+|www\.\S+/i.test(text);
}

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length < MIN_CAPS_LENGTH) return false;
  return letters === letters.toUpperCase();
}

async function applySlowmode(channel: TextChannel, seconds: number): Promise<void> {
  try {
    if ("rateLimitPerUser" in channel) {
      await channel.setRateLimitPerUser(seconds, "Auto-Mod — slowmode post-expulsion");
      setTimeout(async () => {
        await channel.setRateLimitPerUser(0, "Auto-Mod — slowmode retiré").catch(() => null);
      }, 60_000);
    }
  } catch {
    // ignore
  }
}

async function applyTimeout(member: GuildMember, reason: string, message: Message): Promise<void> {
  if (!member.moderatable) return;

  try {
    await message.delete().catch(() => null);
    await member.timeout(TIMEOUT_DURATION_MS, reason);
    await sendSanctionDM(member.user, "automod-timeout", reason, message.guild!, "Durée : 24 heures");

    const embed = logEmbed(
      0xa855f7, "🤖 Auto-mod — Timeout",
      [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Durée", value: "24 heures", inline: true },
        { name: "Raison", value: reason },
        { name: "Salon", value: `<#${message.channelId}>`, inline: true },
      ],
      { tag: "Auto-Mod", id: message.client.user!.id }
    );
    await sendLog(message.client, embed, { guildId: message.guildId ?? undefined });
  } catch (err) {
    logger.error({ err }, "Erreur auto-mod timeout");
  }
}

async function applyKick(member: GuildMember, reason: string, message: Message): Promise<void> {
  if (!member.kickable) return;

  try {
    await message.delete().catch(() => null);

    if (message.guildId) {
      addWarning(message.guildId, member.id, {
        reason,
        moderator: "Auto-Mod",
        moderatorId: message.client.user!.id,
        timestamp: new Date(),
      });
    }

    await sendSanctionDM(member.user, "automod-kick", reason, message.guild!);
    await member.kick(reason);

    const channel = message.channel as TextChannel;
    await applySlowmode(channel, AUTOMOD_SLOWMODE_SECONDS);

    const embed = logEmbed(
      0xf59e0b, "🤖 Auto-mod — Expulsion (spam)",
      [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Raison", value: reason },
        { name: "Salon", value: `<#${message.channelId}>`, inline: true },
        { name: "Slowmode", value: `${AUTOMOD_SLOWMODE_SECONDS}s activé (1 min)`, inline: true },
      ],
      { tag: "Auto-Mod", id: message.client.user!.id }
    );
    await sendLog(message.client, embed, { guildId: message.guildId ?? undefined });
  } catch (err) {
    logger.error({ err }, "Erreur auto-mod kick");
  }
}

export function registerAutoMod(client: Client, contentIntentEnabled: boolean): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (!message.guild || message.author.bot) return;
    if (message.channelId === LOG_CHANNEL_ID) return;
    if (message.content.startsWith("&")) return;

    const member = message.member as GuildMember | null;
    if (!member) return;
    if (member.permissions.has("ManageMessages")) return;

    const key = `${message.guildId}-${message.author.id}`;
    const now = Date.now();

    const timestamps = (messageTimestamps.get(key) ?? []).filter((t) => now - t < SPAM_WINDOW_MS);
    timestamps.push(now);
    messageTimestamps.set(key, timestamps);

    if (timestamps.length >= SPAM_LIMIT) {
      messageTimestamps.delete(key);
      await applyKick(member, `Spam : ${SPAM_LIMIT} messages en moins de ${SPAM_WINDOW_MS / 1000} secondes`, message);
      return;
    }

    if (!contentIntentEnabled) return;

    const content = message.content;
    if (!content) return;

    if (countEmojis(content) > EMOJI_LIMIT) {
      await applyTimeout(member, `Spam d'emojis : plus de ${EMOJI_LIMIT} emojis par message`, message);
      return;
    }

    if (containsLink(content)) {
      await applyTimeout(member, "Lien non autorisé détecté", message);
      return;
    }

    if (isAllCaps(content)) {
      await applyTimeout(member, "Message entièrement en majuscules", message);
      return;
    }
  });

  logger.info({ contentDetection: contentIntentEnabled }, "Système anti-spam enregistré");
}
