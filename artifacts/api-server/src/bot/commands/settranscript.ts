import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  TextChannel,
} from "discord.js";
import { setTranscriptChannel, getConfig } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("settranscript")
  .setDescription("Définit le salon où les transcripts de tickets seront envoyés")
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Salon des transcripts").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const channel = interaction.options.getChannel("salon", true) as TextChannel;
  setTranscriptChannel(interaction.guild.id, channel.id);

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📄 Salon de transcripts configuré")
    .addFields({ name: "Salon", value: `<#${channel.id}>`, inline: true })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

export const prefixName = "settranscript";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Administrateur requis."); return;
  }

  const rawId = args[0]?.replace(/[<#>]/g, "");
  if (!rawId || !/^\d+$/.test(rawId)) {
    await message.reply("Usage : `&settranscript #salon` ou `&settranscript <id_salon>`"); return;
  }

  const cfg = getConfig(message.guild.id);
  void cfg;

  setTranscriptChannel(message.guild.id, rawId);

  await message.reply({ embeds: [
    new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle("📄 Salon de transcripts configuré")
      .addFields({ name: "Salon", value: `<#${rawId}>`, inline: true })
      .setTimestamp(),
  ]});
}
