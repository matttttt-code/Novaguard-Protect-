import {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  TextChannel,
  EmbedBuilder,
  ButtonInteraction,
  ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  type ApplicationCommandDataResolvable,
  Guild,
  User,
} from "discord.js";
import { commands, prefixCommands } from "./commands/index.js";
import { registerAutoMod } from "./automod.js";
import { registerPrefixHandler } from "./prefix-handler.js";
import { logger } from "../lib/logger.js";
import {
  isBlacklisted,
  getPendingUnban,
  removePendingUnban,
  removeFromBlacklist,
} from "./blacklist-store.js";
import { sendLog, logEmbed } from "./log.js";
import {
  isRaidMode, isJoinLocked, getConfig,
  setWelcomeEnabled, setWelcomeChannel, setWelcomeMessage, DEFAULT_WELCOME_MSG,
  setLeaveEnabled, setLeaveChannel, setLeaveMessage, DEFAULT_LEAVE_MSG,
} from "./guild-config-store.js";
import { buildDashboardEmbed, buildDashboardRows } from "./commands/dashboard.js";
import { getSupportRequest, removeSupportRequest } from "./pending-support-store.js";
import { handleSupportResponse } from "./commands/support.js";
import { openTicket, getTicketByChannel, getTicketChannelByUser, closeTicket, isTicketChannel, nextTicketNumber } from "./ticket-store.js";

