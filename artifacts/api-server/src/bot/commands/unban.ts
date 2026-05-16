import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Débannit un utilisateur par son ID")
  .addStringOption((o) =>
    o
      .setName("id")
      .setDescription("L'ID de l'utilisateur à débannir")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du débannissement")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.options.getString("id", true);
  const reason =
    interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!interaction.guild) {
    return interaction.reply({ content: "Cette commande n'est disponible que sur un serveur.", ephemeral: true });
  }

  let ban;
  try {
    ban = await interaction.guild.bans.fetch(userId);
  } catch {
    return interaction.reply({
      content: "Cet utilisateur n'est pas banni ou l'ID est invalide.",
      ephemeral: true,
    });
  }

  await interaction.guild.members.unban(userId, reason);

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Utilisateur débanni")
    .addFields(
      { name: "Utilisateur", value: `${ban.user.tag} (\`${userId}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(
      0x22c55e,
      "✅ Utilisateur débanni",
      [
        { name: "Utilisateur", value: `${ban.user.tag} (\`${userId}\`)`, inline: true },
        { name: "Raison", value: reason },
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    )
  );
}
