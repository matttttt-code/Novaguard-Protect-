import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { addWarning, getWarnings } from "../warnings-store.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM, sendBlockedActionDM } from "../dm-notify.js";
import { replyErr, msgErr } from "../reply-logger.js";
import { checkAutoAction } from "./autokick.js";

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Avertit un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à avertir").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison de l'avertissement").setRequired(true)
  )
  .addBooleanOption((o) =>
    o.setName("dm").setDescription("Envoyer un DM à l'utilisateur ? (par défaut : paramètre global du serveur)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison", true);
  const dmOption = interaction.options.getBoolean("dm");

  if (!member) return replyErr(interaction, "❌ Membre introuvable.");
  if (!interaction.guildId) return replyErr(interaction, "❌ Commande serveur uniquement.");
  if (member.id === interaction.user.id) return replyErr(interaction, "❌ Vous ne pouvez pas vous avertir vous-même.");
  if (member.user.bot) return replyErr(interaction, "❌ Impossible d'avertir un bot.");

  const moderator = interaction.member as GuildMember | null;
  if (moderator && member.roles.highest.position >= moderator.roles.highest.position) {
    await sendBlockedActionDM(interaction.client, {
      command: "/warn", guildName: interaction.guild?.name ?? "Inconnu", guildId: interaction.guildId ?? "?",
      moderatorTag: interaction.user.tag, moderatorId: interaction.user.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    return replyErr(interaction, "❌ Vous ne pouvez pas avertir un membre dont le rôle est supérieur ou égal au vôtre.");
  }

  const caseId = addWarning(interaction.guildId, member.id, {
    reason,
    moderator: interaction.user.tag,
    moderatorId: interaction.user.id,
    timestamp: new Date(),
  });
  const total = getWarnings(interaction.guildId, member.id).length;

  void checkAutoAction(interaction.client, interaction.guildId, member, interaction.user.tag).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("⚠️ Avertissement")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Total", value: String(total), inline: true },
      { name: "Raison", value: reason },
      { name: "DM envoyé", value: dmOption === false ? "Non (forcé)" : dmOption === true ? "Oui (forcé)" : "Selon config serveur", inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
  await sendSanctionDM(member.user, "warn", reason, interaction.guild!, `Case #${caseId} — Total : ${total}`, dmOption ?? undefined);

  return sendLog(
    interaction.client,
    logEmbed(0xf97316, "⚠️ Avertissement", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Total", value: String(total), inline: true },
      { name: "Raison", value: reason },
    ], { tag: interaction.user.tag, id: interaction.user.id }),
    { guildId: interaction.guildId ?? undefined, commandChannelId: interaction.channelId ?? undefined }
  );
}

export const prefixName = "warn";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await msgErr(message, "warn", "❌ Permission insuffisante."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await msgErr(message, "warn", "Usage : `&warn @membre raison`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await msgErr(message, "warn", "❌ Membre introuvable."); return; }

  if (member.id === message.author.id) { await msgErr(message, "warn", "❌ Vous ne pouvez pas vous avertir vous-même."); return; }
  if (member.user.bot) { await msgErr(message, "warn", "❌ Impossible d'avertir un bot."); return; }
  if (member.roles.highest.position >= message.member!.roles.highest.position) {
    await sendBlockedActionDM(message.client, {
      command: "&warn", guildName: message.guild!.name, guildId: message.guild!.id,
      moderatorTag: message.author.tag, moderatorId: message.author.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    await msgErr(message, "warn", "❌ Vous ne pouvez pas avertir un membre dont le rôle est supérieur ou égal au vôtre."); return;
  }

  const reason = args.slice(1).join(" ");
  if (!reason) { await msgErr(message, "warn", "❌ Une raison est obligatoire."); return; }

  const caseId = addWarning(message.guild.id, member.id, {
    reason,
    moderator: message.author.tag,
    moderatorId: message.author.id,
    timestamp: new Date(),
  });
  const total = getWarnings(message.guild.id, member.id).length;

  void checkAutoAction(message.client, message.guild.id, member, message.author.tag).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("⚠️ Avertissement")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Total", value: String(total), inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
  await sendSanctionDM(member.user, "warn", reason, message.guild, `Case #${caseId} — Total : ${total}`);

  await sendLog(
    message.client,
    logEmbed(0xf97316, "⚠️ Avertissement", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Total", value: String(total), inline: true },
      { name: "Raison", value: reason },
      { name: "Via", value: "Commande préfixe", inline: true },
    ], { tag: message.author.tag, id: message.author.id }),
    { guildId: message.guildId ?? undefined }
  );
}
