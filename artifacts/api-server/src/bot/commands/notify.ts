import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  TextChannel,
  GuildMember,
  Role,
} from "discord.js";
import { getConfig } from "../guild-config-store.js";
import { isTicketChannel, getTicketByChannel } from "../ticket-store.js";

export const data = new SlashCommandBuilder()
  .setName("notify")
  .setDescription("Notifie un utilisateur ou un rôle qu'un ticket attend leur réponse")
  .addUserOption(o =>
    o.setName("utilisateur")
      .setDescription("Utilisateur à notifier")
  )
  .addRoleOption(o =>
    o.setName("rôle")
      .setDescription("Rôle à notifier")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });
    return;
  }

  if (!isTicketChannel(interaction.channelId)) {
    await interaction.reply({ content: "❌ Cette commande ne fonctionne que dans un salon ticket.", ephemeral: true });
    return;
  }

  const config = getConfig(interaction.guild.id);
  const member = interaction.member as GuildMember;
  const isStaff = config.ticketStaffRoleId
    ? member.roles.cache.has(config.ticketStaffRoleId)
    : member.permissions.has(PermissionFlagsBits.ManageChannels);

  if (!isStaff) {
    await interaction.reply({ content: "❌ Seul le staff peut utiliser cette commande.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("utilisateur");
  const targetRole = interaction.options.getRole("rôle") as Role | null;

  if (!targetUser && !targetRole) {
    await interaction.reply({ content: "❌ Précise un utilisateur ou un rôle à notifier.", ephemeral: true });
    return;
  }

  const ticket = getTicketByChannel(interaction.channelId);
  const channel = interaction.channel as TextChannel;
  const serverName = interaction.guild.name;
  const channelLink = `<#${channel.id}>`;

  const dmEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("📬 Un ticket attend votre réponse")
    .addFields(
      { name: "Serveur", value: serverName, inline: true },
      { name: "Salon", value: channelLink, inline: true },
      ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
    )
    .setFooter({ text: "Merci de répondre dès que possible." })
    .setTimestamp();

  if (targetUser) {
    await channel.send({ content: `<@${targetUser.id}>`, embeds: [new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("📬 Notification — réponse requise")
      .setDescription(`<@${targetUser.id}>, ce ticket attend votre réponse.`)
      .setTimestamp()] });
    await targetUser.send({ embeds: [dmEmbed] }).catch(() => null);
    await interaction.reply({ content: `✅ <@${targetUser.id}> a été notifié(e) par ping et DM.`, ephemeral: true });
    return;
  }

  if (targetRole) {
    await channel.send({ content: `<@&${targetRole.id}>`, embeds: [new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("📬 Notification — réponse requise")
      .setDescription(`<@&${targetRole.id}>, ce ticket attend votre réponse.`)
      .setTimestamp()] });

    const roleMembers = targetRole.members;
    let dmCount = 0;
    await Promise.all(roleMembers.map(async (rm) => {
      if (rm.user.bot) return;
      const sent = await rm.send({ embeds: [dmEmbed] }).catch(() => null);
      if (sent) dmCount++;
    }));

    await interaction.reply({ content: `✅ Rôle <@&${targetRole.id}> pingé. **${dmCount}** DM(s) envoyé(s).`, ephemeral: true });
  }
}

export const prefixName = "notify";
export const prefixAliases = ["notif", "notifier"];

export async function executeMessage(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;

  if (!isTicketChannel(message.channelId)) {
    await message.reply("❌ Cette commande ne fonctionne que dans un salon ticket.");
    return;
  }

  const config = getConfig(message.guild.id);
  const isStaff = config.ticketStaffRoleId
    ? message.member.roles.cache.has(config.ticketStaffRoleId)
    : message.member.permissions.has(PermissionFlagsBits.ManageChannels);

  if (!isStaff) {
    await message.reply("❌ Seul le staff peut utiliser cette commande.");
    return;
  }

  const rawMention = args[0];
  if (!rawMention) {
    await message.reply("Usage : `&notify @utilisateur` ou `&notify @rôle`");
    return;
  }

  const ticket = getTicketByChannel(message.channelId);
  const channel = message.channel as TextChannel;
  const serverName = message.guild.name;

  const dmEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("📬 Un ticket attend votre réponse")
    .addFields(
      { name: "Serveur", value: serverName, inline: true },
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
    )
    .setFooter({ text: "Merci de répondre dès que possible." })
    .setTimestamp();

  // Rôle ?
  const roleId = rawMention.match(/^<@&(\d+)>$/)?.[1];
  if (roleId) {
    const role = message.guild.roles.cache.get(roleId) as Role | undefined;
    if (!role) { await message.reply("❌ Rôle introuvable."); return; }
    await channel.send({ content: `<@&${role.id}>`, embeds: [new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("📬 Notification — réponse requise")
      .setDescription(`<@&${role.id}>, ce ticket attend votre réponse.`)
      .setTimestamp()] });
    let dmCount = 0;
    await Promise.all(role.members.map(async rm => {
      if (rm.user.bot) return;
      const sent = await rm.send({ embeds: [dmEmbed] }).catch(() => null);
      if (sent) dmCount++;
    }));
    await message.reply(`✅ Rôle <@&${role.id}> pingé. **${dmCount}** DM(s) envoyé(s).`);
    return;
  }

  // Utilisateur ?
  const userId = rawMention.match(/^<@!?(\d+)>$/)?.[1];
  if (userId) {
    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target) { await message.reply("❌ Utilisateur introuvable."); return; }
    await channel.send({ content: `<@${target.id}>`, embeds: [new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("📬 Notification — réponse requise")
      .setDescription(`<@${target.id}>, ce ticket attend votre réponse.`)
      .setTimestamp()] });
    await target.send({ embeds: [dmEmbed] }).catch(() => null);
    await message.reply(`✅ <@${target.id}> notifié(e) par ping et DM.`);
    return;
  }

  await message.reply("❌ Mention invalide. Usage : `&notify @utilisateur` ou `&notify @rôle`");
}