export function startBot(): void {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_TOKEN non défini — le bot Discord ne démarrera pas.");
    return;
  }

  const hasMessageContent = process.env["DISCORD_MESSAGE_CONTENT_INTENT"] === "true";
  const hasGuildMembers = process.env["DISCORD_GUILD_MEMBERS_INTENT"] === "true";

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      ...(hasGuildMembers ? [GatewayIntentBits.GuildMembers] : []),
      ...(hasMessageContent ? [GatewayIntentBits.MessageContent] : []),
    ],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Bot Discord connecté");
    readyClient.user.setActivity("le serveur 🛡️", { type: ActivityType.Watching });

    try {
      const commandData = commands.map((c) => c.data.toJSON() as ApplicationCommandDataResolvable);
      await readyClient.application.commands.set(commandData);
      logger.info({ count: commandData.length }, "Commandes slash enregistrées avec succès");
    } catch (err) {
      logger.error({ err }, "Erreur lors de l'enregistrement des commandes");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      await handleButtonInteraction(client, interaction as ButtonInteraction);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(client, interaction as ModalSubmitInteraction);
      return;
    }
    if (!interaction.isChatInputCommand()) return;

    const command = commands.find((c) => c.data.name === interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Erreur lors de l'exécution d'une commande");
      const msg = "Une erreur est survenue lors de l'exécution de cette commande.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!message.author.bot && message.channel.isDMBased()) {
      const pending = getSupportRequest(message.author.id);
      if (pending) {
        removeSupportRequest(message.author.id);
        const config = getConfig(pending.guildId);
        const channelId = config.logChannelId;
        await handleSupportResponse(
          client,
          message.author.id,
          pending.guildId,
          pending.guildName,
          channelId,
          message.content,
          message.author.tag
        );
        await message.reply("✅ Ta réponse a bien été transmise au staff ! Un modérateur te contactera si nécessaire.");
      }
    }
  });

  registerAutoMod(client, hasMessageContent);
  registerPrefixHandler(client, prefixCommands);

  client.on(Events.GuildMemberAdd, async (member) => {
    logger.info({ guild: member.guild.name, user: member.user.tag }, "Nouveau membre rejoint");

    const guildId = member.guild.id;
    const accountAgeMs = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAgeMs / 86_400_000);
    const accountAgeHours = Math.floor(accountAgeMs / 3_600_000);
    const createdTs = Math.floor(member.user.createdTimestamp / 1000);
    const isSuspect = accountAgeHours < 24;

    if (isBlacklisted(guildId, member.id)) {
      try {
        await member.ban({ reason: "[ANTIDC] Membre blacklisté — ban automatique à la reconnexion" });
        logger.info({ user: member.user.tag }, "AntiDC : membre blacklisté banni automatiquement");

        await sendLog(
          client,
          logEmbed(0x0f0f0f, "🤖 AntiDC — Ban automatique", [
            { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
            { name: "Âge du compte", value: accountAgeDays < 1 ? `${accountAgeHours}h` : `${accountAgeDays}j`, inline: true },
            { name: "Raison", value: "Membre blacklisté — tentative de reconnexion détectée" },
          ], { tag: client.user!.tag, id: client.user!.id }),
          { guildId, pingEveryone: true, logType: "ban" }
        );
      } catch (err) {
        logger.error({ err, user: member.user.tag }, "AntiDC : impossible de bannir le membre blacklisté");
      }
      return;
    }

    if (isJoinLocked(guildId)) {
      try {
        await member.kick("Verrouillage des arrivées actif — rejoins plus tard");
        logger.info({ user: member.user.tag }, "Join lock : membre expulsé automatiquement");

        await sendLog(
          client,
          logEmbed(0xf97316, "🔒 Join Lock — Expulsion automatique", [
            { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
            { name: "Raison", value: "Verrouillage des arrivées actif" },
          ], { tag: client.user!.tag, id: client.user!.id }),
          { guildId }
        );
      } catch (err) {
        logger.error({ err }, "Join lock kick error");
      }
      return;
    }

    if (isRaidMode(guildId)) {
      try {
        await member.kick("Mode Raid actif — rejoin bloqué");
        logger.info({ user: member.user.tag }, "Raid mode : membre expulsé automatiquement");

        await sendLog(
          client,
          logEmbed(0xef4444, "🚨 Raid Mode — Expulsion automatique", [
            { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
            { name: "Raison", value: "Mode Raid actif — aucun nouveau membre autorisé" },
          ], { tag: client.user!.tag, id: client.user!.id }),
          { guildId }
        );
      } catch (err) {
        logger.error({ err }, "Raid mode kick error");
      }
      return;
    }

    const joinEmbed = new EmbedBuilder()
      .setColor(isSuspect ? 0xef4444 : 0x22c55e)
      .setTitle(isSuspect ? "⚠️ Nouveau membre — Compte suspect" : "✅ Nouveau membre")
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Compte créé le", value: `<t:${createdTs}:F>`, inline: true },
        { name: "Âge du compte", value: accountAgeDays < 1 ? `⚠️ ${accountAgeHours} heure(s)` : `${accountAgeDays} jour(s)`, inline: true },
        { name: "Membres", value: String(member.guild.memberCount), inline: true }
      )
      .setTimestamp();

    if (isSuspect) {
      joinEmbed.setDescription("⚠️ Ce compte a moins de **24 heures**. Possible compte alternatif ou suspect.");
    }

    await sendLog(client, joinEmbed, { guildId, pingEveryone: isSuspect });

    const cfg = getConfig(guildId);
    if (cfg.welcomeEnabled && cfg.welcomeChannelId) {
      try {
        const wCh = await client.channels.fetch(cfg.welcomeChannelId);
        if (wCh && wCh.isTextBased()) {
          const text = cfg.welcomeMessage
            .replace(/\{user\}/g, `<@${member.id}>`)
            .replace(/\{username\}/g, member.user.username)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{count\}/g, String(member.guild.memberCount));
          const wEmbed = new EmbedBuilder()
            .setColor(0x22c55e)
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();
          await (wCh as TextChannel).send({ embeds: [wEmbed] });
        }
      } catch (err) {
        logger.error({ err }, "Erreur envoi message d'arrivée");
      }
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    logger.info({ guild: member.guild.name, user: member.user.tag }, "Membre quitté");

    const guildId = member.guild.id;
    const createdTs = Math.floor(member.user.createdTimestamp / 1000);
    const joinedTs = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    const leaveEmbed = new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle("👋 Membre quitté")
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Membres restants", value: String(member.guild.memberCount), inline: true },
        { name: "Compte créé le", value: `<t:${createdTs}:F>`, inline: false },
        ...(joinedTs ? [{ name: "Avait rejoint le", value: `<t:${joinedTs}:F>`, inline: false }] : [])
      )
      .setTimestamp();

    await sendLog(client, leaveEmbed, { guildId });

    const lcfg = getConfig(guildId);
    if (lcfg.leaveEnabled && lcfg.leaveChannelId) {
      try {
        const lCh = await client.channels.fetch(lcfg.leaveChannelId);
        if (lCh && lCh.isTextBased()) {
          const text = lcfg.leaveMessage
            .replace(/\{user\}/g, `<@${member.id}>`)
            .replace(/\{username\}/g, member.user.username)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{count\}/g, String(member.guild.memberCount));
          const lEmbed = new EmbedBuilder()
            .setColor(0x6b7280)
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();
          await (lCh as TextChannel).send({ embeds: [lEmbed] });
        }
      } catch (err) {
        logger.error({ err }, "Erreur envoi message de départ");
      }
    }
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Impossible de se connecter à Discord");
  });
}

