import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  TextChannel,
  GuildMember,
} from "discord.js";
import { getTicketByChannel } from "../ticket-store.js";
import { getConfig } from "../guild-config-store.js";

async function buildTranscript(channel: TextChannel): Promise<Buffer> {
  const fetched = await channel.messages.fetch({ limit: 100 });
  const sorted = [...fetched.values()].reverse();

  const lines = sorted.map((m) => {
    const ts = new Date(m.createdTimestamp).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    let content = m.content || "";
    if (!content && m.embeds.length) content = `[Embed: ${m.embeds[0]?.title ?? "sans titre"}]`;
    if (!content && m.attachments.size) content = `[Pièce jointe: ${[...m.attachments.values()].map((a) => a.url).join(", ")}]`;
    if (!content) content = "[Message vide]";
    const pinged = m.mentions.users.size ? ` (mentionne: ${m.mentions.users.map((u) => u.tag).join(", ")})` : "";
    return `[${ts}] ${m.author.tag} (${m.author.id}): ${content}${pinged}`;
  });

  const header = [
    `=== TRANSCRIPT — #${channel.name} ===`,
    `Généré le : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
    `Messages récupérés : ${lines.length}`,
    "=".repeat(48),
    "",
  ].join("\n");

  return Buffer.from(header + lines.join("\n"), "utf-8");
}

export const data = new SlashCommandBuilder()
  .setName("transcript")
  .setDescription("Génère un transcript du ticket et l'envoie dans le salon de transcripts")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const channel = interaction.channel as TextChannel;
  const config = getConfig(interaction.guild.id);
  const member = interaction.member as GuildMember;

  const isStaff = config.ticketStaffRoleId
    ? member.roles.cache.has(config.ticketStaffRoleId)
    : member.permissions.has(PermissionFlagsBits.ManageChannels);

  if (!isStaff) {
    return interaction.reply({ content: "❌ Seul le staff peut générer un transcript.", ephemeral: true });
  }

  const ticket = getTicketByChannel(interaction.channelId);
  if (!ticket) {
    return interaction.reply({ content: "❌ Cette commande ne fonctionne que dans un salon ticket.", ephemeral: true });
  }

  if (!config.transcriptChannelId) {
    return interaction.reply({
      content: "❌ Aucun salon de transcripts configuré. Utilise `/settranscript #salon` d'abord.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const buffer = await buildTranscript(channel);
    const transcriptChannel = await interaction.client.channels.fetch(config.transcriptChannelId) as TextChannel | null;

    if (!transcriptChannel || !transcriptChannel.isTextBased()) {
      return interaction.editReply({ content: "❌ Le salon de transcripts est introuvable ou invalide." });
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle("📄 Transcript de ticket")
      .addFields(
        { name: "Salon", value: `#${channel.name}`, inline: true },
        { name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true },
        { name: "Créateur", value: `<@${ticket.userId}>`, inline: true },
        { name: "Généré par", value: interaction.user.tag, inline: true },
        ...(ticket.claimedBy ? [{ name: "Pris en charge par", value: ticket.claimedBy, inline: true }] : []),
        { name: "Ouvert le", value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:F>`, inline: false },
      )
      .setTimestamp();

    await transcriptChannel.send({
      embeds: [embed],
      files: [{ attachment: buffer, name: `transcript-ticket-${ticket.ticketNumber}.txt` }],
    });

    return interaction.editReply({ content: `✅ Transcript envoyé dans <#${config.transcriptChannelId}>.` });
  } catch (err) {
    return interaction.editReply({ content: "❌ Erreur lors de la génération du transcript." });
  }
}

export const prefixName = "transcript";
export const prefixAliases = ["trs"];

export async function executeMessage(message: Message) {
  if (!message.guild || !message.member) return;

  const config = getConfig(message.guild.id);

  const isStaff = config.ticketStaffRoleId
    ? message.member.roles.cache.has(config.ticketStaffRoleId)
    : message.member.permissions.has(PermissionFlagsBits.ManageChannels);

  if (!isStaff) {
    await message.reply("❌ Seul le staff peut générer un transcript."); return;
  }

  const ticket = getTicketByChannel(message.channelId);
  if (!ticket) {
    await message.reply("❌ Cette commande ne fonctionne que dans un salon ticket."); return;
  }

  if (!config.transcriptChannelId) {
    await message.reply("❌ Aucun salon de transcripts configuré. Utilise `&settranscript #salon` d'abord."); return;
  }

  try {
    const channel = message.channel as TextChannel;
    const buffer = await buildTranscript(channel);
    const transcriptChannel = await message.client.channels.fetch(config.transcriptChannelId) as TextChannel | null;

    if (!transcriptChannel || !transcriptChannel.isTextBased()) {
      await message.reply("❌ Le salon de transcripts est introuvable ou invalide."); return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle("📄 Transcript de ticket")
      .addFields(
        { name: "Salon", value: `#${channel.name}`, inline: true },
        { name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true },
        { name: "Créateur", value: `<@${ticket.userId}>`, inline: true },
        { name: "Généré par", value: message.author.tag, inline: true },
        ...(ticket.claimedBy ? [{ name: "Pris en charge par", value: ticket.claimedBy, inline: true }] : []),
        { name: "Ouvert le", value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:F>`, inline: false },
      )
      .setTimestamp();

    await transcriptChannel.send({
      embeds: [embed],
      files: [{ attachment: buffer, name: `transcript-ticket-${ticket.ticketNumber}.txt` }],
    });

    await message.reply(`✅ Transcript envoyé dans <#${config.transcriptChannelId}>.`);
  } catch {
    await message.reply("❌ Erreur lors de la génération du transcript.");
  }
}
