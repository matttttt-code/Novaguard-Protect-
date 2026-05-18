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
import { sendSanctionDM, sendBlockedActionDM } from "../dm-notify.js";
import { addTempBan } from "../tempban-store.js";
import { replyErr, msgErr } from "../reply-logger.js";

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|j|d)$/i);
  if (!match) return null;
  const n = parseInt(match[1]!, 10);
  switch (match[2]!.toLowerCase()) {
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 3600 * 1000;
    case "j": case "d": return n * 86400 * 1000;
    default: return null;
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

export const data = new SlashCommandBuilder()
  .setName("tempban")
  .setDescription("Bannit un membre temporairement")
  .addUserOption((o) => o.setName("membre").setDescription("Le membre à bannir").setRequired(true))
  .addStringOption((o) => o.setName("durée").setDescription("Durée : ex. 1j, 12h, 30m").setRequired(true))
  .addStringOption((o) => o.setName("raison").setDescription("Raison du bannissement temporaire"))
  .addBooleanOption((o) => o.setName("dm").setDescription("Envoyer un DM à l'utilisateur ?"))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return replyErr(interaction, "Commande serveur uniquement.");

  const user = interaction.options.getUser("membre", true);
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const durationStr = interaction.options.getString("durée", true);
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const dmOption = interaction.options.getBoolean("dm");

  const durationMs = parseDuration(durationStr);
  if (!durationMs) return replyErr(interaction, "❌ Durée invalide. Exemples : `1j`, `12h`, `30m`, `60s`.");

  if (user.id === interaction.user.id) return replyErr(interaction, "❌ Vous ne pouvez pas vous bannir vous-même.");
  if (user.id === interaction.client.user?.id) return replyErr(interaction, "❌ Je ne peux pas me bannir moi-même.");

  const moderator = interaction.member as GuildMember | null;
  if (member && moderator && member.roles.highest.position >= moderator.roles.highest.position) {
    await sendBlockedActionDM(interaction.client, {
      command: "/tempban", guildName: interaction.guild.name, guildId: interaction.guildId!,
      moderatorTag: interaction.user.tag, moderatorId: interaction.user.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    return replyErr(interaction, "❌ Vous ne pouvez pas bannir un membre dont le rôle est supérieur ou égal au vôtre.");
  }
  if (member && !member.bannable) return replyErr(interaction, "❌ Je ne peux pas bannir ce membre.");

  await interaction.deferReply();

  if (member) await sendSanctionDM(member.user, "ban", reason, interaction.guild, `Durée : **${formatDuration(durationMs)}** — Déban automatique.`, dmOption ?? undefined);

  try {
    await interaction.guild.members.ban(user.id, { reason: `[TEMPBAN ${formatDuration(durationMs)}] ${reason}` });
  } catch {
    return interaction.editReply("❌ Impossible de bannir cet utilisateur.");
  }

  addTempBan({
    guildId: interaction.guildId!,
    userId: user.id,
    userTag: user.tag,
    moderatorTag: interaction.user.tag,
    reason,
    expiresAt: Date.now() + durationMs,
  });

  const embed = new EmbedBuilder().setColor(0xf97316).setTitle("🔨 Bannissement temporaire")
    .addFields(
      { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Durée", value: `**${formatDuration(durationMs)}**`, inline: true },
      { name: "Raison", value: reason },
      { name: "Déban automatique", value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
    ).setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  return sendLog(interaction.client, logEmbed(0xf97316, "🔨 Bannissement temporaire", [
    { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
    { name: "Durée", value: formatDuration(durationMs), inline: true },
    { name: "Raison", value: reason },
  ], { tag: interaction.user.tag, id: interaction.user.id }),
  { guildId: interaction.guildId!, logType: "ban", commandChannelId: interaction.channelId! });
}

export const prefixName = "tempban";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    await msgErr(message, "tempban", "❌ Permission insuffisante (BanMembers requise)."); return;
  }

  const rawId = args[0]?.replace(/[<@!>]/g, "");
  const durationStr = args[1];
  if (!rawId || !/^\d+$/.test(rawId) || !durationStr) {
    await msgErr(message, "tempban", "Usage : `&tempban @membre <durée> [raison]` — ex. `&tempban @user 1j spam`"); return;
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) { await msgErr(message, "tempban", "❌ Durée invalide. Exemples : `1j`, `12h`, `30m`"); return; }

  const reason = args.slice(2).join(" ") || "Aucune raison fournie";

  let user: User;
  try {
    const member = await message.guild.members.fetch(rawId);
    if (member.roles.highest.position >= message.member!.roles.highest.position) {
      await msgErr(message, "tempban", "❌ Rôle supérieur ou égal au vôtre."); return;
    }
    if (!member.bannable) { await msgErr(message, "tempban", "❌ Je ne peux pas bannir ce membre."); return; }
    user = member.user;
    await sendSanctionDM(user, "ban", reason, message.guild, `Durée : **${formatDuration(durationMs)}** — Déban automatique.`);
  } catch {
    try { user = await message.client.users.fetch(rawId); }
    catch { await msgErr(message, "tempban", "❌ Utilisateur introuvable."); return; }
  }

  try {
    await message.guild.members.ban(rawId, { reason: `[TEMPBAN ${formatDuration(durationMs)}] ${reason}` });
  } catch { await msgErr(message, "tempban", "❌ Impossible de bannir."); return; }

  addTempBan({ guildId: message.guild.id, userId: rawId, userTag: user.tag, moderatorTag: message.author.tag, reason, expiresAt: Date.now() + durationMs });

  const embed = new EmbedBuilder().setColor(0xf97316).setTitle("🔨 Bannissement temporaire")
    .addFields(
      { name: "Membre", value: `${user.tag} (\`${rawId}\`)`, inline: true },
      { name: "Durée", value: `**${formatDuration(durationMs)}**`, inline: true },
      { name: "Raison", value: reason },
      { name: "Déban automatique", value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
    ).setTimestamp();

  await message.reply({ embeds: [embed] });
  await sendLog(message.client, logEmbed(0xf97316, "🔨 Bannissement temporaire", [
    { name: "Membre", value: `${user.tag} (\`${rawId}\`)`, inline: true },
    { name: "Durée", value: formatDuration(durationMs), inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }),
  { guildId: message.guild.id, logType: "ban" });
}