async function handleButtonInteraction(client: Client, interaction: ButtonInteraction): Promise<void> {
  const { customId, guild } = interaction;
  if (!guild) return;

  if (customId.startsWith("dash_")) {
    await handleDashboardButton(client, interaction);
    return;
  }

  if (customId === "ticket_create") {
    await handleTicketCreate(client, interaction);
    return;
  }

  if (customId === "ticket_close") {
    await handleTicketClose(interaction);
    return;
  }

  if (customId.startsWith("support_ticket_")) {
    const targetUserId = customId.slice("support_ticket_".length);
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    const config = getConfig(guild.id);
    const isStaff = config.ticketStaffRoleId
      ? member?.roles.cache.has(config.ticketStaffRoleId) ?? false
      : member?.permissions.has(PermissionFlagsBits.ManageMessages) ?? false;
    if (!isStaff) {
      await interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
      return;
    }
    const existingChannelId = getTicketChannelByUser(guild.id, targetUserId);
    if (existingChannelId) {
      await interaction.reply({ content: `❌ Cet utilisateur a déjà un ticket ouvert : <#${existingChannelId}>`, ephemeral: true });
      return;
    }
    let targetUser: User;
    try { targetUser = await client.users.fetch(targetUserId); }
    catch {
      await interaction.reply({ content: "❌ Impossible de trouver cet utilisateur.", ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const ticketCh = await createTicketForUser(client, guild, targetUser);
    if (!ticketCh) {
      await interaction.editReply({ content: "❌ Impossible de créer le salon ticket." });
      return;
    }
    await interaction.editReply({ content: `✅ Ticket créé pour <@${targetUserId}> : <#${ticketCh.id}>` });
    await interaction.message.edit({ components: [] }).catch(() => null);
    try {
      await targetUser.send(`📬 Le staff a ouvert un ticket pour ta demande de support sur **${guild.name}**. Rendez-vous dans <#${ticketCh.id}> !`);
    } catch { /* DMs fermés */ }
    return;
  }

  if (customId.startsWith("support_dm_")) {
    const targetUserId = customId.slice("support_dm_".length);
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    const config = getConfig(guild.id);
    const isStaff = config.ticketStaffRoleId
      ? member?.roles.cache.has(config.ticketStaffRoleId) ?? false
      : member?.permissions.has(PermissionFlagsBits.ManageMessages) ?? false;
    if (!isStaff) {
      await interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
      return;
    }
    let targetUser: User;
    try { targetUser = await client.users.fetch(targetUserId); }
    catch {
      await interaction.reply({ content: "❌ Impossible de trouver cet utilisateur.", ephemeral: true });
      return;
    }
    try {
      await targetUser.send(
        `📬 Bonjour ! Ta demande de support sur **${guild.name}** a bien été vue par le staff. Tu auras une réponse très bientôt ! 😊`
      );
      await interaction.reply({ content: `✅ Message envoyé en DM à ${targetUser.tag}.`, ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Impossible d'envoyer un DM (DMs fermés).", ephemeral: true });
    }
    await interaction.message.edit({ components: [] }).catch(() => null);
    return;
  }

  const isApprove = customId.startsWith("bl_approve_");
  const isDeny = customId.startsWith("bl_deny_");
  if (!isApprove && !isDeny) return;

  const guildMember = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!guildMember?.permissions.has(BigInt(0x8))) {
    await interaction.reply({ content: "❌ Seuls les administrateurs peuvent valider ou refuser un déban.", ephemeral: true });
    return;
  }

  const userId = customId.replace("bl_approve_", "").replace("bl_deny_", "");
  const pending = getPendingUnban(userId);

  if (!pending) {
    await interaction.reply({ content: "❌ Cette demande est expirée ou déjà traitée.", ephemeral: true });
    await interaction.message.edit({ components: [] }).catch(() => null);
    return;
  }

  if (isApprove) {
    try {
      await guild.members.unban(userId, `Déban validé par ${interaction.user.tag}`);
      removeFromBlacklist(guild.id, userId);
      removePendingUnban(userId);

      const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("✅ Déban validé")
        .addFields(
          { name: "Utilisateur", value: `${pending.userTag} (\`${userId}\`)`, inline: true },
          { name: "Validé par", value: interaction.user.tag, inline: true },
          { name: "Demandé par", value: pending.requesterTag, inline: true },
          { name: "Raison du déban", value: pending.reason }
        ).setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await interaction.message.edit({ components: [] }).catch(() => null);

      await sendLog(client, logEmbed(0x22c55e, "✅ Déban blacklist validé", [
        { name: "Utilisateur", value: `${pending.userTag} (\`${userId}\`)`, inline: true },
        { name: "Demandé par", value: pending.requesterTag, inline: true },
        { name: "Raison", value: pending.reason },
      ], { tag: interaction.user.tag, id: interaction.user.id }),
      { guildId: guild.id, logType: "ban" });
    } catch (err) {
      logger.error({ err }, "Impossible de débannir le membre blacklisté");
      await interaction.reply({ content: "❌ Impossible de débannir cet utilisateur.", ephemeral: true });
    }
  }

  if (isDeny) {
    removePendingUnban(userId);

    const embed = new EmbedBuilder().setColor(0xef4444).setTitle("❌ Déban refusé")
      .addFields(
        { name: "Utilisateur", value: `${pending.userTag} (\`${userId}\`)`, inline: true },
        { name: "Refusé par", value: interaction.user.tag, inline: true },
        { name: "Demandé par", value: pending.requesterTag, inline: true }
      ).setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await interaction.message.edit({ components: [] }).catch(() => null);

    await sendLog(client, logEmbed(0xef4444, "❌ Déban blacklist refusé", [
      { name: "Utilisateur", value: `${pending.userTag} (\`${userId}\`)`, inline: true },
      { name: "Demandé par", value: pending.requesterTag, inline: true },
    ], { tag: interaction.user.tag, id: interaction.user.id }),
    { guildId: guild.id, logType: "ban" });
  }
}

async function createTicketForUser(client: Client, guild: Guild, user: User): Promise<TextChannel | null> {
  const config = getConfig(guild.id);
  const ticketNumber = nextTicketNumber(guild.id);
  const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20);
  const channelName = `🎫-${safeName}-${ticketNumber}`;

  const permOverwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
    ...(config.ticketStaffRoleId ? [{ id: config.ticketStaffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }] : []),
  ];

  let ticketChannel: TextChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId ?? undefined,
      permissionOverwrites: permOverwrites,
      topic: `Ticket #${ticketNumber} — ${user.tag} (${user.id})`,
    }) as TextChannel;
  } catch (err) {
    logger.error({ err }, "Erreur lors de la création du salon ticket");
    return null;
  }

  openTicket({
    channelId: ticketChannel.id,
    ticketNumber,
    userId: user.id,
    username: user.tag,
    guildId: guild.id,
    createdAt: new Date(),
    claimedBy: null,
    claimedById: null,
  });

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🎫 Nouveau ticket")
    .setDescription(
      `Bonjour <@${user.id}> ! Le staff sera avec toi dans quelques instants.\n\n` +
      "**Décris ton problème ou ta demande ci-dessous.**\n" +
      "Pour fermer ce ticket, clique sur le bouton ci-dessous ou utilise `/ticket fermer`."
    )
    .addFields(
      { name: "Créateur", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Ouvert le", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      ...(config.ticketStaffRoleId ? [{ name: "Staff notifié", value: `<@&${config.ticketStaffRoleId}>`, inline: true }] : [])
    )
    .setTimestamp();

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("🔒  Fermer le ticket")
      .setStyle(ButtonStyle.Danger)
  );

  const staffPing = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : "";
  await ticketChannel.send({
    content: `<@${user.id}>${staffPing ? ` ${staffPing}` : ""}`,
    embeds: [welcomeEmbed],
    components: [closeRow],
  });

  await sendLog(client, new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🎫 Ticket ouvert")
    .addFields(
      { name: "Créateur", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Salon", value: `<#${ticketChannel.id}>`, inline: true },
    ).setTimestamp(),
    { guildId: guild.id }
  );

  return ticketChannel;
}

