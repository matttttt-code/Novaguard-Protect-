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

  if (!member) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  if (!member.kickable) return interaction.reply({ content: "Je ne peux pas expulser ce membre.", ephemeral: true });
  if (member.id === interaction.user.id) return interaction.reply({ content: "Vous ne pouvez pas vous expulser.", ephemeral: true });

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
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "kick";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    await message.reply("❌ Permission insuffisante (KickMembers requise)."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&kick @membre [raison]`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  if (!member.kickable) { await message.reply("❌ Je ne peux pas expulser ce membre."); return; }
  if (member.id === message.author.id) { await message.reply("❌ Vous ne pouvez pas vous expulser."); return; }

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
