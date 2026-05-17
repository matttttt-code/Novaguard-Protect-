import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getInviteStats, getMemberInviter } from "../invite-tracker.js";

export const data = new SlashCommandBuilder()
  .setName("checkinvite")
  .setDescription("Affiche tes stats d'invitations (ou celles d'un membre)")
  .addUserOption((o) =>
    o.setName("membre")
      .setDescription("Membre à consulter (Admin seulement)")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) return;

  const targetOption = interaction.options.getUser("membre");
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

  if (targetOption && !isAdmin) {
    await interaction.reply({ content: "❌ Seuls les administrateurs peuvent consulter les stats d'un autre membre.", ephemeral: true });
    return;
  }

  const target = targetOption ?? interaction.user;
  const stats = getInviteStats(interaction.guildId, target.id);
  const active = stats.invited - stats.left;
  const inviterEntry = getMemberInviter(interaction.guildId, target.id);

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`📊 Stats d'invitations — ${target.tag}`)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: "✅ Invités", value: `**${stats.invited}**`, inline: true },
      { name: "❌ Partis", value: `**${stats.left}**`, inline: true },
      { name: "🟢 Actifs", value: `**${Math.max(0, active)}**`, inline: true },
    );

  if (inviterEntry) {
    const inviterUser = await interaction.client.users.fetch(inviterEntry.inviterId).catch(() => null);
    embed.addFields({
      name: "📨 A été invité par",
      value: inviterUser
        ? `${inviterUser.tag} (\`${inviterEntry.inviterId}\`) via \`${inviterEntry.code}\``
        : `\`${inviterEntry.inviterId}\` via \`${inviterEntry.code}\``,
      inline: false,
    });
  } else {
    embed.addFields({ name: "📨 A été invité par", value: "Inconnu (rejoint avant le suivi ou via vanity/OAuth)", inline: false });
  }

  embed
    .setFooter({ text: `ID : ${target.id}${member?.joinedTimestamp ? ` · Arrivé <t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : ""}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export const prefixName = "checkinvite";
export const prefixAliases = ["ci", "mesinvites", "invitecheck"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;

  const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  let targetId = message.author.id;

  if (args[0]) {
    if (!isAdmin) {
      await message.reply("❌ Seuls les administrateurs peuvent consulter les stats d'un autre membre."); return;
    }
    targetId = args[0]!.replace(/[<@!>]/g, "");
  }

  const target = await message.client.users.fetch(targetId).catch(() => null);
  if (!target) { await message.reply("❌ Membre introuvable."); return; }

  const stats = getInviteStats(message.guild.id, targetId);
  const active = stats.invited - stats.left;
  const inviterEntry = getMemberInviter(message.guild.id, targetId);

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`📊 Stats d'invitations — ${target.tag}`)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: "✅ Invités", value: `**${stats.invited}**`, inline: true },
      { name: "❌ Partis", value: `**${stats.left}**`, inline: true },
      { name: "🟢 Actifs", value: `**${Math.max(0, active)}**`, inline: true },
    );

  if (inviterEntry) {
    const inviterUser = await message.client.users.fetch(inviterEntry.inviterId).catch(() => null);
    embed.addFields({
      name: "📨 A été invité par",
      value: inviterUser
        ? `${inviterUser.tag} (\`${inviterEntry.inviterId}\`) via \`${inviterEntry.code}\``
        : `\`${inviterEntry.inviterId}\` via \`${inviterEntry.code}\``,
      inline: false,
    });
  } else {
    embed.addFields({ name: "📨 A été invité par", value: "Inconnu (rejoint avant le suivi ou via vanity/OAuth)", inline: false });
  }

  embed.setFooter({ text: `ID : ${targetId}` }).setTimestamp();
  await message.reply({ embeds: [embed] });
}
