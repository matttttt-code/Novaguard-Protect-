import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Définit le slowmode d'un salon")
  .addIntegerOption((o) =>
    o
      .setName("secondes")
      .setDescription("Délai en secondes (0 pour désactiver, max 21600)")
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(21600)
  )
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Salon ciblé (défaut : salon actuel)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  const seconds = interaction.options.getInteger("secondes", true);
  const targetChannel =
    (interaction.options.getChannel("salon") as TextChannel | null) ??
    (interaction.channel as TextChannel | null);

  if (!targetChannel || !("rateLimitPerUser" in targetChannel)) {
    return interaction.reply({
      content: "Ce salon ne supporte pas le slowmode.",
      ephemeral: true,
    });
  }

  await targetChannel.setRateLimitPerUser(
    seconds,
    `Slowmode par ${interaction.user.tag}`
  );

  const description =
    seconds === 0
      ? "Slowmode **désactivé**."
      : `Slowmode défini à **${seconds} seconde(s)**.`;

  const embed = new EmbedBuilder()
    .setColor(seconds === 0 ? 0x22c55e : 0x3b82f6)
    .setTitle("🐢 Slowmode")
    .setDescription(description)
    .addFields(
      { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(
      seconds === 0 ? 0x22c55e : 0x3b82f6,
      "🐢 Slowmode modifié",
      [
        { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
        {
          name: "Durée",
          value: seconds === 0 ? "Désactivé" : `${seconds}s`,
          inline: true,
        },
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    )
  );
}
