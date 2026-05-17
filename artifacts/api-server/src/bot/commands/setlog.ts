import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  Message,
} from "discord.js";
import { setLogChannel } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("setlog")
  .setDescription("Définit le salon de logs principal du serveur")
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Le salon de logs").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const channel = interaction.options.getChannel("salon", true) as TextChannel;
  setLogChannel(interaction.guildId, channel.id);

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Salon de logs configuré")
    .addFields(
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      { name: "Type", value: "Logs généraux", inline: true }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

export const prefixName = "setlog";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const channelId = args[0]?.replace(/[<#>]/g, "");
  if (!channelId) { await message.reply("Usage : `&setlog #salon`"); return; }

  const channel = message.guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) { await message.reply("❌ Salon introuvable ou invalide."); return; }

  setLogChannel(message.guild.id, channel.id);

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Salon de logs configuré")
    .addFields(
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      { name: "Type", value: "Logs généraux", inline: true }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
