import { Client, Events, Message } from "discord.js";
import { logger } from "../lib/logger.js";

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

    try {
      await command.execute(message, args);
    } catch (err) {
      logger.error({ err, command: commandName }, "Erreur commande préfixe");
      await message.reply("❌ Une erreur est survenue lors de l'exécution de cette commande.");
    }
  });

  logger.info({ count: commands.length }, "Commandes préfixe enregistrées");
}
