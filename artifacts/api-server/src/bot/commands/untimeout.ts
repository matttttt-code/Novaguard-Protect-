import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("untimeout")
  .setDescription("Retire le timeout d'un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à libérer").setRequired(true)
  )
  .addStringOption((o) => o.setName("raison").setDescription("Raison"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!member) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  if (!member.communicationDisabledUntil) return interaction.reply({ content: "Ce membre n'est pas en timeout.", ephemeral: true });

  await member.timeout(null, reason);

  const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("🔊 Timeout retiré")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason }
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0x22c55e, "🔊 Timeout retiré", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Raison", value: reason },
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "untimeout";
export const prefixAliases = ["unmute"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ Permission insuffisante (ModerateMembers requise)."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&untimeout @membre [raison]`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  if (!member.communicationDisabledUntil) { await message.reply("❌ Ce membre n'est pas en timeout."); return; }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";
  await member.timeout(null, reason);

  const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("🔊 Timeout retiré")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Raison", value: reason }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(0x22c55e, "🔊 Timeout retiré", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
