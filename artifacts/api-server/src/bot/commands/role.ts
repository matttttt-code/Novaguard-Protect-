import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  Role,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { replyErr, msgErr } from "../reply-logger.js";

export const data = new SlashCommandBuilder()
  .setName("role")
  .setDescription("Ajoute ou retire un rôle à un membre")
  .addSubcommand((sub) =>
    sub.setName("ajouter").setDescription("Ajoute un rôle à un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
      .addRoleOption((o) => o.setName("rôle").setDescription("Le rôle à ajouter").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("retirer").setDescription("Retire un rôle à un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
      .addRoleOption((o) => o.setName("rôle").setDescription("Le rôle à retirer").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const role = interaction.options.getRole("rôle") as Role | null;

  if (!member) return replyErr(interaction, "❌ Membre introuvable.");
  if (!role) return replyErr(interaction, "❌ Rôle introuvable.");

  const botMember = interaction.guild?.members.me;
  if (botMember && role.position >= botMember.roles.highest.position) {
    return replyErr(interaction, "❌ Je ne peux pas gérer ce rôle (position trop haute).");
  }

  if (sub === "ajouter") {
    if (member.roles.cache.has(role.id)) return replyErr(interaction, `❌ ${member.user.tag} a déjà ce rôle.`);
    await member.roles.add(role, `Ajout par ${interaction.user.tag}`);

    const embed = new EmbedBuilder().setColor(role.color || 0x22c55e).setTitle("✅ Rôle ajouté")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Rôle", value: `<@&${role.id}>`, inline: true },
        { name: "Modérateur", value: interaction.user.tag, inline: true }
      ).setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return sendLog(interaction.client, logEmbed(role.color || 0x22c55e, "✅ Rôle ajouté", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Rôle", value: `<@&${role.id}>`, inline: true },
    ], { tag: interaction.user.tag, id: interaction.user.id }));
  }

  if (!member.roles.cache.has(role.id)) return replyErr(interaction, `❌ ${member.user.tag} n'a pas ce rôle.`);
  await member.roles.remove(role, `Retrait par ${interaction.user.tag}`);

  const embed = new EmbedBuilder().setColor(0xf97316).setTitle("➖ Rôle retiré")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Rôle", value: `<@&${role.id}>`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true }
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });
  return sendLog(interaction.client, logEmbed(0xf97316, "➖ Rôle retiré", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Rôle", value: `<@&${role.id}>`, inline: true },
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "role";
export const prefixAliases = ["rôle", "roles"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await msgErr(message, "role", "❌ Permission insuffisante (ManageRoles requise)."); return;
  }

  const sub = args[0]?.toLowerCase();
  if (sub !== "ajouter" && sub !== "retirer") {
    await msgErr(message, "role", "Usage : `&role ajouter @membre @rôle` ou `&role retirer @membre @rôle`"); return;
  }

  const userId = args[1]?.replace(/[<@!>]/g, "");
  const roleId = args[2]?.replace(/[<@&>]/g, "");
  if (!userId || !roleId) { await msgErr(message, "role", "❌ Membre et rôle requis."); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await msgErr(message, "role", "❌ Membre introuvable."); return; }

  const role = message.guild.roles.cache.get(roleId);
  if (!role) { await msgErr(message, "role", "❌ Rôle introuvable."); return; }

  const botMember = message.guild.members.me;
  if (botMember && role.position >= botMember.roles.highest.position) {
    await msgErr(message, "role", "❌ Je ne peux pas gérer ce rôle (position trop haute)."); return;
  }

  if (sub === "ajouter") {
    if (member.roles.cache.has(role.id)) { await msgErr(message, "role", `❌ ${member.user.tag} a déjà ce rôle.`); return; }
    await member.roles.add(role, `Ajout par ${message.author.tag}`);

    const embed = new EmbedBuilder().setColor(role.color || 0x22c55e).setTitle("✅ Rôle ajouté")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Rôle", value: `<@&${role.id}>`, inline: true },
        { name: "Modérateur", value: message.author.tag, inline: true }
      ).setTimestamp();

    await message.reply({ embeds: [embed] });
    await sendLog(message.client, logEmbed(role.color || 0x22c55e, "✅ Rôle ajouté", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Rôle", value: `<@&${role.id}>`, inline: true },
      { name: "Via", value: "Commande préfixe", inline: true },
    ], { tag: message.author.tag, id: message.author.id }));
  } else {
    if (!member.roles.cache.has(role.id)) { await msgErr(message, "role", `❌ ${member.user.tag} n'a pas ce rôle.`); return; }
    await member.roles.remove(role, `Retrait par ${message.author.tag}`);

    const embed = new EmbedBuilder().setColor(0xf97316).setTitle("➖ Rôle retiré")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Rôle", value: `<@&${role.id}>`, inline: true },
        { name: "Modérateur", value: message.author.tag, inline: true }
      ).setTimestamp();

    await message.reply({ embeds: [embed] });
    await sendLog(message.client, logEmbed(0xf97316, "➖ Rôle retiré", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Rôle", value: `<@&${role.id}>`, inline: true },
      { name: "Via", value: "Commande préfixe", inline: true },
    ], { tag: message.author.tag, id: message.author.id }));
  }
}
