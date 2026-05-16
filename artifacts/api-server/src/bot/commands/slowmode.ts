import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Définit le slowmode d'un salon")
  .addIntegerOption((o) =>
    o.setName("secondes").setDescription("Délai en secondes (0 pour désactiver, max 21600)").setRequired(true).setMinValue(0).setMaxValue(21600)
  )
  .addChannelOption((o) => o.setName("salon").setDescription("Salon ciblé (défaut : actuel)"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  const seconds = interaction.options.getInteger("secondes", true);
  const targetChannel = (interaction.options.getChannel("salon") as TextChannel | null) ?? (interaction.channel as TextChannel | null);

  if (!targetChannel || !("rateLimitPerUser" in targetChannel)) return interaction.reply({ content: "Ce salon ne supporte pas le slowmode.", ephemeral: true });

  await targetChannel.setRateLimitPerUser(seconds, `Slowmode par ${interaction.user.tag}`);

  const embed = new EmbedBuilder().setColor(seconds === 0 ? 0x22c55e : 0x3b82f6).setTitle("🐢 Slowmode")
    .setDescription(seconds === 0 ? "Slowmode **désactivé**." : `Slowmode défini à **${seconds} seconde(s)**.`)
    .addFields(
      { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true }
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(seconds === 0 ? 0x22c55e : 0x3b82f6, "🐢 Slowmode modifié", [
    { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
    { name: "Durée", value: seconds === 0 ? "Désactivé" : `${seconds}s`, inline: true },
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "slowmode";
export const prefixAliases = ["slow", "sm"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.reply("❌ Permission insuffisante (ManageChannels requise)."); return;
  }

  const seconds = parseInt(args[0] ?? "", 10);
  if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
    await message.reply("Usage : `&slowmode <secondes> [#salon]` — (0 pour désactiver, max 21600)"); return;
  }

  let channel = message.channel as TextChannel;
  if (args[1]) {
    const channelId = args[1].replace(/[<#>]/g, "");
    const found = message.guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (found) channel = found;
  }

  if (!("rateLimitPerUser" in channel)) { await message.reply("❌ Ce salon ne supporte pas le slowmode."); return; }

  await channel.setRateLimitPerUser(seconds, `Slowmode par ${message.author.tag}`);

  const embed = new EmbedBuilder().setColor(seconds === 0 ? 0x22c55e : 0x3b82f6).setTitle("🐢 Slowmode")
    .setDescription(seconds === 0 ? "Slowmode **désactivé**." : `Slowmode défini à **${seconds} seconde(s)**.`)
    .addFields(
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(seconds === 0 ? 0x22c55e : 0x3b82f6, "🐢 Slowmode modifié", [
    { name: "Salon", value: `<#${channel.id}>`, inline: true },
    { name: "Durée", value: seconds === 0 ? "Désactivé" : `${seconds}s`, inline: true },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