async function handleTicketCreate(client: Client, interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild!;
  const user = interaction.user;

  const existingChannelId = getTicketChannelByUser(guild.id, user.id);
  if (existingChannelId) {
    await interaction.reply({
      content: `❌ Tu as déjà un ticket ouvert : <#${existingChannelId}>`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketChannel = await createTicketForUser(client, guild, user);
  if (!ticketChannel) {
    await interaction.editReply({ content: "❌ Impossible de créer le salon ticket. Vérifie les permissions du bot." });
    return;
  }

  await interaction.editReply({ content: `✅ Ton ticket a été créé : <#${ticketChannel.id}>` });
}

async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild!;
  const user = interaction.user;
  const config = getConfig(guild.id);

  if (!isTicketChannel(channel.id)) {
    await interaction.reply({ content: "❌ Ce n'est pas un salon ticket.", ephemeral: true });
    return;
  }

  const ticket = getTicketByChannel(channel.id);
  const member = await guild.members.fetch(user.id).catch(() => null);

  const isStaff = config.ticketStaffRoleId
    ? member?.roles.cache.has(config.ticketStaffRoleId) ?? false
    : member?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;

  const isOwner = ticket?.userId === user.id;

  if (!isStaff && !isOwner) {
    await interaction.reply({ content: "❌ Seul le staff ou le créateur du ticket peut le fermer.", ephemeral: true });
    return;
  }

  await interaction.reply({ content: "🔒 Fermeture du ticket...", ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔒 Ticket fermé")
    .addFields(
      { name: "Fermé par", value: user.tag, inline: true },
      ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : [])
    )
    .setFooter({ text: "Ce salon sera supprimé dans 5 secondes." })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  await interaction.message.edit({ components: [] }).catch(() => null);

  closeTicket(channel.id);

  await sendLog(interaction.client, logEmbed(
    0xef4444, "🔒 Ticket fermé (bouton)",
    [
      { name: "Salon", value: channel.name, inline: true },
      { name: "Fermé par", value: user.tag, inline: true },
      ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
      ...(ticket?.claimedBy ? [{ name: "Pris en charge par", value: ticket.claimedBy, inline: true }] : []),
    ],
    { tag: user.tag, id: user.id }
  ), { guildId: guild.id });

  setTimeout(async () => {
    await channel.delete("Ticket fermé").catch(() => null);
  }, 5000);
}

async function handleDashboardButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  const { customId, guild } = interaction;
  if (!guild) return;

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "❌ Seuls les administrateurs peuvent utiliser le dashboard.", ephemeral: true });
    return;
  }

  const guildId = guild.id;

  if (customId === "dash_welcome_toggle") {
    const cfg = getConfig(guildId);
    setWelcomeEnabled(guildId, !cfg.welcomeEnabled);
    const newCfg = getConfig(guildId);
    await interaction.update({ embeds: [buildDashboardEmbed(newCfg, guild)], components: buildDashboardRows(newCfg) });
    return;
  }

  if (customId === "dash_leave_toggle") {
    const cfg = getConfig(guildId);
    setLeaveEnabled(guildId, !cfg.leaveEnabled);
    const newCfg = getConfig(guildId);
    await interaction.update({ embeds: [buildDashboardEmbed(newCfg, guild)], components: buildDashboardRows(newCfg) });
    return;
  }

  if (customId === "dash_reset_welcome_msg") {
    setWelcomeMessage(guildId, DEFAULT_WELCOME_MSG);
    const newCfg = getConfig(guildId);
    await interaction.update({ embeds: [buildDashboardEmbed(newCfg, guild)], components: buildDashboardRows(newCfg) });
    return;
  }

  if (customId === "dash_reset_leave_msg") {
    setLeaveMessage(guildId, DEFAULT_LEAVE_MSG);
    const newCfg = getConfig(guildId);
    await interaction.update({ embeds: [buildDashboardEmbed(newCfg, guild)], components: buildDashboardRows(newCfg) });
    return;
  }

  if (customId === "dash_welcome_channel") {
    const modal = new ModalBuilder()
      .setCustomId("dash_modal_welcome_channel")
      .setTitle("Salon des messages d'arrivée")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("channel_id")
            .setLabel("ID ou mention du salon (#salon ou ID)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("ex : 123456789012345678 ou <#123456789012345678>")
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (customId === "dash_welcome_msg") {
    const cfg = getConfig(guildId);
    const modal = new ModalBuilder()
      .setCustomId("dash_modal_welcome_msg")
      .setTitle("Message d'arrivée")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Message ({user} {username} {server} {count})")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(cfg.welcomeMessage)
            .setMaxLength(500)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (customId === "dash_leave_channel") {
    const modal = new ModalBuilder()
      .setCustomId("dash_modal_leave_channel")
      .setTitle("Salon des messages de départ")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("channel_id")
            .setLabel("ID ou mention du salon (#salon ou ID)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("ex : 123456789012345678 ou <#123456789012345678>")
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (customId === "dash_leave_msg") {
    const cfg = getConfig(guildId);
    const modal = new ModalBuilder()
      .setCustomId("dash_modal_leave_msg")
      .setTitle("Message de départ")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Message ({user} {username} {server} {count})")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(cfg.leaveMessage)
            .setMaxLength(500)
        )
      );
    await interaction.showModal(modal);
    return;
  }
}

async function handleModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  const { customId, guild } = interaction;
  if (!guild) return;

  const guildId = guild.id;

  function parseChannelId(raw: string): string {
    return raw.replace(/[<#>]/g, "").trim();
  }

  if (customId === "dash_modal_welcome_channel") {
    const raw = interaction.fields.getTextInputValue("channel_id");
    const channelId = parseChannelId(raw);
    setWelcomeChannel(guildId, channelId);
    const newCfg = getConfig(guildId);
    await interaction.reply({
      content: `✅ Salon d'arrivée défini sur <#${channelId}>.`,
      embeds: [buildDashboardEmbed(newCfg, guild)],
      components: buildDashboardRows(newCfg),
      ephemeral: true,
    });
    return;
  }

  if (customId === "dash_modal_welcome_msg") {
    const msg = interaction.fields.getTextInputValue("message");
    setWelcomeMessage(guildId, msg);
    const newCfg = getConfig(guildId);
    await interaction.reply({
      content: "✅ Message d'arrivée mis à jour.",
      embeds: [buildDashboardEmbed(newCfg, guild)],
      components: buildDashboardRows(newCfg),
      ephemeral: true,
    });
    return;
  }

  if (customId === "dash_modal_leave_channel") {
    const raw = interaction.fields.getTextInputValue("channel_id");
    const channelId = parseChannelId(raw);
    setLeaveChannel(guildId, channelId);
    const newCfg = getConfig(guildId);
    await interaction.reply({
      content: `✅ Salon de départ défini sur <#${channelId}>.`,
      embeds: [buildDashboardEmbed(newCfg, guild)],
      components: buildDashboardRows(newCfg),
      ephemeral: true,
    });
    return;
  }

  if (customId === "dash_modal_leave_msg") {
    const msg = interaction.fields.getTextInputValue("message");
    setLeaveMessage(guildId, msg);
    const newCfg = getConfig(guildId);
    await interaction.reply({
      content: "✅ Message de départ mis à jour.",
      embeds: [buildDashboardEmbed(newCfg, guild)],
      components: buildDashboardRows(newCfg),
      ephemeral: true,
    });
    return;
  }
}
