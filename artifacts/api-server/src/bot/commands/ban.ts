import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM } from "../dm-notify.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Bannit un membre du serveur")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à bannir").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du bannissement")
  )
  .addIntegerOption((o) =>
    o.setName("supprimer_messages").setDescription("Supprimer les messages des X derniers jours (0-7)").setMinValue(0).setMaxValue(7)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const deleteMessageSeconds = (interaction.options.getInteger("supprimer_messages") ?? 0) * 86400;

  if (!member) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  if (!member.bannable) return interaction.reply({ content: "Je ne peux pas bannir ce membre.", ephemeral: true });
  if (member.id === interaction.user.id) return interaction.reply({ content: "Vous ne pouvez pas vous bannir.", ephemeral: true });

  await sendSanctionDM(member.user, "ban", reason, interaction.guild!);
  await member.ban({ reason, deleteMessageSeconds });

  const embed = new EmbedBuilder().setColor(0xef4444).setTitle("🔨 Membre banni")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason },
      { name: "Messages supprimés", value: deleteMessageSeconds > 0 ? `${deleteMessageSeconds / 86400} jour(s)` : "Aucun", inline: true }
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0xef4444, "🔨 Membre banni", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Raison", value: reason },
    { name: "Messages supprimés", value: deleteMessageSeconds > 0 ? `${deleteMessageSeconds / 86400} jour(s)` : "Aucun", inline: true },
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "ban";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("❌ Permission insuffisante (BanMembers requise)."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&ban @membre [raison]`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  if (!member.bannable) { await message.reply("❌ Je ne peux pas bannir ce membre."); return; }
  if (member.id === message.author.id) { await message.reply("❌ Vous ne pouvez pas vous bannir."); return; }

  await sendSanctionDM(member.user, "ban", reason, message.guild);
  await member.ban({ reason });

  const embed = new EmbedBuilder().setColor(0xef4444).setTitle("🔨 Membre banni")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Raison", value: reason }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(0xef4444, "🔨 Membre banni", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
