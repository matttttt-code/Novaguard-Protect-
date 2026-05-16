import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("Déverrouille un salon")
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Salon à déverrouiller (défaut : actuel)")
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du déverrouillage")
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
    SendMessages: null,
  });

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("🔓 Salon déverrouillé")
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
      0x22c55e,
      "🔓 Salon déverrouillé",
      [
        { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
        { name: "Raison", value: reason },
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    )
  );
}
