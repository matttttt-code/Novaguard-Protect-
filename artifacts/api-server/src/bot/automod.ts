import {
  Client,
  Events,
  Message,
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { sendLog, logEmbed } from "./log.js";
import { getConfig, isRaidMode2 } from "./guild-config-store.js";
import { sendSanctionDM, sendLogDM } from "./dm-notify.js";
import { addWarning } from "./warnings-store.js";
import { getAntilinkConfig } from "./antilink-store.js";

const SPAM_LIMIT = 5;
const SPAM_WINDOW_MS = 5000;
const EMOJI_LIMIT = 5;
const TIMEOUT_24H_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_1H_MS = 60 * 60 * 1000;
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

function detectInsult(text: string, words: string[]): string | null {
  const lower = text.toLowerCase();
  for (const w of words) {
    if (lower.includes(w)) return w;
  }
  return null;
}

async function sendChannelAlert(message: Message, text: string, color = 0xef4444): Promise<void> {
  try {
    const channel = message.channel as TextChannel;
    const alert = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setDescription(text)
          .setFooter({ text: "Auto-Mod · Supprimé dans 8 secondes" }),
      ],
    }).catch(() => null);
    if (alert) setTimeout(() => alert.delete().catch(() => null), 8_000);
  } catch { /* ignore */ }
}

async function applySlowmode(channel: TextChannel, seconds: number): Promise<void> {
  try {
    if ("rateLimitPerUser" in channel) {
      await channel.setRateLimitPerUser(seconds, "Auto-Mod — slowmode post-expulsion");
      setTimeout(async () => {
        await channel.setRateLimitPerUser(0, "Auto-Mod — slowmode retiré").catch(() => null);
      }, 3_600_000);
    }
  } catch { /* ignore */ }
}

async function applyTimeout(member: GuildMember, reason: string, message: Message, durationMs = TIMEOUT_24H_MS): Promise<void> {
  if (!member.moderatable) return;
  const label = durationMs >= TIMEOUT_24H_MS ? "24h" : "1h";
  try {
    await message.delete().catch(() => null);
    await member.timeout(durationMs, reason);
    await sendChannelAlert(message, `⏱️ <@${member.id}> a reçu un **timeout ${label}** — ${reason}`, 0xa855f7);
    await sendSanctionDM(member.user, "automod-timeout", reason, message.guild!, `Durée : ${label}`);
    await sendLog(message.client, logEmbed(
      0xa855f7, "🤖 Auto-mod — Timeout",
      [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Durée", value: label, inline: true },
        { name: "Raison", value: reason },
        { name: "Salon", value: `<#${message.channelId}>`, inline: true },
      ],
      { tag: "Auto-Mod", id: message.client.user!.id }
    ), { guildId: message.guildId ?? undefined });
  } catch (err) {
    logger.error({ err }, "Erreur auto-mod timeout");
  }
}

async function applyWarn(member: GuildMember, reason: string, message: Message): Promise<void> {
  try {
    await message.delete().catch(() => null);
    await sendChannelAlert(message, `⚠️ <@${member.id}> a reçu un **avertissement** — ${reason}`, 0xf59e0b);
    if (message.guildId) {
      addWarning(message.guildId, member.id, {
        reason,
        moderator: "Auto-Mod",
        moderatorId: message.client.user!.id,
        timestamp: new Date(),
      });
    }
    await sendSanctionDM(member.user, "automod-warn", reason, message.guild!);
    await sendLog(message.client, logEmbed(
      0xf59e0b, "🤖 Auto-mod — Avertissement",
      [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Raison", value: reason },
        { name: "Salon", value: `<#${message.channelId}>`, inline: true },
      ],
      { tag: "Auto-Mod", id: message.client.user!.id }
    ), { guildId: message.guildId ?? undefined });
  } catch (err) {
    logger.error({ err }, "Erreur auto-mod warn");
  }
}

async function applyKick(member: GuildMember, reason: string, message: Message): Promise<void> {
  if (!member.kickable) return;
  try {
    await message.delete().catch(() => null);
    await sendChannelAlert(message, `🚫 <@${member.id}> a été **expulsé** — ${reason}`, 0xef4444);
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
    await sendLog(message.client, logEmbed(
      0xf59e0b, "🤖 Auto-mod — Expulsion (spam)",
      [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Raison", value: reason },
        { name: "Salon", value: `<#${message.channelId}>`, inline: true },
        { name: "Slowmode", value: `${AUTOMOD_SLOWMODE_SECONDS}s activé (1 heure)`, inline: true },
      ],
      { tag: "Auto-Mod", id: message.client.user!.id }
    ), { guildId: message.guildId ?? undefined });
  } catch (err) {
    logger.error({ err }, "Erreur auto-mod kick");
  }
}

