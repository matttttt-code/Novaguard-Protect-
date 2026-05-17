import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  Message,
} from "discord.js";
import { setBanLogChannel } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("setbanlog")
  .setDescription("Définit le salon de logs dédié aux bans et blacklists")
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Le salon de logs bans/blacklist").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const channel = interaction.options.getChannel("salon", true) as TextChannel;
  setBanLogChannel(interaction.guildId, channel.id);

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("✅ Salon de logs bans configuré")
    .addFields(
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      { name: "Type", value: "Bans & Blacklist", inline: true }
    )
    .setDescription("Tous les logs de ban, unban, blacklist et antidc seront envoyés dans ce salon.")
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

export const prefixName = "setbanlog";
export const prefixAliases = ["banlog"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const channelId = args[0]?.replace(/[<#>]/g, "");
  if (!channelId) { await message.reply("Usage : `&setbanlog #salon`"); return; }

  const channel = message.guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) { await message.reply("❌ Salon introuvable ou invalide."); return; }

  setBanLogChannel(message.guild.id, channel.id);

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("✅ Salon de logs bans configuré")
    .addFields(
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      { name: "Type", value: "Bans & Blacklist", inline: true }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
