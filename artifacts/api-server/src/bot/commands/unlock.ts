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
  .setName("unlock")
  .setDescription("Déverrouille un salon")
  .addChannelOption((o) => o.setName("salon").setDescription("Salon à déverrouiller (défaut : actuel)"))
  .addStringOption((o) => o.setName("raison").setDescription("Raison du déverrouillage"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetChannel = (interaction.options.getChannel("salon") as TextChannel | null) ?? (interaction.channel as TextChannel | null);
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!targetChannel || !interaction.guild) return interaction.reply({ content: "Salon introuvable.", ephemeral: true });

  await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });

  const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("🔓 Salon déverrouillé")
    .addFields(
      { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason }
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0x22c55e, "🔓 Salon déverrouillé", [
    { name: "Salon", value: `<#${targetChannel.id}>`, inline: true },
    { name: "Raison", value: reason },
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "unlock";
export const prefixAliases = ["ouvrir"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.reply("❌ Permission insuffisante (ManageChannels requise)."); return;
  }

  let channel = message.channel as TextChannel;
  let reasonStart = 0;

  if (args[0] && args[0].startsWith("<#")) {
    const channelId = args[0].replace(/[<#>]/g, "");
    const found = message.guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (found) { channel = found; reasonStart = 1; }
  }

  const reason = args.slice(reasonStart).join(" ") || "Aucune raison fournie";

  await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });

  const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("🔓 Salon déverrouillé")
    .addFields(
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Raison", value: reason }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(0x22c55e, "🔓 Salon déverrouillé", [
    { name: "Salon", value: `<#${channel.id}>`, inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
