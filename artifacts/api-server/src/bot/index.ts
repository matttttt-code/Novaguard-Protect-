import {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  type ApplicationCommandDataResolvable,
} from "discord.js";
import { commands } from "./commands/index.js";
import { logger } from "../lib/logger.js";

export function startBot(): void {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_TOKEN non défini — le bot Discord ne démarrera pas.");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Bot Discord connecté");

    readyClient.user.setActivity("le serveur 🛡️", {
      type: ActivityType.Watching,
    });

    try {
      const commandData = commands.map(
        (c) => c.data.toJSON() as ApplicationCommandDataResolvable
      );
      await readyClient.application.commands.set(commandData);
      logger.info(
        { count: commandData.length },
        "Commandes slash enregistrées avec succès"
      );
    } catch (err) {
      logger.error({ err }, "Erreur lors de l'enregistrement des commandes");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.find(
      (c) => c.data.name === interaction.commandName
    );
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(
        { err, command: interaction.commandName },
        "Erreur lors de l'exécution d'une commande"
      );
      const msg = "Une erreur est survenue lors de l'exécution de cette commande.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  });

  client.on(Events.GuildMemberAdd, (member) => {
    logger.info(
      { guild: member.guild.name, user: member.user.tag },
      "Nouveau membre rejoint"
    );
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Impossible de se connecter à Discord");
  });
}
