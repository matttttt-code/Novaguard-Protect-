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
  .setName("purge")
  .setDescription("Supprime les messages d'un utilisateur spécifique dans le salon")
  .addUserOption((o) => o.setName("membre").setDescription("Le membre dont supprimer les messages").setRequired(true))
  .addIntegerOption((o) => o.setName("nombre").setDescription("Nombre de messages à analyser (1-200, défaut 100)").setMinValue(1).setMaxValue(200))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("membre", true);
  const limit = interaction.options.getInteger("nombre") ?? 100;
  const channel = interaction.channel as TextChannel | null;

  if (!interaction.guildId || !channel?.isTextBased()) return interaction.reply({ content: "Salon texte uniquement.", ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const fetched = await channel.messages.fetch({ limit: Math.min(limit, 100) });
  const toDelete = fetched.filter((m) => m.author.id === targetUser.id);

  if (toDelete.size === 0) return interaction.editReply(`❌ Aucun message récent de **${targetUser.tag}** trouvé dans ce salon.`);

  let deleted = 0;
  try {
    const result = await channel.bulkDelete(toDelete, true);
    deleted = result.size;
  } catch {
    return interaction.editReply("❌ Impossible de supprimer (messages trop anciens > 14 jours ou permission manquante).");
  }

  const embed = new EmbedBuilder().setColor(0x3b82f6).setTitle("🗑️ Purge utilisateur")
    .addFields(
      { name: "Membre", value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
      { name: "Supprimés", value: String(deleted), inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
    ).setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  return sendLog(interaction.client, logEmbed(0x3b82f6, "🗑️ Purge utilisateur", [
    { name: "Membre", value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
    { name: "Salon", value: `<#${channel.id}>`, inline: true },
    { name: "Supprimés", value: String(deleted), inline: true },
  ], { tag: interaction.user.tag, id: interaction.user.id }),
  { guildId: interaction.guildId, commandChannelId: interaction.channelId! });
}

export const prefixName = "purge";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply("❌ Permission insuffisante."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId || !/^\d+$/.test(userId)) {
    await message.reply("Usage : `&purge @membre [nombre]` — supprime les messages récents d'un utilisateur."); return;
  }

  const limit = parseInt(args[1] ?? "100", 10);
  if (isNaN(limit) || limit < 1 || limit > 200) {
    await message.reply("❌ Nombre invalide (1-200)."); return;
  }

  const channel = message.channel as TextChannel;
  await message.delete().catch(() => null);

  const fetched = await channel.messages.fetch({ limit: Math.min(limit, 100) });
  const toDelete = fetched.filter((m) => m.author.id === userId);

  if (toDelete.size === 0) {
    const notice = await channel.send(`❌ Aucun message récent de <@${userId}> trouvé.`);
    setTimeout(() => notice.delete().catch(() => null), 5000);
    return;
  }

  let deleted = 0;
  try {
    const result = await channel.bulkDelete(toDelete, true);
    deleted = result.size;
  } catch {
    const notice = await channel.send("❌ Impossible de supprimer (messages trop anciens > 14 jours).");
    setTimeout(() => notice.delete().catch(() => null), 5000);
    return;
  }

  const confirm = await channel.send(`✅ **${deleted}** message(s) de <@${userId}> supprimés par ${message.author.tag}.`);
  setTimeout(() => confirm.delete().catch(() => null), 5000);

  await sendLog(message.client, logEmbed(0x3b82f6, "🗑️ Purge utilisateur", [
    { name: "Membre", value: `<@${userId}>`, inline: true },
    { name: "Salon", value: `<#${channel.id}>`, inline: true },
    { name: "Supprimés", value: String(deleted), inline: true },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }),
  { guildId: message.guild.id });
}
