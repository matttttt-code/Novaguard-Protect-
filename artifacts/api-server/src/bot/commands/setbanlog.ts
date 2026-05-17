import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  TextChannel,
} from "discord.js";
import { setBanLogChannel } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("setbanlog")
  .setDescription("Définit le salon de logs dédié aux bans et blacklists (supporte un autre serveur)")
  .addStringOption((o) =>
    o.setName("salon_id")
      .setDescription("L'ID du salon de logs bans/blacklist (peut être sur un autre serveur)")
      .setRequired(false)
  )
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Le salon de logs bans/blacklist (ce serveur)").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const rawId = interaction.options.getString("salon_id");
  const channelOption = interaction.options.getChannel("salon");

  const channelId = rawId ?? channelOption?.id;
  if (!channelId) {
    return interaction.reply({ content: "❌ Fournis soit un `salon_id` (ID brut), soit un `salon` mention.", ephemeral: true });
  }

  let verified = false;
  try {
    const ch = await interaction.client.channels.fetch(channelId);
    verified = !!ch && ch.isTextBased();
  } catch {
    verified = false;
  }

  if (!verified) {
    return interaction.reply({ content: "❌ Salon introuvable ou inaccessible. Assure-toi que le bot est dans le serveur concerné et a accès au salon.", ephemeral: true });
  }

  setBanLogChannel(interaction.guildId, channelId);

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("✅ Salon de logs bans configuré")
    .addFields(
      { name: "Salon ID", value: `\`${channelId}\``, inline: true },
      { name: "Type", value: "Bans & Blacklist", inline: true }
    )
    .setDescription("Tous les logs de ban, unban, blacklist et antidc seront envoyés dans ce salon.\n> Le salon peut être sur un autre serveur.")
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

  const raw = args[0];
  if (!raw) {
    await message.reply(
      "Usage : `&setbanlog <ID_du_salon>` ou `&setbanlog #salon`\n> L'ID peut être celui d'un salon sur **un autre serveur**."
    ); return;
  }

  const channelId = raw.replace(/[<#>]/g, "");
  if (!/^\d+$/.test(channelId)) {
    await message.reply("❌ ID de salon invalide."); return;
  }

  let channel: TextChannel | null = null;
  try {
    const fetched = await message.client.channels.fetch(channelId);
    if (fetched && fetched.isTextBased()) channel = fetched as TextChannel;
  } catch {
    channel = null;
  }

  if (!channel) {
    await message.reply("❌ Salon introuvable ou inaccessible.\n> Assure-toi que le bot est présent dans le serveur cible et a la permission de voir ce salon."); return;
  }

  setBanLogChannel(message.guild.id, channelId);

  const isExternal = channel.guild?.id !== message.guild.id;
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("✅ Salon de logs bans configuré")
    .addFields(
      { name: "Salon", value: `\`${channelId}\``, inline: true },
      { name: "Serveur", value: isExternal ? `Autre serveur (\`${channel.guild?.name ?? "?"}\`)` : "Ce serveur", inline: true },
      { name: "Type", value: "Bans & Blacklist", inline: true }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
