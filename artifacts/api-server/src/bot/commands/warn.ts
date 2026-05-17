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
import { sendSanctionDM } from "../dm-notify.js";

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

  if (!member) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  if (member.id === interaction.user.id) return interaction.reply({ content: "Vous ne pouvez pas vous avertir.", ephemeral: true });
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const caseId = addWarning(interaction.guildId, member.id, {
    reason,
    moderator: interaction.user.tag,
    moderatorId: interaction.user.id,
    timestamp: new Date(),
  });
  const total = getWarnings(interaction.guildId, member.id).length;

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
    { guildId: interaction.guildId ?? undefined }
  );
}

export const prefixName = "warn";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ Permission insuffisante."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&warn @membre raison`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  const reason = args.slice(1).join(" ");
  if (!reason) { await message.reply("❌ Une raison est obligatoire."); return; }

  const caseId = addWarning(message.guild.id, member.id, {
    reason,
    moderator: message.author.tag,
    moderatorId: message.author.id,
    timestamp: new Date(),
  });
  const total = getWarnings(message.guild.id, member.id).length;

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
