import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { getAlertPing } from "../alert-ping.js";
import { getConfig } from "../guild-config-store.js";
import { logger } from "../../lib/logger.js";
import {
  isBlacklisted,
  getBlacklistEntry,
  removeFromBlacklist,
  addPendingUnban,
} from "../blacklist-store.js";

async function sendUnbanApproval(
  client: ChatInputCommandInteraction["client"],
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  userId: string,
  userTag: string,
  reason: string,
  requesterTag: string,
  requesterId: string
): Promise<void> {
  addPendingUnban({ userId, userTag, guildId: guild.id, requesterId, requesterTag, reason });

  const entry = getBlacklistEntry(guild.id, userId);

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("⚠️ Demande de déban — Blacklist")
    .setDescription("Un membre de la liste noire fait l'objet d'une demande de déban. **Un administrateur doit valider ou refuser.**")
    .addFields(
      { name: "Utilisateur", value: `${userTag} (\`${userId}\`)`, inline: true },
      { name: "Demandeur", value: `${requesterTag} (\`${requesterId}\`)`, inline: true },
      { name: "Raison du déban", value: reason },
      ...(entry
        ? [
            { name: "Raison du blacklist initial", value: entry.reason, inline: true },
            { name: "Blacklisté par", value: entry.moderatorTag, inline: true },
          ]
        : [])
    )
    .setTimestamp();

  const approveBtn = new ButtonBuilder()
    .setCustomId(`bl_approve_${userId}`)
    .setLabel("✅ Valider le déban")
    .setStyle(ButtonStyle.Success);

  const denyBtn = new ButtonBuilder()
    .setCustomId(`bl_deny_${userId}`)
    .setLabel("❌ Refuser")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, denyBtn);

  const logChannelId = getConfig(guild.id).logChannelId;
  if (!logChannelId) return;

  try {
    const channel = await client.channels.fetch(logChannelId);
    if (channel && channel.isTextBased()) {
      await (channel as import("discord.js").TextChannel).send({
        content: getAlertPing(guild.id),
        embeds: [embed],
        components: [row],
      });
    }
  } catch (err) {
    logger.error({ err }, "Impossible d'envoyer la demande de déban");
  }
}

export const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Débannit un utilisateur par son ID")
  .addStringOption((o) =>
    o.setName("id").setDescription("L'ID de l'utilisateur à débannir").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du débannissement")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.options.getString("id", true);
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!interaction.guild) {
    return interaction.reply({ content: "Cette commande n'est disponible que sur un serveur.", ephemeral: true });
  }

  let ban;
  try {
    ban = await interaction.guild.bans.fetch(userId);
  } catch {
    return interaction.reply({ content: "Cet utilisateur n'est pas banni ou l'ID est invalide.", ephemeral: true });
  }

  if (isBlacklisted(interaction.guild.id, userId)) {
    await interaction.reply({
      content: "⚠️ Cet utilisateur est dans la **liste noire**. Une demande d'approbation a été envoyée dans le salon de logs avec un ping @here. Un administrateur doit valider.",
      ephemeral: true,
    });
    await sendUnbanApproval(
      interaction.client, interaction.guild, userId, ban.user.tag,
      reason, interaction.user.tag, interaction.user.id
    );
    return;
  }

  await interaction.guild.members.unban(userId, reason);

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Utilisateur débanni")
    .addFields(
      { name: "Utilisateur", value: `${ban.user.tag} (\`${userId}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(0x22c55e, "✅ Utilisateur débanni", [
      { name: "Utilisateur", value: `${ban.user.tag} (\`${userId}\`)`, inline: true },
      { name: "Raison", value: reason },
    ], { tag: interaction.user.tag, id: interaction.user.id })
  );
}

export const prefixName = "unban";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;

  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("❌ Permission insuffisante (BanMembers requise).");
    return;
  }

  const userId = args[0];
  if (!userId) {
    await message.reply("Usage : `&unban <userId> [raison]`");
    return;
  }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  let ban;
  try {
    ban = await message.guild.bans.fetch(userId);
  } catch {
    await message.reply("❌ Cet utilisateur n'est pas banni ou l'ID est invalide.");
    return;
  }

  if (isBlacklisted(message.guild.id, userId)) {
    await message.reply("⚠️ Cet utilisateur est dans la **liste noire**. Une demande d'approbation a été envoyée dans le salon de logs avec un ping @here. Un administrateur doit valider.");
    await sendUnbanApproval(
      message.client, message.guild, userId, ban.user.tag,
      reason, message.author.tag, message.author.id
    );
    return;
  }

  await message.guild.members.unban(userId, reason);

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Utilisateur débanni")
    .addFields(
      { name: "Utilisateur", value: `${ban.user.tag} (\`${userId}\`)`, inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(
    message.client,
    logEmbed(0x22c55e, "✅ Utilisateur débanni", [
      { name: "Utilisateur", value: `${ban.user.tag} (\`${userId}\`)`, inline: true },
      { name: "Raison", value: reason },
      { name: "Via", value: "Commande préfixe", inline: true },
    ], { tag: message.author.tag, id: message.author.id })
  );
}
