import { Client, Events, Message } from "discord.js";
import { logger } from "../lib/logger.js";
import { generateErrorCode, sendPrefixErrorAlert } from "./bot-alerts.js";
import { logCommandExec, logBotError } from "./event-log-store.js";

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
