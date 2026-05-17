import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  User,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM } from "../dm-notify.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Bannit un membre du serveur (fonctionne avec un ID même hors du serveur)")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à bannir (mention ou ID)").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du bannissement")
  )
  .addIntegerOption((o) =>
    o.setName("supprimer_messages")
      .setDescription("Supprimer les messages des X derniers jours (0-7)")
      .setMinValue(0).setMaxValue(7)
  )
  .addBooleanOption((o) =>
    o.setName("dm").setDescription("Envoyer un DM à l'utilisateur ? (par défaut : paramètre global du serveur)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const user = interaction.options.getUser("membre", true);
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const deleteMessageSeconds = (interaction.options.getInteger("supprimer_messages") ?? 0) * 86400;
  const dmOption = interaction.options.getBoolean("dm");

  if (user.id === interaction.user.id) {
    return interaction.reply({ content: "❌ Vous ne pouvez pas vous bannir.", ephemeral: true });
  }
  if (user.id === interaction.client.user?.id) {
    return interaction.reply({ content: "❌ Je ne peux pas me bannir moi-même.", ephemeral: true });
  }

  const moderator = interaction.member as GuildMember | null;
  if (member && moderator && member.roles.highest.position >= moderator.roles.highest.position) {
    return interaction.reply({ content: "❌ Vous ne pouvez pas bannir un membre dont le rôle est supérieur ou égal au vôtre.", ephemeral: true });
  }
  if (member && !member.bannable) {
    return interaction.reply({ content: "❌ Je ne peux pas bannir ce membre (son rôle est supérieur ou égal au mien).", ephemeral: true });
  }

  await interaction.deferReply();

  if (member) {
    await sendSanctionDM(member.user, "ban", reason, interaction.guild, undefined, dmOption ?? undefined);
  }

  try {
    await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds });
  } catch {
    return interaction.editReply({ content: "❌ Impossible de bannir cet utilisateur." });
  }

  const embed = new EmbedBuilder().setColor(0xef4444).setTitle("🔨 Membre banni")
    .addFields(
      { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason },
      { name: "Messages supprimés", value: deleteMessageSeconds > 0 ? `${deleteMessageSeconds / 86400} jour(s)` : "Aucun", inline: true },
      { name: "Dans le serveur", value: member ? "Oui" : "Non (banni par ID)", inline: true },
      { name: "DM envoyé", value: dmOption === false ? "Non (forcé)" : dmOption === true ? "Oui (forcé)" : "Selon config serveur", inline: true },
    ).setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0xef4444, "🔨 Membre banni", [
    { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
    { name: "Raison", value: reason },
    { name: "Messages supprimés", value: deleteMessageSeconds > 0 ? `${deleteMessageSeconds / 86400} jour(s)` : "Aucun", inline: true },
    { name: "Dans le serveur", value: member ? "Oui" : "Non (banni par ID)", inline: true },
  ], { tag: interaction.user.tag, id: interaction.user.id }),
  { guildId: interaction.guildId ?? undefined, logType: "ban", commandChannelId: interaction.channelId ?? undefined });
}

export const prefixName = "ban";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("❌ Permission insuffisante (BanMembers requise)."); return;
  }

  const rawId = args[0]?.replace(/[<@!>]/g, "");
  if (!rawId || !/^\d+$/.test(rawId)) {
    await message.reply("Usage : `&ban @membre [raison]` ou `&ban <userId> [raison]`"); return;
  }
  if (rawId === message.author.id) {
    await message.reply("❌ Vous ne pouvez pas vous bannir."); return;
  }
  if (rawId === message.client.user?.id) {
    await message.reply("❌ Je ne peux pas me bannir moi-même."); return;
  }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  let user: User;
  let inServer = false;

  try {
    const member = await message.guild.members.fetch(rawId);
    inServer = true;
    if (member.roles.highest.position >= message.member!.roles.highest.position) {
      await message.reply("❌ Vous ne pouvez pas bannir un membre dont le rôle est supérieur ou égal au vôtre."); return;
    }
    if (!member.bannable) { await message.reply("❌ Je ne peux pas bannir ce membre (son rôle est supérieur ou égal au mien)."); return; }
    user = member.user;
    await sendSanctionDM(user, "ban", reason, message.guild);
  } catch {
    try {
      user = await message.client.users.fetch(rawId);
    } catch {
      await message.reply("❌ Utilisateur introuvable. Vérifie l'ID."); return;
    }
  }

  try {
    await message.guild.members.ban(rawId, { reason });
  } catch {
    await message.reply("❌ Impossible de bannir cet utilisateur."); return;
  }

  const embed = new EmbedBuilder().setColor(0xef4444).setTitle("🔨 Membre banni")
    .addFields(
      { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Raison", value: reason },
      { name: "Dans le serveur", value: inServer ? "Oui" : "Non (banni par ID)", inline: true }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(0xef4444, "🔨 Membre banni", [
    { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
    { name: "Raison", value: reason },
    { name: "Dans le serveur", value: inServer ? "Oui" : "Non (banni par ID)", inline: true },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }),
  { guildId: message.guildId ?? undefined, logType: "ban" });
}
