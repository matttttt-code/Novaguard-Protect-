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

const DURATIONS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "10m": 600_000, "30m": 1_800_000,
  "1h": 3_600_000, "6h": 21_600_000, "12h": 43_200_000,
  "1j": 86_400_000, "7j": 604_800_000, "28j": 2_419_200_000,
};

const LABELS: Record<string, string> = {
  "1m": "1 minute", "5m": "5 minutes", "10m": "10 minutes", "30m": "30 minutes",
  "1h": "1 heure", "6h": "6 heures", "12h": "12 heures",
  "1j": "1 jour", "7j": "7 jours", "28j": "28 jours",
};

export const data = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Met en sourdine temporaire un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à mettre en timeout").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("durée").setDescription("Durée du timeout").setRequired(true)
      .addChoices(
        { name: "1 minute", value: "1m" }, { name: "5 minutes", value: "5m" },
        { name: "10 minutes", value: "10m" }, { name: "30 minutes", value: "30m" },
        { name: "1 heure", value: "1h" }, { name: "6 heures", value: "6h" },
        { name: "12 heures", value: "12h" }, { name: "1 jour", value: "1j" },
        { name: "7 jours", value: "7j" }, { name: "28 jours", value: "28j" }
      )
  )
  .addStringOption((o) => o.setName("raison").setDescription("Raison du timeout"))
  .addBooleanOption((o) =>
    o.setName("dm").setDescription("Envoyer un DM à l'utilisateur ? (par défaut : paramètre global du serveur)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const dureeKey = interaction.options.getString("durée", true);
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const dmOption = interaction.options.getBoolean("dm");

  if (!member) return replyErr(interaction, "❌ Membre introuvable.");
  if (member.id === interaction.user.id) return replyErr(interaction, "❌ Vous ne pouvez pas vous mettre en timeout.");
  if (member.id === interaction.client.user?.id) return replyErr(interaction, "❌ Je ne peux pas me mettre en timeout.");

  const moderator = interaction.member as GuildMember | null;
  if (moderator && member.roles.highest.position >= moderator.roles.highest.position) {
    await sendBlockedActionDM(interaction.client, {
      command: "/timeout", guildName: interaction.guild?.name ?? "Inconnu", guildId: interaction.guildId ?? "?",
      moderatorTag: interaction.user.tag, moderatorId: interaction.user.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    return replyErr(interaction, "❌ Vous ne pouvez pas mettre en timeout un membre dont le rôle est supérieur ou égal au vôtre.");
  }
  if (!member.moderatable) return replyErr(interaction, "❌ Je ne peux pas mettre ce membre en timeout (son rôle est supérieur ou égal au mien).");

  const ms = DURATIONS[dureeKey]!;
  await member.timeout(ms, reason);
  await sendSanctionDM(member.user, "timeout", reason, interaction.guild!, `Durée : ${LABELS[dureeKey] ?? dureeKey}`, dmOption ?? undefined);

  const embed = new EmbedBuilder().setColor(0xa855f7).setTitle("🔇 Membre mis en timeout")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Durée", value: LABELS[dureeKey] ?? dureeKey, inline: true },
      { name: "Raison", value: reason },
      { name: "DM envoyé", value: dmOption === false ? "Non (forcé)" : dmOption === true ? "Oui (forcé)" : "Selon config serveur", inline: true },
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0xa855f7, "🔇 Membre mis en timeout", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Durée", value: LABELS[dureeKey] ?? dureeKey, inline: true },
    { name: "Raison", value: reason },
  ], { tag: interaction.user.tag, id: interaction.user.id }),
  { guildId: interaction.guildId ?? undefined, commandChannelId: interaction.channelId ?? undefined });
}

export const prefixName = "timeout";
export const prefixAliases = ["mute"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await msgErr(message, "timeout", "❌ Permission insuffisante (ModerateMembers requise)."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  const dureeKey = args[1]?.toLowerCase();
  if (!userId || !dureeKey) {
    await msgErr(message, "timeout", "Usage : `&timeout @membre 1m|5m|10m|30m|1h|6h|12h|1j|7j|28j [raison]`"); return;
  }
  if (!DURATIONS[dureeKey]) {
    await msgErr(message, "timeout", `❌ Durée invalide. Choix : ${Object.keys(DURATIONS).join(", ")}`); return;
  }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await msgErr(message, "timeout", "❌ Membre introuvable."); return; }

  const reason = args.slice(2).join(" ") || "Aucune raison fournie";

  if (member.id === message.author.id) { await msgErr(message, "timeout", "❌ Vous ne pouvez pas vous mettre en timeout."); return; }
  if (member.id === message.client.user?.id) { await msgErr(message, "timeout", "❌ Je ne peux pas me mettre en timeout."); return; }
  if (member.roles.highest.position >= message.member!.roles.highest.position) {
    await sendBlockedActionDM(message.client, {
      command: "&timeout", guildName: message.guild!.name, guildId: message.guild!.id,
      moderatorTag: message.author.tag, moderatorId: message.author.id,
      targetTag: member.user.tag, targetId: member.id,
      blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
    });
    await msgErr(message, "timeout", "❌ Vous ne pouvez pas mettre en timeout un membre dont le rôle est supérieur ou égal au vôtre."); return;
  }
  if (!member.moderatable) { await msgErr(message, "timeout", "❌ Je ne peux pas mettre ce membre en timeout (son rôle est supérieur ou égal au mien)."); return; }

  await member.timeout(DURATIONS[dureeKey]!, reason);
  await sendSanctionDM(member.user, "timeout", reason, message.guild, `Durée : ${LABELS[dureeKey] ?? dureeKey}`);

  const embed = new EmbedBuilder().setColor(0xa855f7).setTitle("🔇 Membre mis en timeout")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Durée", value: LABELS[dureeKey] ?? dureeKey, inline: true },
      { name: "Raison", value: reason }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(0xa855f7, "🔇 Membre mis en timeout", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Durée", value: LABELS[dureeKey] ?? dureeKey, inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
