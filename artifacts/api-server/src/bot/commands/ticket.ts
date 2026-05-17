import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildMember,
  TextChannel,
  OverwriteType,
} from "discord.js";
import { isTicketChannel, getTicketByChannel } from "../ticket-store.js";
import { getConfig } from "../guild-config-store.js";

async function doClose(channel: TextChannel, closedBy: string, reason: string): Promise<void> {
  const ticket = getTicketByChannel(channel.id);

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔒 Ticket fermé")
    .addFields(
      { name: "Fermé par", value: closedBy, inline: true },
      { name: "Raison", value: reason, inline: true },
      ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : [])
    )
    .setFooter({ text: "Ce salon sera supprimé dans 5 secondes." })
    .setTimestamp();

  await channel.send({ embeds: [embed] });

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
    sub.setName("ajouter")
      .setDescription("Ajoute un membre à ce ticket")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre à ajouter").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("retirer")
      .setDescription("Retire un membre de ce ticket")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre à retirer").setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channelId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const channel = interaction.channel as TextChannel;
  const sub = interaction.options.getSubcommand();
  const config = getConfig(interaction.guild.id);
  const guildMember = interaction.member as GuildMember;

  const isStaff = config.ticketStaffRoleId
    ? guildMember.roles.cache.has(config.ticketStaffRoleId)
    : guildMember.permissions.has(PermissionFlagsBits.ManageChannels);

  const ticket = getTicketByChannel(interaction.channelId);
  const isOwner = ticket?.userId === interaction.user.id;

  if (sub === "fermer") {
    if (!isTicketChannel(interaction.channelId)) {
      return interaction.reply({ content: "❌ Cette commande ne fonctionne que dans un salon ticket.", ephemeral: true });
    }
    if (!isStaff && !isOwner) {
      return interaction.reply({ content: "❌ Seul le staff ou le créateur du ticket peut le fermer.", ephemeral: true });
    }
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
    await interaction.reply({ content: "🔒 Fermeture du ticket en cours...", ephemeral: true });
    await doClose(channel, interaction.user.tag, reason);
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
    return interaction.reply({ content: `✅ <@${member.id}> a été ajouté au ticket.` });
  }

  if (sub === "retirer") {
    await channel.permissionOverwrites.delete(member.id);
    return interaction.reply({ content: `✅ <@${member.id}> a été retiré du ticket.` });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "ticket";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;

  const sub = args[0]?.toLowerCase();
  const config = getConfig(message.guild.id);

  const isStaff = config.ticketStaffRoleId
    ? message.member.roles.cache.has(config.ticketStaffRoleId)
    : message.member.permissions.has(PermissionFlagsBits.ManageChannels);

  const ticket = getTicketByChannel(message.channelId);
  const isOwner = ticket?.userId === message.author.id;

  if (sub === "fermer" || sub === "close") {
    if (!isTicketChannel(message.channelId)) { await message.reply("❌ Cette commande ne fonctionne que dans un salon ticket."); return; }
    if (!isStaff && !isOwner) { await message.reply("❌ Seul le staff ou le créateur du ticket peut le fermer."); return; }
    const reason = args.slice(1).join(" ") || "Aucune raison fournie";
    await doClose(message.channel as TextChannel, message.author.tag, reason);
    return;
  }

  if (!isStaff) { await message.reply("❌ Seul le staff peut utiliser cette commande."); return; }
  if (!isTicketChannel(message.channelId)) { await message.reply("❌ Cette commande ne fonctionne que dans un salon ticket."); return; }

  const userId = args[1]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("Usage : `&ticket ajouter @membre` | `&ticket retirer @membre` | `&ticket fermer [raison]`"); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  const channel = message.channel as TextChannel;

  if (sub === "ajouter") {
    await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await message.reply(`✅ <@${member.id}> ajouté au ticket.`);
    return;
  }

  if (sub === "retirer") {
    await channel.permissionOverwrites.delete(member.id);
    await message.reply(`✅ <@${member.id}> retiré du ticket.`);
    return;
  }

  await message.reply("Usage : `&ticket ajouter @membre` | `&ticket retirer @membre` | `&ticket fermer [raison]`");
}
