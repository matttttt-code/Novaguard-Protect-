/**
 * Protection anti-abus via journal d'audit — anti-move, anti-mute,
 * anti-disconnect, anti-bot.
 *
 * Écoute `guildAuditLogEntryCreate` (intent GuildModeration requis).
 * Lorsqu'une action protégée est détectée, timeout l'exécuteur 1 heure
 * (ou expulse le bot ajouté).
 */

import { AuditLogEvent, Client, Guild, GuildAuditLogsEntry } from "discord.js";
import { getConfig } from "./guild-config-store.js";
import { logger } from "../lib/logger.js";
import { sendLog, logEmbed } from "./log.js";

const TIMEOUT_DURATION_MS = 60 * 60 * 1_000;

async function timeoutExecutor(
  guild: Guild,
  executorId: string | null,
  reason: string,
  client: Client,
): Promise<void> {
  if (!executorId) return;
  if (executorId === client.user?.id) return;
  if (guild.ownerId === executorId) return;

  try {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;
    if (!member.manageable) return;
    await member.timeout(TIMEOUT_DURATION_MS, reason);
    logger.info({ guild: guild.name, executorId, reason }, "Anti-abus : exécuteur mis en timeout");
  } catch (err) {
    logger.warn({ err, executorId }, "Anti-abus : impossible de timeout l'exécuteur");
  }
}

export function registerAuditProtection(client: Client): void {
  client.on("guildAuditLogEntryCreate" as never, async (entry: GuildAuditLogsEntry, guild: Guild) => {
    const cfg = getConfig(guild.id);

    // ── Anti-move (déplacement de membres en vocal) ───────────────────────────
    if (cfg.antiMoveEnabled && entry.action === AuditLogEvent.MemberMove) {
      const executorTag = entry.executor?.tag ?? entry.executorId;
      const count = (entry.extra as { count: number } | undefined)?.count ?? 1;
      await timeoutExecutor(guild, entry.executorId, "[Anti-Move] Déplacement de membres en vocal détecté", client);
      await sendLog(client, logEmbed(0xf97316, "🔀 Anti-Move — Exécuteur sanctionné", [
        { name: "Exécuteur", value: `${executorTag} (\`${entry.executorId}\`)`, inline: true },
        { name: "Membres déplacés", value: `${count}`, inline: true },
        { name: "Sanction", value: "Timeout 1 heure", inline: true },
      ], { tag: client.user!.tag, id: client.user!.id }), { guildId: guild.id });
    }

    // ── Anti-disconnect (déconnexion de membres en vocal) ────────────────────
    if (cfg.antiDisconnectEnabled && entry.action === AuditLogEvent.MemberDisconnect) {
      const executorTag = entry.executor?.tag ?? entry.executorId;
      const count = (entry.extra as { count: number } | undefined)?.count ?? 1;
      await timeoutExecutor(guild, entry.executorId, "[Anti-Disconnect] Déconnexion de membres détectée", client);
      await sendLog(client, logEmbed(0xef4444, "🔌 Anti-Disconnect — Exécuteur sanctionné", [
        { name: "Exécuteur", value: `${executorTag} (\`${entry.executorId}\`)`, inline: true },
        { name: "Membres déconnectés", value: `${count}`, inline: true },
        { name: "Sanction", value: "Timeout 1 heure", inline: true },
      ], { tag: client.user!.tag, id: client.user!.id }), { guildId: guild.id });
    }

    // ── Anti-mute (mute serveur de membres) ──────────────────────────────────
    if (cfg.antiMuteEnabled && entry.action === AuditLogEvent.MemberUpdate) {
      const muteChange = (entry.changes as { key: string; new?: unknown }[])
        .find((c) => c.key === "$mute" && c.new === true);
      if (muteChange) {
        const executorTag = entry.executor?.tag ?? entry.executorId;
        const targetId = entry.targetId;
        await timeoutExecutor(guild, entry.executorId, "[Anti-Mute] Mute serveur détecté", client);
        // Reverse the mute
        if (targetId) {
          const target = await guild.members.fetch(targetId).catch(() => null);
          if (target) await target.voice.setMute(false, "[Anti-Mute] Révoqué automatiquement").catch(() => null);
        }
        await sendLog(client, logEmbed(0x8b5cf6, "🔇 Anti-Mute — Exécuteur sanctionné", [
          { name: "Exécuteur", value: `${executorTag} (\`${entry.executorId}\`)`, inline: true },
          { name: "Cible", value: `\`${targetId}\``, inline: true },
          { name: "Sanction", value: "Timeout 1h + mute révoqué", inline: true },
        ], { tag: client.user!.tag, id: client.user!.id }), { guildId: guild.id });
      }
    }

    // ── Anti-bot (ajout d'un bot) ─────────────────────────────────────────────
    if (cfg.antiBotEnabled && entry.action === AuditLogEvent.BotAdd) {
      const executorTag = entry.executor?.tag ?? entry.executorId;
      const botId = entry.targetId;
      let kicked = false;
      if (botId) {
        const addedBot = await guild.members.fetch(botId).catch(() => null);
        if (addedBot?.user.bot) {
          await addedBot.kick("[Anti-Bot] Ajout de bot non autorisé").catch(() => null);
          kicked = true;
        }
      }
      await timeoutExecutor(guild, entry.executorId, "[Anti-Bot] Ajout de bot non autorisé", client);
      await sendLog(client, logEmbed(0x0ea5e9, "🤖 Anti-Bot — Bot expulsé", [
        { name: "Ajouté par", value: `${executorTag} (\`${entry.executorId}\`)`, inline: true },
        { name: "Bot", value: botId ? `\`${botId}\`` : "inconnu", inline: true },
        { name: "Expulsé", value: kicked ? "✅ Oui" : "❌ Déjà parti", inline: true },
        { name: "Sanction exécuteur", value: "Timeout 1 heure", inline: true },
      ], { tag: client.user!.tag, id: client.user!.id }), { guildId: guild.id });
    }
  });
}
