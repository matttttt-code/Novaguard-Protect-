import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM, sendBlockedActionDM } from "../dm-notify.js";
import { replyErr, msgErr } from "../reply-logger.js";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Expulse un membre du serveur")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à expulser").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison de l'expulsion")
  )
  .addBooleanOption((o) =>
    o.setName("dm").setDescription("Envoyer un DM à l'utilisateur ? (par défaut : paramètre global du serveur)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const dmOption = interaction.options.getBoolean("dm");

  if (!member) return replyErr(interaction, "❌ Membre introuvable.");
  if (member.id === interaction.user.id) return replyErr(interaction, "❌ Vous ne pouvez pas vous expulser.");
  if (member.id === interaction.client.user?.id) return replyErr(interaction, "❌ Je ne peux pas m'expulser moi-même.");

  const moderator = interaction.member as GuildMember | null;
  if (moderator && member.roles.highest.position >= moderator.roles.highest.position) {
    await sendBlockedActionDM(interaction.client, {
      command: "/kick", guildName: interaction.guild?.name ?? "Inconnu", guildId: interaction.guildId ?? "?",
      moderatorTag: interaction.user.tag, moderatorId: interaction.user.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    return replyErr(interaction, "❌ Vous ne pouvez pas expulser un membre dont le rôle est supérieur ou égal au vôtre.");
  }
  if (!member.kickable) return replyErr(interaction, "❌ Je ne peux pas expulser ce membre (son rôle est supérieur ou égal au mien).");

  await sendSanctionDM(member.user, "kick", reason, interaction.guild!, undefined, dmOption ?? undefined);
  await member.kick(reason);

  const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle("👢 Membre expulsé")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason },
      { name: "DM envoyé", value: dmOption === false ? "Non (forcé)" : dmOption === true ? "Oui (forcé)" : "Selon config serveur", inline: true },
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0xf59e0b, "👢 Membre expulsé", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Raison", value: reason },
  ], { tag: interaction.user.tag, id: interaction.user.id }),
  { guildId: interaction.guildId ?? undefined, commandChannelId: interaction.channelId ?? undefined });
}

export const prefixName = "kick";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    await msgErr(message, "kick", "❌ Permission insuffisante (KickMembers requise)."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await msgErr(message, "kick", "Usage : `&kick @membre [raison]`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await msgErr(message, "kick", "❌ Membre introuvable."); return; }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  if (member.id === message.author.id) { await msgErr(message, "kick", "❌ Vous ne pouvez pas vous expulser."); return; }
  if (member.id === message.client.user?.id) { await msgErr(message, "kick", "❌ Je ne peux pas m'expulser moi-même."); return; }
  if (member.roles.highest.position >= message.member!.roles.highest.position) {
    await sendBlockedActionDM(message.client, {
      command: "&kick", guildName: message.guild!.name, guildId: message.guild!.id,
      moderatorTag: message.author.tag, moderatorId: message.author.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    await msgErr(message, "kick", "❌ Vous ne pouvez pas expulser un membre dont le rôle est supérieur ou égal au vôtre."); return;
  }
  if (!member.kickable) { await msgErr(message, "kick", "❌ Je ne peux pas expulser ce membre (son rôle est supérieur ou égal au mien)."); return; }

  await sendSanctionDM(member.user, "kick", reason, message.guild);
  await member.kick(reason);

  const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle("👢 Membre expulsé")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Raison", value: reason }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(0xf59e0b, "👢 Membre expulsé", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
