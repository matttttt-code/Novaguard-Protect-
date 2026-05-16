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
  .setName("clear")
  .setDescription("Supprime des messages dans le salon")
  .addIntegerOption((o) =>
    o.setName("nombre").setDescription("Nombre de messages à supprimer (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)
  )
  .addUserOption((o) =>
    o.setName("membre").setDescription("Supprimer uniquement les messages de ce membre")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  const amount = interaction.options.getInteger("nombre", true);
  const targetMember = interaction.options.getUser("membre");
  const channel = interaction.channel as TextChannel | null;

  if (!channel?.isTextBased()) return interaction.reply({ content: "Salon texte uniquement.", ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  let messages = await channel.messages.fetch({ limit: 100 });
  if (targetMember) messages = messages.filter((m) => m.author.id === targetMember.id);
  const toDelete = messages.first(amount);

  let deleted = 0;
  try {
    const result = await channel.bulkDelete(toDelete, true);
    deleted = result.size;
  } catch {
    return interaction.editReply("Impossible de supprimer (messages trop anciens > 14 jours).");
  }

  const embed = new EmbedBuilder().setColor(0x3b82f6).setTitle("🗑️ Messages supprimés")
    .addFields(
      { name: "Nombre supprimé", value: String(deleted), inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      ...(targetMember ? [{ name: "Filtre membre", value: targetMember.tag, inline: true }] : [])
    ).setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0x3b82f6, "🗑️ Messages supprimés", [
    { name: "Salon", value: `<#${channel.id}>`, inline: true },
    { name: "Nombre", value: String(deleted), inline: true },
    ...(targetMember ? [{ name: "Filtre membre", value: targetMember.tag, inline: true }] : []),
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "clear";
export const prefixAliases = ["purge", "clean"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply("❌ Permission insuffisante (ManageMessages requise)."); return;
  }

  const amount = parseInt(args[0] ?? "10", 10);
  if (isNaN(amount) || amount < 1 || amount > 100) {
    await message.reply("❌ Nombre invalide (1-100). Usage : `&clear [nombre]`"); return;
  }

  const channel = message.channel as TextChannel;
  await message.delete().catch(() => null);

  let messages = await channel.messages.fetch({ limit: 100 });
  const toDelete = messages.first(amount);

  let deleted = 0;
  try {
    const result = await channel.bulkDelete(toDelete, true);
    deleted = result.size;
  } catch {
    await channel.send("❌ Impossible de supprimer (messages trop anciens > 14 jours).").then(m => setTimeout(() => m.delete().catch(() => null), 5000));
    return;
  }

  const confirm = await channel.send(`✅ **${deleted}** messages supprimés par ${message.author.tag}.`);
  setTimeout(() => confirm.delete().catch(() => null), 5000);

  await sendLog(message.client, logEmbed(0x3b82f6, "🗑️ Messages supprimés", [
    { name: "Salon", value: `<#${channel.id}>`, inline: true },
    { name: "Nombre", value: String(deleted), inline: true },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
