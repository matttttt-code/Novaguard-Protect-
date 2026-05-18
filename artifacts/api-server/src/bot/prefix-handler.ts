import { Client, Events, Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { logger } from "../lib/logger.js";
import { generateErrorCode, sendPrefixErrorAlert } from "./bot-alerts.js";
import { logCommandExec, logBotError } from "./event-log-store.js";
import { isQuarantined, addQuarantine } from "./quarantine-store.js";
import { recordStaffCommand, RATE_THRESHOLD, RATE_WINDOW_SECONDS } from "./staff-ratelimit.js";
import { sendLogDM } from "./dm-notify.js";

export const PREFIX = "&";

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  execute: (message: Message, args: string[]) => Promise<void>;
}

export function registerPrefixHandler(
  client: Client,
  commands: PrefixCommand[]
): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const command = commands.find(
      (c) => c.name === commandName || (c.aliases ?? []).includes(commandName)
    );
    if (!command) return;

    const guildId = message.guild?.id ?? null;

    // ── Quarantaine + limite de taux staff ────────────────────────────────────
    if (message.guild && message.member) {
      if (isQuarantined(message.guild.id, message.author.id)) {
        await message.reply("🔒 Vous êtes en **quarantaine**. Seul un propriétaire du bot peut vous libérer depuis le panel owner.").catch(() => null);
        return;
      }
      if (message.guild.ownerId !== message.author.id) {
        const STAFF_PERMS = [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageGuild];
        const isStaff = STAFF_PERMS.some((p) => message.member!.permissions.has(p));
        if (isStaff) {
          const { exceeded, count } = recordStaffCommand(message.guild.id, message.author.id);
          if (exceeded) {
            const reason = `Utilisation excessive de commandes (${count} en ${RATE_WINDOW_SECONDS}s)`;
            addQuarantine({ userId: message.author.id, userTag: message.author.tag, guildId: message.guild.id, reason, triggerCount: count, windowSeconds: RATE_WINDOW_SECONDS, timestamp: new Date().toISOString() });
            try { await message.member.disableCommunicationUntil(new Date(Date.now() + 27 * 24 * 3600 * 1000), reason); } catch { /* perm manquante */ }
            void sendLogDM(client, new EmbedBuilder().setTitle("🔒 Quarantaine automatique").setDescription(`<@${message.author.id}> (\`${message.author.tag}\`) sur **${message.guild.name}**\n> ${reason}`).setColor(0xef4444).setTimestamp()).catch(() => null);
            await message.reply("🔒 Vous avez été mis en **quarantaine** pour utilisation excessive de commandes. Un propriétaire du bot doit vous libérer depuis le panel owner.").catch(() => null);
            return;
          }
        }
      }
    }

    try {
      await command.execute(message, args);
      logCommandExec(guildId, commandName, "prefix", message.author.tag, message.author.id, true);
    } catch (err) {
      const errCode = generateErrorCode();
      logger.error({ err, errCode, command: commandName }, "Erreur commande préfixe");
      logCommandExec(guildId, commandName, "prefix", message.author.tag, message.author.id, false);
      logBotError(guildId, errCode, commandName, err instanceof Error ? err.message : String(err));
      void sendPrefixErrorAlert(
        client,
        commandName,
        message.guild?.name ?? null,
        message.author.id,
        err,
        errCode,
      ).catch(() => null);
      try {
        await message.reply(`❌ Une erreur est survenue (code : \`${errCode}\`). Transmets ce code au support.`);
      } catch { /* message supprimé */ }
    }
  });

  logger.info({ count: commands.length }, "Commandes préfixe enregistrées");
}
