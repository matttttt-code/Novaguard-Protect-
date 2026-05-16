import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  PermissionsBitField,
  EmbedBuilder,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("lock")
  .setDescription("Verrouille un salon (empêche l'envoi de messages)")
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Salon à verrouiller (défaut : actuel)")
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du verrouillage")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetChannel =
    (interaction.options.getChannel("salon") as TextChannel | null) ??
    (interaction.channel as TextChannel | null);
  const reason =
    interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!targetChannel || !interaction.guild) {
    return interaction.reply({
      content: "Salon introuvable.",
      ephemeral: true,
    });
  }

  const everyone = interaction.guild.roles.everyone;

  await targetChannel.permissionOverwrites.edit(everyone, {
    SendMessages: false,
  });

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔒 Salon verrouillé")
    .addFields(
      { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(
      0xef4444,
      "🔒 Salon verrouillé",
      [
        { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
        { name: "Raison", value: reason },
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    )
  );
}
