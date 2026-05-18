import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { replyErr, msgErr } from "../reply-logger.js";

export const data = new SlashCommandBuilder()
  .setName("nickname")
  .setDescription("Change ou réinitialise le surnom d'un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("surnom").setDescription("Nouveau surnom (vide pour réinitialiser)").setMaxLength(32)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const newNick = interaction.options.getString("surnom");

  if (!member) return replyErr(interaction, "❌ Membre introuvable.");
  if (!member.manageable) return replyErr(interaction, "❌ Je ne peux pas modifier le surnom de ce membre.");

  const oldNick = member.nickname ?? member.user.username;
  await member.setNickname(newNick, `Modifié par ${interaction.user.tag}`);

  const embed = new EmbedBuilder().setColor(0x6366f1).setTitle("✏️ Surnom modifié")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Avant", value: oldNick, inline: true },
      { name: "Après", value: newNick ?? `*(réinitialisé)*`, inline: true }
    ).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(interaction.client, logEmbed(0x6366f1, "✏️ Surnom modifié", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Avant", value: oldNick, inline: true },
    { name: "Après", value: newNick ?? `*(réinitialisé)*`, inline: true },
  ], { tag: interaction.user.tag, id: interaction.user.id }));
}

export const prefixName = "nickname";
export const prefixAliases = ["nick", "pseudo", "surnom"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
    await msgErr(message, "nickname", "❌ Permission insuffisante (ManageNicknames requise)."); return;
  }

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&nickname @membre [nouveau surnom]` ou `&nickname reset @membre`"); return; }

  let member: GuildMember;
  let newNick: string | null;
  let skipArgs: number;

  if (args[0].toLowerCase() === "reset") {
    const resetUserId = args[1]?.replace(/[<@!>]/g, "");
    if (!resetUserId) { await msgErr(message, "nickname", "Usage : `&nickname reset @membre`"); return; }
    try { member = await message.guild.members.fetch(resetUserId); }
    catch { await msgErr(message, "nickname", "❌ Membre introuvable."); return; }
    newNick = null;
    skipArgs = 2;
  } else {
    try { member = await message.guild.members.fetch(userId); }
    catch { await msgErr(message, "nickname", "❌ Membre introuvable."); return; }
    newNick = args.slice(1).join(" ") || null;
    skipArgs = args.length;
  }

  if (!member.manageable) { await msgErr(message, "nickname", "❌ Je ne peux pas modifier le surnom de ce membre."); return; }

  const oldNick = member.nickname ?? member.user.username;
  await member.setNickname(newNick, `Modifié par ${message.author.tag}`);

  const embed = new EmbedBuilder().setColor(0x6366f1).setTitle("✏️ Surnom modifié")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Avant", value: oldNick, inline: true },
      { name: "Après", value: newNick ?? `*(réinitialisé)*`, inline: true }
    ).setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(message.client, logEmbed(0x6366f1, "✏️ Surnom modifié", [
    { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
    { name: "Avant", value: oldNick, inline: true },
    { name: "Après", value: newNick ?? `*(réinitialisé)*`, inline: true },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }));
}
