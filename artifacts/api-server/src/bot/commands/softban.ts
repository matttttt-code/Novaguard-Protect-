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
  .setName("softban")
  .setDescription("Expulse un membre et supprime ses messages récents (ban + déban immédiat)")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à softbannir").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison")
  )
  .addIntegerOption((o) =>
    o.setName("jours").setDescription("Jours de messages supprimés (1-7, défaut 1)").setMinValue(1).setMaxValue(7)
  )
  .addBooleanOption((o) =>
    o.setName("dm").setDescription("Envoyer un DM à l'utilisateur ? (par défaut : paramètre global du serveur)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const days = interaction.options.getInteger("jours") ?? 1;
  const dmOption = interaction.options.getBoolean("dm");

  if (!member || !interaction.guild) return replyErr(interaction, "❌ Membre introuvable.");
  if (member.id === interaction.user.id) return replyErr(interaction, "❌ Vous ne pouvez pas vous softbannir.");
  if (member.id === interaction.client.user?.id) return replyErr(interaction, "❌ Je ne peux pas me softbannir moi-même.");

  const moderator = interaction.member as GuildMember | null;
  if (moderator && member.roles.highest.position >= moderator.roles.highest.position) {
    await sendBlockedActionDM(interaction.client, {
      command: "/softban", guildName: interaction.guild?.name ?? "Inconnu", guildId: interaction.guildId ?? "?",
      moderatorTag: interaction.user.tag, moderatorId: interaction.user.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    return replyErr(interaction, "❌ Vous ne pouvez pas softbannir un membre dont le rôle est supérieur ou égal au vôtre.");
  }
  if (!member.bannable) return replyErr(interaction, "❌ Je ne peux pas bannir ce membre (son rôle est supérieur ou égal au mien).");

  await interaction.deferReply();

  await sendSanctionDM(member.user, "kick", `[SOFTBAN] ${reason} — Vos messages récents ont été supprimés.`, interaction.guild, undefined, dmOption ?? undefined);
  await member.ban({ reason: `[SOFTBAN] ${reason}`, deleteMessageSeconds: days * 86400 });
  await interaction.guild.members.unban(member.id, "Softban — déban automatique");

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("🧹 Membre softbannis")
    .setDescription("Ban + déban immédiat — messages supprimés, membre expulsé.")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Messages supprimés", value: `${days} jour(s)`, inline: true },
      { name: "Raison", value: reason },
      { name: "DM envoyé", value: dmOption === false ? "Non (forcé)" : dmOption === true ? "Oui (forcé)" : "Selon config serveur", inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(0xf97316, "🧹 Membre softbannis", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Messages supprimés", value: `${days} jour(s)`, inline: true },
      { name: "Raison", value: reason },
    ], { tag: interaction.user.tag, id: interaction.user.id }),
    { guildId: interaction.guildId ?? undefined, logType: "ban", commandChannelId: interaction.channelId ?? undefined }
  );
}

export const prefixName = "softban";
export const prefixAliases = ["sb"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("❌ Permission insuffisante (BanMembers requise)."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&softban @membre [raison]`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  if (member.id === message.author.id) { await message.reply("❌ Vous ne pouvez pas vous softbannir."); return; }
  if (member.id === message.client.user?.id) { await message.reply("❌ Je ne peux pas me softbannir moi-même."); return; }
  if (member.roles.highest.position >= message.member!.roles.highest.position) {
    await sendBlockedActionDM(message.client, {
      command: "&softban", guildName: message.guild!.name, guildId: message.guild!.id,
      moderatorTag: message.author.tag, moderatorId: message.author.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    await message.reply("❌ Vous ne pouvez pas softbannir un membre dont le rôle est supérieur ou égal au vôtre."); return;
  }
  if (!member.bannable) { await message.reply("❌ Je ne peux pas bannir ce membre (son rôle est supérieur ou égal au mien)."); return; }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  await sendSanctionDM(member.user, "kick", `[SOFTBAN] ${reason}`, message.guild);
  await member.ban({ reason: `[SOFTBAN] ${reason}`, deleteMessageSeconds: 86400 });
  await message.guild.members.unban(member.id, "Softban — déban automatique");

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("🧹 Membre softbannis")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(
    message.client,
    logEmbed(0xf97316, "🧹 Membre softbannis", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Raison", value: reason },
      { name: "Via", value: "Commande préfixe", inline: true },
    ], { tag: message.author.tag, id: message.author.id }),
    { guildId: message.guildId ?? undefined, logType: "ban" }
  );
}
