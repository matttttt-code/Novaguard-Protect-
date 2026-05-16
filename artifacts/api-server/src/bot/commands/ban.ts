import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Bannit un membre du serveur")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à bannir").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du bannissement")
  )
  .addIntegerOption((o) =>
    o
      .setName("supprimer_messages")
      .setDescription("Supprimer les messages des X derniers jours (0-7)")
      .setMinValue(0)
      .setMaxValue(7)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason =
    interaction.options.getString("raison") ?? "Aucune raison fournie";
  const deleteMessageSeconds =
    (interaction.options.getInteger("supprimer_messages") ?? 0) * 86400;

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (!member.bannable) {
    return interaction.reply({
      content: "Je ne peux pas bannir ce membre (permissions insuffisantes).",
      ephemeral: true,
    });
  }
  if (member.id === interaction.user.id) {
    return interaction.reply({
      content: "Vous ne pouvez pas vous bannir vous-même.",
      ephemeral: true,
    });
  }

  await member.ban({ reason, deleteMessageSeconds });

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔨 Membre banni")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason },
      {
        name: "Messages supprimés",
        value: deleteMessageSeconds > 0 ? `${deleteMessageSeconds / 86400} jour(s)` : "Aucun",
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(
      0xef4444,
      "🔨 Membre banni",
      [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Raison", value: reason },
        {
          name: "Messages supprimés",
          value: deleteMessageSeconds > 0 ? `${deleteMessageSeconds / 86400} jour(s)` : "Aucun",
          inline: true,
        },
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    )
  );
}
