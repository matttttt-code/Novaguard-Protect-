import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildMember,
  TextChannel,
  Client,
} from "discord.js";
import { isTicketChannel, getTicketByChannel, claimTicket, resetTickets } from "../ticket-store.js";
import { getConfig } from "../guild-config-store.js";
import { sendLog, logEmbed } from "../log.js";
import { buildTranscriptContent, saveTranscriptToDB } from "../transcript-db.js";

async function doClose(client: Client, channel: TextChannel, closedBy: string, closedById: string, reason: string, guildId: string): Promise<void> {
  const ticket = getTicketByChannel(channel.id);

  // Save transcript to DB before channel is deleted
  if (ticket) {
    try {
      const guild = client.guilds.cache.get(guildId);
      const { content, count } = await buildTranscriptContent(channel);
      await saveTranscriptToDB({
        ticket,
        guildName: guild?.name ?? guildId,
        channelName: channel.name,
        content,
        messageCount: count,
        closedBy,
        closedById,
        reason,
      });
    } catch { /* non-blocking */ }
  }

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔒 Ticket fermé")
    .addFields(
      { name: "Fermé par", value: closedBy, inline: true },
      { name: "Raison", value: reason, inline: true },
      ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
      ...(ticket?.claimedBy ? [{ name: "Pris en charge par", value: ticket.claimedBy, inline: true }] : [])
    )
    .setFooter({ text: "Ce salon sera supprimé dans 5 secondes." })
    .setTimestamp();

  await channel.send({ embeds: [embed] });

  await sendLog(client, logEmbed(
    0xef4444, "🔒 Ticket fermé",
    [
      { name: "Salon", value: channel.name, inline: true },
      { name: "Raison", value: reason, inline: true },
      ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
      ...(ticket?.claimedBy ? [{ name: "Pris en charge par", value: ticket.claimedBy, inline: true }] : []),
    ],
    { tag: closedBy, id: closedById }
  ), { guildId });

  setTimeout(async () => {
    const { closeTicket } = await import("../ticket-store.js");
    closeTicket(channel.id);
    await channel.delete("Ticket fermé").catch(() => null);
  }, 5000);
}

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Gère le ticket actuel")
  .addSubcommand((sub) =>
    sub.setName("fermer")
      .setDescription("Ferme ce ticket")
      .addStringOption((o) => o.setName("raison").setDescription("Raison de la fermeture"))
  )
  .addSubcommand((sub) =>
    sub.setName("claim")
      .setDescription("Prend en charge ce ticket (staff uniquement)")
  )
  .addSubcommand((sub) =>
    sub.setName("ajouter")
      .setDescription("Ajoute un membre à ce ticket")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre à ajouter").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("retirer")
      .setDescription("Retire un membre de ce ticket")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre à retirer").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("reset")
      .setDescription("Réinitialise le registre interne des tickets en cas de bug (Admin uniquement)")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channelId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const channel = interaction.channel as TextChannel;
  const sub = interaction.options.getSubcommand();
  const config = getConfig(interaction.guild.id);
  const guildMember = interaction.member as GuildMember;
  const guildId = interaction.guild.id;

  const isStaff = config.ticketStaffRoleId
    ? guildMember.roles.cache.has(config.ticketStaffRoleId)
    : guildMember.permissions.has(PermissionFlagsBits.ManageChannels);

  const ticket = getTicketByChannel(interaction.channelId);
  const isOwner = ticket?.userId === interaction.user.id;

  if (sub === "reset") {
    if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Seuls les administrateurs peuvent réinitialiser le registre des tickets.", ephemeral: true });
    }
    const count = resetTickets(guildId);
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf97316)
        .setTitle("🔄 Registre des tickets réinitialisé")
        .setDescription(
          `**${count}** ticket(s) ont été supprimés du registre interne.\n\n` +
          "⚠️ Les salons Discord **ne sont pas supprimés** automatiquement — supprime-les manuellement si nécessaire.\n" +
          "Les utilisateurs peuvent maintenant créer de nouveaux tickets normalement."
        )
        .addFields({ name: "Fait par", value: interaction.user.tag, inline: true })
        .setTimestamp()],
      ephemeral: true,
    });
  }

  if (sub === "fermer") {
    if (!isTicketChannel(interaction.channelId)) {
      return interaction.reply({ content: "❌ Cette commande ne fonctionne que dans un salon ticket.", ephemeral: true });
    }
    if (!isStaff && !isOwner) {
      return interaction.reply({ content: "❌ Seul le staff ou le créateur du ticket peut le fermer.", ephemeral: true });
    }
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
    await interaction.reply({ content: "🔒 Fermeture du ticket en cours...", ephemeral: true });
    await doClose(interaction.client, channel, interaction.user.tag, interaction.user.id, reason, guildId);
    return;
  }

  if (sub === "claim") {
    if (!isTicketChannel(interaction.channelId)) {
      return interaction.reply({ content: "❌ Cette commande ne fonctionne que dans un salon ticket.", ephemeral: true });
    }
    if (!isStaff) {
      return interaction.reply({ content: "❌ Seul le staff peut prendre en charge un ticket.", ephemeral: true });
    }
    if (ticket?.claimedBy) {
      return interaction.reply({ content: `❌ Ce ticket est déjà pris en charge par **${ticket.claimedBy}**.`, ephemeral: true });
    }

    claimTicket(interaction.channelId, interaction.user.tag, interaction.user.id);

    const claimEmbed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Ticket pris en charge")
      .setDescription(`<@${interaction.user.id}> prend en charge ce ticket.`)
      .addFields(
        { name: "Staff", value: interaction.user.tag, inline: true },
        ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : [])
      )
      .setTimestamp();

    await channel.setTopic(`Ticket #${ticket?.ticketNumber ?? "?"} — ${ticket?.username ?? "?"} — Pris en charge par ${interaction.user.tag}`).catch(() => null);
    await interaction.reply({ embeds: [claimEmbed] });

    await sendLog(interaction.client, logEmbed(
      0x22c55e, "✅ Ticket pris en charge",
      [
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
        ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    ), { guildId });
    return;
  }

  if (!isStaff) {
    return interaction.reply({ content: "❌ Seul le staff peut ajouter ou retirer des membres.", ephemeral: true });
  }
  if (!isTicketChannel(interaction.channelId)) {
    return interaction.reply({ content: "❌ Cette commande ne fonctionne que dans un salon ticket.", ephemeral: true });
  }

  const member = interaction.options.getMember("membre") as GuildMember | null;
  if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });

  if (sub === "ajouter") {
    await channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    });
    await interaction.reply({ content: `✅ <@${member.id}> a été ajouté au ticket.` });
    await sendLog(interaction.client, logEmbed(
      0x6366f1, "🎫 Membre ajouté au ticket",
      [
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Membre ajouté", value: `<@${member.id}>`, inline: true },
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    ), { guildId });
    return;
  }

  if (sub === "retirer") {
    await channel.permissionOverwrites.delete(member.id);
    await interaction.reply({ content: `✅ <@${member.id}> a été retiré du ticket.` });
    await sendLog(interaction.client, logEmbed(
      0xf97316, "🎫 Membre retiré du ticket",
      [
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Membre retiré", value: `<@${member.id}>`, inline: true },
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    ), { guildId });
    return;
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "ticket";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;

  const sub = args[0]?.toLowerCase();
  const config = getConfig(message.guild.id);
  const guildId = message.guild.id;

  const isStaff = config.ticketStaffRoleId
    ? message.member.roles.cache.has(config.ticketStaffRoleId)
    : message.member.permissions.has(PermissionFlagsBits.ManageChannels);

  const ticket = getTicketByChannel(message.channelId);
  const isOwner = ticket?.userId === message.author.id;

  if (sub === "reset") {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply("❌ Seuls les administrateurs peuvent réinitialiser le registre des tickets."); return;
    }
    const count = resetTickets(guildId);
    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf97316)
        .setTitle("🔄 Registre des tickets réinitialisé")
        .setDescription(
          `**${count}** ticket(s) ont été supprimés du registre interne.\n\n` +
          "⚠️ Les salons Discord **ne sont pas supprimés** automatiquement — supprime-les manuellement si nécessaire.\n" +
          "Les utilisateurs peuvent maintenant créer de nouveaux tickets normalement."
        )
        .addFields({ name: "Fait par", value: message.author.tag, inline: true })
        .setTimestamp()],
    });
    return;
  }

  if (sub === "fermer" || sub === "close") {
    if (!isTicketChannel(message.channelId)) { await message.reply("❌ Cette commande ne fonctionne que dans un salon ticket."); return; }
    if (!isStaff && !isOwner) { await message.reply("❌ Seul le staff ou le créateur du ticket peut le fermer."); return; }
    const reason = args.slice(1).join(" ") || "Aucune raison fournie";
    await doClose(message.client, message.channel as TextChannel, message.author.tag, message.author.id, reason, guildId);
    return;
  }

  if (sub === "claim") {
    if (!isTicketChannel(message.channelId)) { await message.reply("❌ Cette commande ne fonctionne que dans un salon ticket."); return; }
    if (!isStaff) { await message.reply("❌ Seul le staff peut prendre en charge un ticket."); return; }
    if (ticket?.claimedBy) { await message.reply(`❌ Ce ticket est déjà pris en charge par **${ticket.claimedBy}**.`); return; }

    claimTicket(message.channelId, message.author.tag, message.author.id);

    const claimEmbed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Ticket pris en charge")
      .setDescription(`<@${message.author.id}> prend en charge ce ticket.`)
      .addFields(
        { name: "Staff", value: message.author.tag, inline: true },
        ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : [])
      )
      .setTimestamp();

    await (message.channel as TextChannel).setTopic(`Ticket #${ticket?.ticketNumber ?? "?"} — ${ticket?.username ?? "?"} — Pris en charge par ${message.author.tag}`).catch(() => null);
    await message.reply({ embeds: [claimEmbed] });

    await sendLog(message.client, logEmbed(
      0x22c55e, "✅ Ticket pris en charge",
      [
        { name: "Salon", value: `<#${message.channelId}>`, inline: true },
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
        ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
      ],
      { tag: message.author.tag, id: message.author.id }
    ), { guildId });
    return;
  }

  if (!isStaff) { await message.reply("❌ Seul le staff peut utiliser cette commande."); return; }
  if (!isTicketChannel(message.channelId)) { await message.reply("❌ Cette commande ne fonctionne que dans un salon ticket."); return; }

  const userId = args[1]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&ticket claim` | `&ticket ajouter @membre` | `&ticket retirer @membre` | `&ticket fermer [raison]`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  const channel = message.channel as TextChannel;

  if (sub === "ajouter") {
    await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await message.reply(`✅ <@${member.id}> ajouté au ticket.`);
    await sendLog(message.client, logEmbed(
      0x6366f1, "🎫 Membre ajouté au ticket",
      [
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Membre ajouté", value: `<@${member.id}>`, inline: true },
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      ],
      { tag: message.author.tag, id: message.author.id }
    ), { guildId });
    return;
  }

  if (sub === "retirer") {
    await channel.permissionOverwrites.delete(member.id);
    await message.reply(`✅ <@${member.id}> retiré du ticket.`);
    await sendLog(message.client, logEmbed(
      0xf97316, "🎫 Membre retiré du ticket",
      [
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Membre retiré", value: `<@${member.id}>`, inline: true },
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      ],
      { tag: message.author.tag, id: message.author.id }
    ), { guildId });
    return;
  }

  await message.reply("Usage : `&ticket claim` | `&ticket ajouter @membre` | `&ticket retirer @membre` | `&ticket fermer [raison]`");
}
