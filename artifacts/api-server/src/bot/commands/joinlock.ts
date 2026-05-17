import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Message,
  EmbedBuilder,
} from "discord.js";
import { setJoinLock, isJoinLocked } from "../guild-config-store.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("joinlock")
  .setDescription("Bloque ou autorise les nouvelles arrivées sur le serveur")
  .addStringOption((o) =>
    o
      .setName("action")
      .setDescription("Activer ou désactiver le verrouillage des arrivées")
      .setRequired(true)
      .addChoices(
        { name: "🔒 Activer — expulser tout nouveau membre", value: "on" },
        { name: "🔓 Désactiver — autoriser les arrivées", value: "off" }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });
    return;
  }

  const action = interaction.options.getString("action", true);
  const enable = action === "on";
  const guildId = interaction.guildId!;

  if (enable === isJoinLocked(guildId)) {
    await interaction.reply({
      content: `ℹ️ Le verrouillage des arrivées est déjà **${enable ? "activé" : "désactivé"}**.`,
      ephemeral: true,
    });
    return;
  }

  setJoinLock(guildId, enable);

  const embed = new EmbedBuilder()
    .setColor(enable ? 0xef4444 : 0x22c55e)
    .setTitle(enable ? "🔒 Verrouillage des arrivées — Activé" : "🔓 Verrouillage des arrivées — Désactivé")
    .setDescription(
      enable
        ? "Tout nouveau membre sera automatiquement expulsé à son arrivée jusqu'à désactivation."
        : "Les membres peuvent de nouveau rejoindre le serveur normalement."
    )
    .addFields({ name: "Modifié par", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  await sendLog(
    interaction.client,
    logEmbed(
      enable ? 0xef4444 : 0x22c55e,
      enable ? "🔒 Join Lock activé" : "🔓 Join Lock désactivé",
      [{ name: "Par", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true }],
      { tag: interaction.user.tag, id: interaction.user.id }
    ),
    { guildId }
  );
}

export const prefixName = "joinlock";
export const prefixAliases = ["join"];

export async function executeMessage(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Tu n'as pas la permission d'utiliser cette commande.");
    return;
  }

  const action = args[0]?.toLowerCase();
  if (action !== "on" && action !== "off") {
    await message.reply("❌ Usage : `&joinlock on` ou `&joinlock off` (alias : `&join on/off`)");
    return;
  }

  const enable = action === "on";
  const guildId = message.guild.id;

  if (enable === isJoinLocked(guildId)) {
    await message.reply(
      `ℹ️ Le verrouillage des arrivées est déjà **${enable ? "activé" : "désactivé"}**.`
    );
    return;
  }

  setJoinLock(guildId, enable);

  const embed = new EmbedBuilder()
    .setColor(enable ? 0xef4444 : 0x22c55e)
    .setTitle(enable ? "🔒 Verrouillage des arrivées — Activé" : "🔓 Verrouillage des arrivées — Désactivé")
    .setDescription(
      enable
        ? "Tout nouveau membre sera automatiquement expulsé à son arrivée jusqu'à désactivation."
        : "Les membres peuvent de nouveau rejoindre le serveur normalement."
    )
    .addFields({ name: "Modifié par", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true })
    .setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(
    message.client,
    logEmbed(
      enable ? 0xef4444 : 0x22c55e,
      enable ? "🔒 Join Lock activé" : "🔓 Join Lock désactivé",
      [{ name: "Par", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true }],
      { tag: message.author.tag, id: message.author.id }
    ),
    { guildId }
  );
}