export function registerAutoMod(client: Client, contentIntentEnabled: boolean): void {

  // ── Anti-webhook : suppression automatique des messages de webhooks ──
  client.on(Events.MessageCreate, async (message: Message) => {
    if (!message.guild || !message.webhookId || !message.guildId) return;
    const cfg = getConfig(message.guildId);
    if (!cfg.antiWebhookEnabled) return;

    try {
      const preview = message.content ? message.content.slice(0, 300) : "*Embed / aucun texte*";
      await message.delete().catch(() => null);

      await sendLog(client, logEmbed(
        0xf97316, "🔗 Anti-Webhook — Message supprimé",
        [
          { name: "Webhook ID", value: `\`${message.webhookId}\``, inline: true },
          { name: "Salon", value: `<#${message.channelId}>`, inline: true },
          { name: "Contenu", value: preview },
        ],
        { tag: "Auto-Mod", id: client.user!.id }
      ), { guildId: message.guildId });

      await sendLogDM(client, new EmbedBuilder()
        .setColor(0xf97316)
        .setTitle("🔗 Alerte — Message webhook supprimé")
        .addFields(
          { name: "Serveur", value: `${message.guild.name} (\`${message.guildId}\`)`, inline: true },
          { name: "Salon", value: `<#${message.channelId}>`, inline: true },
          { name: "Webhook ID", value: `\`${message.webhookId}\``, inline: true },
          { name: "Contenu", value: preview },
        )
        .setTimestamp()
      ).catch(() => null);

    } catch (err) {
      logger.error({ err }, "Erreur anti-webhook");
    }
  });

  // ── Anti-spam + anti-insulte + émoji/lien/majuscules ──
  client.on(Events.MessageCreate, async (message: Message) => {
    if (!message.guild || message.author.bot) return;
    if (message.guildId && message.channelId === getConfig(message.guildId).logChannelId) return;
    if (message.content.startsWith("&")) return;

    const member = message.member as GuildMember | null;
    if (!member) return;
    if (member.permissions.has("ManageMessages")) return;

    const cfg = getConfig(message.guildId!);
    const secLvl = cfg.securityLevel;

    const key = `${message.guildId}-${message.author.id}`;
    const now = Date.now();
    const isN2Active = isRaidMode2(message.guildId!);
    const spamLimit = isN2Active ? 3 : SPAM_LIMIT;
    const spamWindow = isN2Active ? 3000 : SPAM_WINDOW_MS;
    const timestamps = (messageTimestamps.get(key) ?? []).filter((t) => now - t < spamWindow);
    timestamps.push(now);
    messageTimestamps.set(key, timestamps);

    if (timestamps.length >= spamLimit) {
      messageTimestamps.delete(key);
      await applyKick(member, `Spam : ${spamLimit} messages en moins de ${spamWindow / 1000}s${isN2Active ? " (Anti-Raid N2)" : ""}`, message);
      return;
    }

    if (!contentIntentEnabled) return;

    const content = message.content;
    if (!content) return;

    // ── Anti-insulte (tous niveaux — timeout 24h) ──
    if (cfg.antiInsultEnabled && cfg.antiInsultWords.length > 0) {
      const found = detectInsult(content, cfg.antiInsultWords);
      if (found) {
        await applyTimeout(member, `Insulte détectée : \`${found}\``, message, TIMEOUT_24H_MS);
        return;
      }
    }

    if (countEmojis(content) > EMOJI_LIMIT) {
      await applyTimeout(member, `Spam d'emojis : plus de ${EMOJI_LIMIT} emojis par message`, message);
      return;
    }

    if (containsLink(content)) {
      const antilinkCfg = getAntilinkConfig(message.guildId!);
      if (antilinkCfg.enabled) {
        const urlMatch = content.match(/https?:\/\/([^/\s]+)|www\.([^/\s]+)/i);
        const domain = (urlMatch?.[1] ?? urlMatch?.[2] ?? "").toLowerCase();
        const isAllowed = antilinkCfg.allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
        if (!isAllowed) {
          if (antilinkCfg.action === "timeout") {
            await applyTimeout(member, "Lien non autorisé détecté (anti-lien)", message, antilinkCfg.timeoutMinutes * 60 * 1000);
          } else if (antilinkCfg.action === "warn") {
            await applyWarn(member, "Lien non autorisé détecté (anti-lien)", message);
          } else {
            await message.delete().catch(() => null);
            await sendChannelAlert(message, `🗑️ Message de <@${member.id}> supprimé — lien non autorisé.`, 0x6b7280);
          }
          return;
        }
      }
    }

    if (isAllCaps(content)) {
      await applyTimeout(member, "Message entièrement en majuscules", message);
      return;
    }
  });

  logger.info({ contentDetection: contentIntentEnabled }, "Système anti-spam + anti-insulte + anti-webhook enregistrés");
}
