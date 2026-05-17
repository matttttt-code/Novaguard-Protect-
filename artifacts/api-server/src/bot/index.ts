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
  Message,
  GuildVerificationLevel,
  VoiceChannel,
} from "discord.js";
import { commands, prefixCommands } from "./commands/index.js";
import { registerAutoMod } from "./automod.js";
import { registerPrefixHandler } from "./prefix-handler.js";
import { logger } from "../lib/logger.js";
import {
  isBlacklisted,
  isGloballyBlacklisted,
  getPendingUnban,
  removePendingUnban,
  removeFromBlacklist,
} from "./blacklist-store.js";
import { sendLog, logEmbed } from "./log.js";
import {
  isRaidMode, isJoinLocked, getConfig, isRaidMode2,
  setRaidMode, setJoinLock, setRaidMode2,
  setLogChannel, setBanLogChannel, setGeneralLogChannel, setInviteLogChannel,
  setWelcomeEnabled, setWelcomeChannel, setWelcomeMessage, DEFAULT_WELCOME_MSG,
  setLeaveEnabled, setLeaveChannel, setLeaveMessage, DEFAULT_LEAVE_MSG,
  setCaptchaEnabled, setCaptchaChannel, setCaptchaUnverifiedRole, setCaptchaVerifiedRole,
  setSanctionDmEnabled,
  setSecurityLevel,
} from "./guild-config-store.js";
import { getPendingLevel3, removePendingLevel3, markOwnerApproved } from "./security-pending-store.js";
import { getPendingRaid2, removePendingRaid2 } from "./raid2-pending-store.js";
import { buildSecureEmbed } from "./commands/secure.js";
import {
  getCaptcha, setCaptcha, deleteCaptcha, hasCaptcha, decrementAttempts,
  generateChallenge, setChallengeMessageId,
} from "./captcha-store.js";
import { buildDashboardEmbed, buildDashboardRows } from "./commands/dashboard.js";
import { registerGeneralLog } from "./general-log.js";
import { captchaTimeouts } from "./captcha-timeout-store.js";
import { handleRoleRequestModal } from "./commands/rolerequest.js";
import { registerBotAlerts, sendStartupAlert, sendCommandErrorAlert, sendButtonErrorAlert, sendModalErrorAlert, sendClientErrorAlert, generateErrorCode } from "./bot-alerts.js";
import { sendLogDM, LOG_DM_USER_ID, sendAdminsDM, requestAdminDMApproval } from "./dm-notify.js";
import { getAdminDMPending, removeAdminDMPending } from "./admin-dm-pending-store.js";
import { initInviteTracker, onMemberJoin, onMemberLeave } from "./invite-tracker.js";
import { isInviteBlacklisted } from "./invite-blacklist-store.js";
import { getSupportRequest, removeSupportRequest } from "./pending-support-store.js";
import { handleSupportResponse } from "./commands/support.js";
import { openTicket, getTicketByChannel, getTicketChannelByUser, closeTicket, isTicketChannel, nextTicketNumber } from "./ticket-store.js";

function isValidId(s: string): boolean {
  return /^\d{17,20}$/.test(s.trim());
}

function parseId(raw: string): string {
  return raw.replace(/[<#@&!>]/g, "").trim();
}

export function startBot(): void {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_TOKEN non défini — le bot Discord ne démarrera pas.");
    return;
  }

  const hasMessageContent = process.env["DISCORD_MESSAGE_CONTENT_INTENT"] === "true";
  const hasPresenceIntent = process.env["DISCORD_PRESENCE_INTENT"] === "true";

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildModeration,
      ...(hasMessageContent ? [GatewayIntentBits.MessageContent] : []),
      ...(hasPresenceIntent ? [GatewayIntentBits.GuildPresences] : []),
    ],
  });

  // Empêche le crash du process sur erreur non gérée du client
  client.on("error", (err) => {
    const errCode = generateErrorCode();
    logger.error({ err, errCode }, "Erreur non gérée du client Discord");
    void sendClientErrorAlert(client, err, errCode).catch(() => null);
  });
  registerBotAlerts(client);

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Bot Discord connecté");
    readyClient.user.setActivity("le serveur 🛡️", { type: ActivityType.Watching });

    try {
      const commandData = commands.map((c) => c.data.toJSON() as ApplicationCommandDataResolvable);
      // Enregistrement par serveur uniquement (instantané, sans doublon global)
      await Promise.all(
        readyClient.guilds.cache.map(g => g.commands.set(commandData).catch(() => null)),
      );
      logger.info({ count: commandData.length }, "Commandes slash enregistrées avec succès");
    } catch (err) {
      logger.error({ err }, "Erreur lors de l'enregistrement des commandes");
    }

    await sendStartupAlert(readyClient).catch(() => null);
    await initInviteTracker(readyClient).catch(() => null);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      try {
        await handleButtonInteraction(client, btn);
      } catch (err) {
        const errCode = generateErrorCode();
        logger.error({ err, errCode, customId: btn.customId }, "Erreur bouton");
        void sendButtonErrorAlert(client, btn.customId, interaction.guild?.name ?? null, interaction.user.id, err, errCode).catch(() => null);
        try {
          const msg = `❌ Une erreur est survenue (code : \`${errCode}\`). Transmets ce code au support.`;
          if (btn.replied || btn.deferred) await btn.followUp({ content: msg, ephemeral: true });
          else await btn.reply({ content: msg, ephemeral: true });
        } catch { /* interaction expirée */ }
      }
      return;
    }
    if (interaction.isModalSubmit()) {
      const modal = interaction as ModalSubmitInteraction;
      try {
        await handleModalSubmit(client, modal);
      } catch (err) {
        const errCode = generateErrorCode();
        logger.error({ err, errCode, customId: modal.customId }, "Erreur modal");
        void sendModalErrorAlert(client, modal.customId, interaction.guild?.name ?? null, interaction.user.id, err, errCode).catch(() => null);
        try {
          const msg = `❌ Une erreur est survenue (code : \`${errCode}\`). Transmets ce code au support.`;
          if (modal.replied || modal.deferred) await modal.followUp({ content: msg, ephemeral: true });
          else await modal.reply({ content: msg, ephemeral: true });
        } catch { /* interaction expirée */ }
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;

    const command = commands.find((c) => c.data.name === interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      const errCode = generateErrorCode();
      logger.error({ err, errCode, command: interaction.commandName }, "Erreur lors de l'exécution d'une commande");
      void sendCommandErrorAlert(
        client,
        interaction.commandName,
        interaction.guild?.name ?? null,
        interaction.user.id,
        err,
        errCode,
      ).catch(() => null);
      try {
        const msg = `❌ Une erreur est survenue (code : \`${errCode}\`). Transmets ce code au support.`;
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: msg, ephemeral: true });
        } else {
          await interaction.reply({ content: msg, ephemeral: true });
        }
      } catch { /* salon supprimé ou interaction expirée — on ignore */ }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // === CAPTCHA CHANNEL (non-DM) ===
    if (!message.channel.isDMBased() && message.guildId && hasCaptcha(message.author.id)) {
      const challenge = getCaptcha(message.author.id)!;
      const cfg = getConfig(challenge.guildId);
      if (cfg.captchaChannelId && message.channelId === cfg.captchaChannelId && message.guildId === challenge.guildId) {
        await handleCaptchaChannelMessage(client, message, captchaTimeouts);
        return;
      }
    }

    if (!message.channel.isDMBased()) return;

    // === DM : CAPTCHA fallback (pas de salon configuré) ===
    if (hasCaptcha(message.author.id)) {
      const challenge = getCaptcha(message.author.id)!;
      const cfg = getConfig(challenge.guildId);
      if (!cfg.captchaChannelId) {
        await handleCaptchaDM(client, message, captchaTimeouts);
        return;
      }
    }

    // === DM : réponse support ===
    const pending = getSupportRequest(message.author.id);
    if (pending) {
      removeSupportRequest(message.author.id);
      const config = getConfig(pending.guildId);
      await handleSupportResponse(
        client,
        message.author.id,
        pending.guildId,
        pending.guildName,
        config.logChannelId,
        message.content,
        message.author.tag
      );
      await message.reply("✅ Ta réponse a bien été transmise au staff ! Un modérateur te contactera si nécessaire.");
    }
  });

  registerAutoMod(client, hasMessageContent);
  registerPrefixHandler(client, prefixCommands);
  registerGeneralLog(client);

  // ──── GUILD MEMBER ADD ────
  client.on(Events.GuildMemberAdd, async (member) => {
    logger.info({ guild: member.guild.name, user: member.user.tag }, "Nouveau membre rejoint");

    const guildId = member.guild.id;
    const accountAgeMs = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAgeMs / 86_400_000);
    const accountAgeHours = Math.floor(accountAgeMs / 3_600_000);
    const createdTs = Math.floor(member.user.createdTimestamp / 1000);
    const secLvl = getConfig(guildId).securityLevel;
    const hasNoAvatar = !member.user.avatar;
    const suspectThresholdDays = secLvl >= 3 ? 7 : secLvl >= 2 ? 3 : 0;
    const isSuspect = accountAgeHours < 24 || (suspectThresholdDays > 0 && accountAgeDays < suspectThresholdDays);
    const isSuspiciousCheckEnabled = getConfig(guildId).suspiciousCheckEnabled;

    // Blacklist locale
    if (isBlacklisted(guildId, member.id)) {
      try {
        await member.ban({ reason: "[ANTIDC] Membre blacklisté — ban automatique à la reconnexion" });
        await sendLog(client, logEmbed(0x0f0f0f, "🤖 AntiDC — Ban automatique", [
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Âge du compte", value: accountAgeDays < 1 ? `${accountAgeHours}h` : `${accountAgeDays}j`, inline: true },
          { name: "Raison", value: "Membre blacklisté — tentative de reconnexion" },
        ], { tag: client.user!.tag, id: client.user!.id }), { guildId, pingEveryone: true, logType: "ban" });
      } catch (err) { logger.error({ err }, "AntiDC : impossible de bannir"); }
      return;
    }

    // Blacklist globale
    if (isGloballyBlacklisted(member.id)) {
      try {
        await member.ban({ reason: "[ANTIDC GLOBAL] Membre blacklisté sur un autre serveur du bot" });
        await sendLog(client, logEmbed(0x0f0f0f, "🌐 AntiDC Global — Ban automatique", [
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Raison", value: "Blacklist global — banni sur un autre serveur du bot" },
        ], { tag: client.user!.tag, id: client.user!.id }), { guildId, pingEveryone: true, logType: "ban" });
      } catch (err) { logger.error({ err }, "AntiDC global : impossible de bannir"); }
      return;
    }

    // Join lock
    if (isJoinLocked(guildId)) {
      try {
        await member.kick("Verrouillage des arrivées actif — rejoins plus tard");
        await sendLog(client, logEmbed(0xf97316, "🔒 Join Lock — Expulsion automatique", [
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Raison", value: "Verrouillage des arrivées actif" },
        ], { tag: client.user!.tag, id: client.user!.id }), { guildId });
      } catch (err) { logger.error({ err }, "Join lock kick error"); }
      return;
    }

    // Raid mode
    if (isRaidMode(guildId)) {
      try {
        await member.kick("Mode Raid actif — rejoin bloqué");
        await sendLog(client, logEmbed(0xef4444, "🚨 Raid Mode — Expulsion automatique", [
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Raison", value: "Mode Raid actif — aucun nouveau membre autorisé" },
        ], { tag: client.user!.tag, id: client.user!.id }), { guildId });
      } catch (err) { logger.error({ err }, "Raid mode kick error"); }
      return;
    }

    // Anti-Raid Niveau 2 : timeout 10 min pour tout nouveau membre
    if (isRaidMode2(guildId)) {
      await member.timeout(10 * 60 * 1000, "Anti-Raid Niveau 2 actif — quarantaine temporaire").catch(() => null);
      await sendLog(client, logEmbed(0xf59e0b, "🛡️ Anti-Raid N2 — Timeout automatique à l'arrivée", [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Durée", value: "10 minutes", inline: true },
        { name: "Raison", value: "Anti-Raid Niveau 2 actif" },
      ], { tag: client.user!.tag, id: client.user!.id }), { guildId });
    }

    // Niveau 3 : quarantaine auto pour comptes < 7 jours
    if (getConfig(guildId).securityLevel >= 3 && accountAgeDays < 7) {
      await member.timeout(60 * 60 * 1000, "Niveau 3 sécurité — compte < 7 jours").catch(() => null);
      await sendLog(client, logEmbed(0xef4444, "🔴 Niveau 3 — Quarantaine automatique (compte récent)", [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Âge du compte", value: accountAgeDays < 1 ? `${accountAgeHours}h` : `${accountAgeDays}j`, inline: true },
        { name: "Timeout", value: "1 heure — compte < 7 jours", inline: true },
      ], { tag: client.user!.tag, id: client.user!.id }), { guildId });
      await sendLogDM(client, new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("🔴 N3 — Quarantaine auto (compte récent)")
        .addFields(
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Âge", value: accountAgeDays < 1 ? `${accountAgeHours}h` : `${accountAgeDays}j`, inline: true },
          { name: "Serveur", value: member.guild.name, inline: true },
        )
        .setTimestamp()
      );
    }

    const cfg = getConfig(guildId);

    // ── Invite tracking (toujours en premier, avant tout return) ──
    await onMemberJoin(client, member).catch(() => null);

    // ── Captcha anti-bot ──
    if (cfg.captchaEnabled) {
      if (cfg.captchaUnverifiedRoleId) {
        await member.roles.add(cfg.captchaUnverifiedRoleId).catch(() => null);
      }

      const { code: captchaCode } = generateChallenge();

      // Approche canal (RaidProtect style)
      if (cfg.captchaChannelId) {
        try {
          const captchaCh = await client.channels.fetch(cfg.captchaChannelId) as TextChannel | null;
          if (captchaCh && captchaCh.isTextBased()) {
            const captchaEmbed = new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle("🛡️ Vérification anti-bot")
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setDescription(
                `Bienvenue <@${member.id}> ! Pour accéder au serveur, tape le code suivant dans ce salon :\n\n` +
                `\`\`\`\n${captchaCode}\n\`\`\`\n` +
                `> ⏱️ **5 minutes** pour répondre · **3 tentatives** maximum\n` +
                `> Le code est insensible à la casse.`
              )
              .setFooter({ text: `${member.guild.name} • Vérification requise`, iconURL: member.guild.iconURL() ?? undefined })
              .setTimestamp();

            const sent = await captchaCh.send({ content: `<@${member.id}>`, embeds: [captchaEmbed] });

            setCaptcha(member.id, {
              code: captchaCode,
              guildId,
              attempts: 3,
              challengeMessageId: sent.id,
            });

            const timeoutId = setTimeout(async () => {
              if (!hasCaptcha(member.id)) return;
              deleteCaptcha(member.id);
              captchaTimeouts.delete(member.id);
              const gMember = await member.guild.members.fetch(member.id).catch(() => null);
              if (gMember) {
                await gMember.kick("Captcha non résolu dans les 5 minutes").catch(() => null);
                // Edit challenge message to show timeout
                await sent.edit({
                  embeds: [new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("⏰ Temps écoulé")
                    .setDescription(`<@${member.id}> n'a pas résolu le captcha dans les 5 minutes et a été expulsé.`)
                    .setTimestamp()],
                }).catch(() => null);
              }
            }, 5 * 60 * 1000);

            captchaTimeouts.set(member.id, timeoutId);

            await sendLog(client, new EmbedBuilder()
              .setColor(0xf97316).setTitle("🤖 Captcha envoyé (salon)")
              .setThumbnail(member.user.displayAvatarURL())
              .addFields(
                { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                { name: "Âge du compte", value: accountAgeDays < 1 ? `⚠️ ${accountAgeHours}h` : `${accountAgeDays}j`, inline: true },
              ).setTimestamp(), { guildId });
            return;
          }
        } catch (err) {
          logger.error({ err }, "Captcha : impossible d'envoyer dans le salon");
        }
      }

      // Fallback DM si pas de salon ou erreur
      let dmSent = true;
      try {
        await member.user.send(
          `👋 Bienvenue sur **${member.guild.name}** !\n\n` +
          `🛡️ Pour accéder au serveur, tape exactement ce code en réponse à ce message :\n\n` +
          `\`\`\`\n${captchaCode}\n\`\`\`\n` +
          `⏱️ **5 minutes** · **3 tentatives** · Le code est insensible à la casse.`
        );
      } catch {
        dmSent = false;
        logger.warn({ user: member.user.tag }, "Captcha : DMs fermés — accès accordé sans captcha");
        if (cfg.captchaUnverifiedRoleId) await member.roles.remove(cfg.captchaUnverifiedRoleId).catch(() => null);
        if (cfg.captchaVerifiedRoleId) await member.roles.add(cfg.captchaVerifiedRoleId).catch(() => null);
      }

      if (dmSent) {
        setCaptcha(member.id, { code: captchaCode, guildId, attempts: 3 });

        const timeoutId = setTimeout(async () => {
          if (!hasCaptcha(member.id)) return;
          deleteCaptcha(member.id);
          captchaTimeouts.delete(member.id);
          const gMember = await member.guild.members.fetch(member.id).catch(() => null);
          if (gMember) {
            await gMember.kick("Captcha non résolu dans les 5 minutes").catch(() => null);
            try { await member.user.send(`⏰ Tu as été expulsé de **${member.guild.name}** — captcha non résolu à temps. Rejoins à nouveau pour réessayer.`); } catch { /* DMs */ }
          }
        }, 5 * 60 * 1000);
        captchaTimeouts.set(member.id, timeoutId);
        return;
      }
    }

    // ── Join log normal ──
    await sendJoinLog(client, member.user, member.guild, guildId, isSuspect, accountAgeHours, accountAgeDays, createdTs);
    await sendWelcomeMessage(client, member, guildId, cfg);

    // ── Alerte compte suspect (si suspiciousCheckEnabled ou secLvl >= 2) ──
    if (isSuspect && (isSuspiciousCheckEnabled || secLvl >= 2)) {
      const suspectReasons: string[] = [];
      if (accountAgeHours < 24) suspectReasons.push(`Compte créé il y a **${accountAgeHours}h** (< 24h)`);
      else if (accountAgeDays < suspectThresholdDays) suspectReasons.push(`Compte créé il y a **${accountAgeDays}j** (< ${suspectThresholdDays}j)`);
      if (hasNoAvatar) suspectReasons.push("Aucune photo de profil");

      await sendLogDM(client, new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("🕵️ Compte suspect détecté")
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Serveur", value: `${member.guild.name} (\`${guildId}\`)`, inline: true },
          { name: "Compte créé", value: `<t:${createdTs}:R>`, inline: true },
          { name: "Indicateurs suspects", value: suspectReasons.join("\n") || "Âge faible" },
          { name: "Niveau sécurité", value: `Niveau **${secLvl}** — seuil : ${suspectThresholdDays}j`, inline: true },
        )
        .setFooter({ text: "Aucune action automatique prise — surveille ce compte." })
        .setTimestamp()
      ).catch(() => null);
    }
  });

  // ──── GUILD MEMBER REMOVE ────
  client.on(Events.GuildMemberRemove, async (member) => {
    onMemberLeave(member);
    const guildId = member.guild.id;
    const createdTs = Math.floor(member.user.createdTimestamp / 1000);
    const joinedTs = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    const leaveEmbed = new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle("👋 Membre quitté")
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Membres restants", value: `**${member.guild.memberCount}**`, inline: true },
        { name: "Compte créé le", value: `<t:${createdTs}:F>`, inline: false },
        ...(joinedTs ? [{ name: "Était là depuis", value: `<t:${joinedTs}:R>`, inline: true }] : [])
      )
      .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
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
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: "👥 Membres restants", value: `**${member.guild.memberCount}**`, inline: true },
              ...(joinedTs ? [{ name: "📅 Était là depuis", value: `<t:${joinedTs}:R>`, inline: true }] : []),
            )
            .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
            .setTimestamp();
          await (lCh as TextChannel).send({ embeds: [lEmbed] });
        }
      } catch (err) { logger.error({ err }, "Erreur envoi message de départ"); }
    }
  });

  // ── Blacklist invitations : supprimer auto toute invitation créée par un membre restreint ──
  client.on(Events.InviteCreate, async (invite) => {
    if (!invite.guild || !invite.inviter) return;
    if (!isInviteBlacklisted(invite.guild.id, invite.inviter.id)) return;
    try {
      await invite.delete("Invite blacklist — membre restreint de créer des invitations");
      await invite.inviter.send(
        `🚫 **${invite.guild.name}** — Tu as été restreint de créer des invitations sur ce serveur par un modérateur. Ton invitation \`${invite.code}\` a été supprimée automatiquement.`
      ).catch(() => null);
      await sendLog(client, new EmbedBuilder()
        .setColor(0xf97316)
        .setTitle("🚫 Invitation supprimée — blacklist invite")
        .addFields(
          { name: "Membre", value: `${invite.inviter.tag} (\`${invite.inviter.id}\`)`, inline: true },
          { name: "Code supprimé", value: `\`${invite.code}\``, inline: true },
        )
        .setTimestamp(), { guildId: invite.guild.id });
    } catch { /* ignore */ }
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Impossible de se connecter à Discord");
  });
}

// ──── CAPTCHA HELPERS ────

async function resolveCaptchaSuccess(
  client: Client,
  userId: string,
  guildId: string,
  captchaTimeouts: Map<string, ReturnType<typeof setTimeout>>,
  challengeMessageId?: string,
  captchaChannelId?: string | null,
): Promise<void> {
  const tid = captchaTimeouts.get(userId);
  if (tid) { clearTimeout(tid); captchaTimeouts.delete(userId); }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const gMember = await guild.members.fetch(userId).catch(() => null);
  if (!gMember) return;

  const cfg = getConfig(guildId);
  if (cfg.captchaUnverifiedRoleId) await gMember.roles.remove(cfg.captchaUnverifiedRoleId).catch(() => null);
  if (cfg.captchaVerifiedRoleId) await gMember.roles.add(cfg.captchaVerifiedRoleId).catch(() => null);

  // Edit the challenge message in the captcha channel
  if (challengeMessageId && captchaChannelId) {
    try {
      const ch = await client.channels.fetch(captchaChannelId) as TextChannel | null;
      const msg = await ch?.messages.fetch(challengeMessageId).catch(() => null);
      await msg?.edit({
        content: null,
        embeds: [new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle("✅ Vérification réussie")
          .setDescription(`<@${userId}> a résolu le captcha et a accès au serveur.`)
          .setTimestamp()],
      }).catch(() => null);
      // Auto-delete success message after 10s
      setTimeout(() => { msg?.delete().catch(() => null); }, 10_000);
      // Feedback visible pour l'utilisateur
      const successMsg = await ch?.send({
        content: `<@${userId}> ✅ **Vérification réussie !** Tu as maintenant accès au serveur. Bienvenue ! 🎉`,
      }).catch(() => null);
      if (successMsg) setTimeout(() => successMsg.delete().catch(() => null), 10_000);
    } catch { /* ignore */ }
  }

  // Send join log + welcome now
  const accountAgeMs = Date.now() - gMember.user.createdTimestamp;
  const accountAgeDays = Math.floor(accountAgeMs / 86_400_000);
  const accountAgeHours = Math.floor(accountAgeMs / 3_600_000);
  const createdTs = Math.floor(gMember.user.createdTimestamp / 1000);
  const isSuspect = accountAgeHours < 24;

  await sendLog(client, new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Captcha réussi")
    .setThumbnail(gMember.user.displayAvatarURL())
    .addFields(
      { name: "Membre", value: `${gMember.user.tag} (\`${gMember.user.id}\`)`, inline: true },
      { name: "Serveur", value: guild.name, inline: true },
    )
    .setTimestamp(), { guildId });

  await sendJoinLog(client, gMember.user, guild, guildId, isSuspect, accountAgeHours, accountAgeDays, createdTs);
  await sendWelcomeMessage(client, gMember, guildId, cfg);
}

async function handleCaptchaChannelMessage(
  client: Client,
  message: Message,
  captchaTimeouts: Map<string, ReturnType<typeof setTimeout>>,
): Promise<void> {
  const challenge = getCaptcha(message.author.id)!;

  // Le captcha admin se résout exclusivement en DM — ignorer les messages en salon
  if (challenge.adminRoleId) return;

  const answer = message.content.trim();

  // Delete the member's message to keep channel clean
  await message.delete().catch(() => null);

  if (answer.toUpperCase() === challenge.code.toUpperCase()) {
    const msgId = challenge.challengeMessageId;
    const chanId = getConfig(challenge.guildId).captchaChannelId;
    const { guildId: cGuildId, isTest } = challenge;
    deleteCaptcha(message.author.id);

    if (isTest) {
      const tid = captchaTimeouts.get(message.author.id);
      if (tid) { clearTimeout(tid); captchaTimeouts.delete(message.author.id); }
      if (msgId && chanId) {
        try {
          const ch = await client.channels.fetch(chanId) as TextChannel | null;
          const msg = await ch?.messages.fetch(msgId).catch(() => null);
          await msg?.edit({ content: null, embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("🧪 [TEST] Vérification réussie").setDescription(`<@${message.author.id}> a résolu le captcha de test.\nAucune modification de rôle appliquée.`).setTimestamp()] }).catch(() => null);
          setTimeout(() => msg?.delete().catch(() => null), 10_000);
          const ok = await ch?.send({ content: `<@${message.author.id}> 🧪 **[TEST] Captcha réussi !** — Aucune action réelle effectuée.` }).catch(() => null);
          if (ok) setTimeout(() => ok.delete().catch(() => null), 10_000);
        } catch { /* ignore */ }
      }
      await sendLog(client, new EmbedBuilder().setColor(0x22c55e).setTitle("🧪 [TEST] Captcha réussi").setThumbnail(message.author.displayAvatarURL()).addFields({ name: "Membre", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true }, { name: "Mode", value: "Simulation — aucune action réelle", inline: true }).setTimestamp(), { guildId: cGuildId });
      return;
    }

    await resolveCaptchaSuccess(client, message.author.id, cGuildId, captchaTimeouts, msgId, chanId);
  } else {
    const remaining = decrementAttempts(message.author.id);
    if (remaining <= 0) {
      const msgId = challenge.challengeMessageId;
      const isTest = challenge.isTest ?? false;
      const failGuildId = challenge.guildId;
      deleteCaptcha(message.author.id);
      const tid = captchaTimeouts.get(message.author.id);
      if (tid) { clearTimeout(tid); captchaTimeouts.delete(message.author.id); }

      // Edit challenge message to show failure
      const cfg = getConfig(failGuildId);
      if (msgId && cfg.captchaChannelId) {
        try {
          const ch = await client.channels.fetch(cfg.captchaChannelId) as TextChannel | null;
          const msg = await ch?.messages.fetch(msgId).catch(() => null);
          await msg?.edit({
            content: null,
            embeds: [new EmbedBuilder()
              .setColor(0xef4444)
              .setTitle(isTest ? "🧪 [TEST] Captcha échoué" : "❌ Captcha échoué")
              .setDescription(isTest
                ? `<@${message.author.id}> a épuisé ses tentatives. (Mode test — aucune expulsion)`
                : `<@${message.author.id}> a épuisé ses tentatives et a été expulsé.`)
              .setTimestamp()],
          }).catch(() => null);
          setTimeout(() => { msg?.delete().catch(() => null); }, 10_000);
        } catch { /* ignore */ }
      }

      if (!isTest) {
        const guild = client.guilds.cache.get(failGuildId);
        const gMember = await guild?.members.fetch(message.author.id).catch(() => null);
        await gMember?.kick("Captcha échoué — trop de mauvaises réponses").catch(() => null);
      }

      await sendLog(client, new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle(isTest ? "🧪 [TEST] Captcha échoué" : "❌ Captcha échoué")
        .setThumbnail(message.author.displayAvatarURL())
        .addFields(
          { name: "Membre", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
          { name: "Raison", value: isTest ? "Trop de mauvaises tentatives (test — aucune expulsion)" : "Trop de mauvaises tentatives — expulsé", inline: true },
        )
        .setTimestamp(), { guildId: failGuildId });

      // Feedback visible pour l'utilisateur
      const cfg2 = getConfig(failGuildId);
      if (cfg2.captchaChannelId) {
        try {
          const ch2 = await client.channels.fetch(cfg2.captchaChannelId) as TextChannel | null;
          const failMsg = await ch2?.send({
            content: isTest
              ? `<@${message.author.id}> 🧪 **[TEST] Captcha échoué !** Trop de mauvaises tentatives. (Aucune action réelle effectuée)`
              : `<@${message.author.id}> ❌ **Captcha échoué !** Trop de mauvaises tentatives — tu as été expulsé du serveur.`,
          }).catch(() => null);
          if (failMsg) setTimeout(() => failMsg.delete().catch(() => null), 10_000);
        } catch { /* ignore */ }
      }
    } else {
      // Send temporary error in captcha channel
      const cfg = getConfig(challenge.guildId);
      if (cfg.captchaChannelId) {
        try {
          const ch = await client.channels.fetch(cfg.captchaChannelId) as TextChannel | null;
          if (ch?.isTextBased()) {
            const errMsg = await (ch as TextChannel).send({
              content: `<@${message.author.id}> ❌ Code incorrect — encore **${remaining}** tentative(s). Retape le code affiché dans le message de vérification.`,
            });
            setTimeout(() => errMsg.delete().catch(() => null), 8_000);
          }
        } catch { /* ignore */ }
      }
    }
  }
}

async function handleCaptchaDM(
  client: Client,
  message: Message,
  captchaTimeouts: Map<string, ReturnType<typeof setTimeout>>,
): Promise<void> {
  const challenge = getCaptcha(message.author.id)!;
  const answer = message.content.trim();

  // ── Flux captcha admin (confirmation de rôle Administrateur) ──
  if (challenge.adminRoleId) {
    const { guildId, adminRoleId } = challenge;
    const rId = adminRoleId;

    if (answer.toUpperCase() === challenge.code.toUpperCase()) {
      deleteCaptcha(message.author.id);
      const tid = captchaTimeouts.get(message.author.id);
      if (tid) { clearTimeout(tid); captchaTimeouts.delete(message.author.id); }

      // Rétablir le rôle admin
      const guild = client.guilds.cache.get(guildId);
      const gMember = await guild?.members.fetch(message.author.id).catch(() => null);
      if (rId !== "0") {
        await gMember?.roles.add(rId, "Captcha admin — identité confirmée, rôle rétabli").catch(() => null);
      }

      // DM propriétaire
      await sendLogDM(client, new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("✅ Captcha admin — Vérification réussie")
        .addFields(
          { name: "Membre", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
          { name: "Serveur", value: guild?.name ?? guildId, inline: true },
          { name: "Résultat", value: "Captcha validé — rôle Administrateur rétabli", inline: false },
        )
        .setTimestamp()
      ).catch(() => null);

      // Log serveur
      await sendLog(client, new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("✅ Captcha admin — Identité confirmée")
        .setThumbnail(message.author.displayAvatarURL())
        .addFields(
          { name: "Membre", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
          { name: "Rôle", value: rId !== "0" ? `<@&${rId}>` : "Inconnu", inline: true },
        )
        .setTimestamp(), { guildId });

      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle("✅ Identité confirmée")
          .setDescription(
            `Ton code est correct — ton rôle **Administrateur** t'a été **rétabli**.\n\n` +
            `Bienvenue dans l'équipe de modération ! 🎉`
          )
          .setTimestamp(),
        ],
      });
    } else {
      const remaining = decrementAttempts(message.author.id);
      if (remaining <= 0) {
        deleteCaptcha(message.author.id);
        const tid = captchaTimeouts.get(message.author.id);
        if (tid) { clearTimeout(tid); captchaTimeouts.delete(message.author.id); }

        const guild = client.guilds.cache.get(guildId);

        // DM propriétaire
        await sendLogDM(client, new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle("❌ Captcha admin — Vérification échouée")
          .addFields(
            { name: "Membre", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
            { name: "Serveur", value: guild?.name ?? guildId, inline: true },
            { name: "Résultat", value: "Trop de tentatives incorrectes — rôle non accordé", inline: false },
          )
          .setTimestamp()
        ).catch(() => null);

        // Log serveur
        await sendLog(client, new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle("❌ Captcha admin — Vérification échouée")
          .setThumbnail(message.author.displayAvatarURL())
          .addFields(
            { name: "Membre", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
            { name: "Rôle", value: rId !== "0" ? `<@&${rId}>` : "Inconnu", inline: true },
            { name: "Raison", value: "Trop de tentatives incorrectes — rôle non accordé", inline: false },
          )
          .setTimestamp(), { guildId });

        // Captcha échoué : le rôle admin n'est PAS rétabli
        await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle("❌ Vérification échouée")
            .setDescription(
              `Trop de tentatives incorrectes.\n\n` +
              `Ton rôle **Administrateur** n'a **pas** été accordé. ` +
              `Contacte un responsable du serveur si tu penses qu'il s'agit d'une erreur.`
            )
            .setTimestamp(),
          ],
        });
      } else {
        await message.reply(
          `❌ Code incorrect — encore **${remaining}** tentative(s).\n` +
          `Retape le code exactement comme indiqué dans le message précédent.`
        );
      }
    }
    return;
  }

  // ── Flux captcha nouveau membre (DM fallback) ──
  if (answer.toUpperCase() === challenge.code.toUpperCase()) {
    deleteCaptcha(message.author.id);
    await resolveCaptchaSuccess(client, message.author.id, challenge.guildId, captchaTimeouts);
    await message.reply("✅ **Code correct !** Tu as maintenant accès au serveur. Bienvenue ! 🎉");
  } else {
    const remaining = decrementAttempts(message.author.id);
    if (remaining <= 0) {
      deleteCaptcha(message.author.id);
      const tid = captchaTimeouts.get(message.author.id);
      if (tid) { clearTimeout(tid); captchaTimeouts.delete(message.author.id); }

      const guild = client.guilds.cache.get(challenge.guildId);
      const gMember = await guild?.members.fetch(message.author.id).catch(() => null);
      await gMember?.kick("Captcha échoué — trop de mauvaises réponses").catch(() => null);
      await message.reply("❌ Trop de mauvaises réponses. Tu as été **expulsé** du serveur. Rejoins à nouveau pour réessayer.");
    } else {
      await message.reply(
        `❌ Code incorrect ! Il te reste **${remaining}** tentative(s).\n` +
        `Retape le code exactement comme indiqué dans le message précédent.`
      );
    }
  }
}

// ──── WELCOME / JOIN LOG HELPERS ────

async function sendJoinLog(
  client: Client,
  user: User,
  guild: Guild,
  guildId: string,
  isSuspect: boolean,
  accountAgeHours: number,
  accountAgeDays: number,
  createdTs: number,
): Promise<void> {
  const joinEmbed = new EmbedBuilder()
    .setColor(isSuspect ? 0xef4444 : 0x22c55e)
    .setTitle(isSuspect ? "⚠️ Nouveau membre — Compte suspect" : "✅ Nouveau membre")
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Compte créé le", value: `<t:${createdTs}:F>`, inline: true },
      { name: "Âge du compte", value: accountAgeDays < 1 ? `⚠️ ${accountAgeHours} heure(s)` : `${accountAgeDays} jour(s)`, inline: true },
      { name: "Membres", value: `**${guild.memberCount}**`, inline: true },
    )
    .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();

  if (isSuspect) joinEmbed.setDescription("⚠️ Ce compte a moins de **24 heures** — possible compte alternatif ou suspect.");

  await sendLog(client, joinEmbed, { guildId, pingEveryone: isSuspect });
}

async function sendWelcomeMessage(
  client: Client,
  member: { user: User; guild: Guild; id: string },
  guildId: string,
  cfg: ReturnType<typeof getConfig>,
): Promise<void> {
  if (!cfg.welcomeEnabled || !cfg.welcomeChannelId) return;
  try {
    const wCh = await client.channels.fetch(cfg.welcomeChannelId);
    if (!wCh || !wCh.isTextBased()) return;

    const text = cfg.welcomeMessage
      .replace(/\{user\}/g, `<@${member.id}>`)
      .replace(/\{username\}/g, member.user.username)
      .replace(/\{server\}/g, member.guild.name)
      .replace(/\{count\}/g, String(member.guild.memberCount));

    const joinedTs = Math.floor(member.user.createdTimestamp / 1000);
    const wEmbed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setDescription(text)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "📅 Compte créé", value: `<t:${joinedTs}:R>`, inline: true },
        { name: "👥 Membre n°", value: `**${member.guild.memberCount}**`, inline: true },
      )
      .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
      .setTimestamp();

    await (wCh as TextChannel).send({ embeds: [wEmbed] });
  } catch (err) { logger.error({ err }, "Erreur envoi message d'arrivée"); }
}

// ──── ADMIN ALERT DM BUTTONS ────

async function handleAdminAlertButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  // admin_ok:guildId:memberId
  if (customId.startsWith("admin_ok:")) {
    const parts = customId.split(":");
    const gId = parts[1] ?? "?";
    const mId = parts[2] ?? "?";
    await interaction.update({
      content: "✅ **Compris** — tu as confirmé avoir reçu ce rôle intentionnellement. Aucune alerte envoyée.",
      embeds: [],
      components: [],
    });
    await sendLogDM(client, new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Alerte admin — Rôle confirmé intentionnel")
      .addFields(
        { name: "Membre", value: `<@${mId}> (\`${mId}\`)`, inline: true },
        { name: "Serveur", value: `\`${gId}\``, inline: true },
        { name: "Action", value: "A confirmé que le rôle admin était intentionnel", inline: false },
      )
      .setTimestamp()
    ).catch(() => null);
    return;
  }

  // admin_deny:guildId:memberId
  if (customId.startsWith("admin_deny:")) {
    const parts = customId.split(":");
    const guildId = parts[1];
    const memberId = parts[2];
    let guildName = guildId;
    try {
      const g = await client.guilds.fetch(guildId);
      guildName = g.name;
    } catch { /* ignore */ }

    await interaction.update({
      content: "🚨 **Alerte envoyée au staff** — les administrateurs ont été prévenus. Contacte-les si nécessaire.",
      embeds: [],
      components: [],
    });

    // Alerte owner bot
    const alertEmbed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("🚨 Alerte sécurité — Attribution admin NON ATTENDUE")
      .setDescription(`Le membre a signalé ne pas avoir demandé ce rôle Admin.`)
      .addFields(
        { name: "Serveur", value: `${guildName} (\`${guildId}\`)`, inline: true },
        { name: "Membre signalant", value: `<@${interaction.user.id}> (\`${memberId}\`)`, inline: true },
      )
      .setTimestamp();
    await sendLogDM(client, alertEmbed).catch(() => null);
    return;
  }

  // admin_captcha:guildId:memberId:a:b
  if (customId.startsWith("admin_captcha:")) {
    const parts = customId.split(":");
    const a = parts[3];
    const b = parts[4];
    const sum = Number(a) + Number(b);

    const modal = new ModalBuilder()
      .setCustomId(`admin_captcha_verify:${parts[1]}:${parts[2]}:${sum}`)
      .setTitle("🔐 Vérification de sécurité")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("captcha_answer")
            .setLabel(`Combien font ${a} + ${b} ?`)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(5)
            .setRequired(true)
            .setPlaceholder("Tape le résultat ici"),
        ),
      );

    await interaction.showModal(modal);
    return;
  }
}

// ──── LEVEL 3 ACTIVATION EFFECTS ────

async function activateLevel3Effects(client: Client, guildId: string): Promise<void> {
  const targetGuild = client.guilds.cache.get(guildId);
  if (!targetGuild) return;

  // a) Suppression de tous les webhooks
  const webhooks = await targetGuild.fetchWebhooks().catch(() => null);
  if (webhooks) await Promise.all([...webhooks.values()].map(wh => wh.delete("Niveau 3 sécurité — suppression webhooks").catch(() => null)));

  // b) Révocation des invitations (sauf whitelist)
  const l3Invites = await targetGuild.invites.fetch().catch(() => null);
  if (l3Invites) {
    const l3Whitelist = getConfig(guildId).whitelistedInviteCodes;
    await Promise.all(l3Invites.filter(inv => !l3Whitelist.includes(inv.code)).map(inv => inv.delete("Niveau 3 — révocation invitations").catch(() => null)));
  }

  // c) Gel des salons vocaux : retirer Connect à @everyone
  const everyoneRole = targetGuild.roles.everyone;
  const voiceChannels = targetGuild.channels.cache.filter(ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice);
  for (const [, ch] of voiceChannels) {
    await (ch as VoiceChannel).permissionOverwrites.edit(everyoneRole, { Connect: false }, { reason: "Niveau 3 — gel vocal" }).catch(() => null);
  }

  // d) Vérification → TRÈS HAUTE (téléphone requis)
  await targetGuild.setVerificationLevel(GuildVerificationLevel.VeryHigh, "Niveau 3 sécurité activé").catch(() => null);
}

// ──── OWNER ADMIN ALERT BUTTONS ────

async function handleOwnerAdminAlert(client: Client, interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  if (customId.startsWith("oa_ok:")) {
    const parts = customId.split(":");
    const gId = parts[1] ?? "?";
    const mId = parts[2] ?? "?";
    await interaction.update({
      content: `✅ **Confirmé** — attribution admin pour \`${mId}\` sur le serveur \`${gId}\` marquée comme intentionnelle.`,
      embeds: [], components: [],
    });
    return;
  }

  if (customId.startsWith("oa_deny:")) {
    const parts = customId.split(":");
    const gId = parts[1] ?? "";
    const mId = parts[2] ?? "";
    const rId = parts[3] ?? "";
    const targetGuild = client.guilds.cache.get(gId);
    if (!targetGuild) {
      await interaction.update({ content: "❌ Serveur introuvable.", embeds: [], components: [] }); return;
    }
    const member = await targetGuild.members.fetch(mId).catch(() => null);
    const role = rId !== "0" ? targetGuild.roles.cache.get(rId) : null;
    let result = "";
    if (member && role) {
      await member.roles.remove(role, "Refusé par le propriétaire du bot").catch(() => null);
      await member.user.send(
        `⚠️ Le propriétaire du bot a retiré le rôle **${role.name}** (Administrateur) qui t'avait été attribué sur **${targetGuild.name}**. Cette action a été jugée non autorisée.`
      ).catch(() => null);
      result = `✅ Rôle \`${role.name}\` retiré de **${member.user.tag}**.`;
    } else if (member) {
      result = `⚠️ Membre trouvé mais rôle introuvable (\`${rId}\`).`;
    } else {
      result = `⚠️ Membre \`${mId}\` introuvable.`;
    }
    await interaction.update({ content: `❌ **Refusé.** ${result}`, embeds: [], components: [] });
    return;
  }

  if (customId.startsWith("oa_deny_role:")) {
    const parts = customId.split(":");
    const gId = parts[1] ?? "";
    const rId = parts[2] ?? "";
    const targetGuild = client.guilds.cache.get(gId);
    if (!targetGuild) {
      await interaction.update({ content: "❌ Serveur introuvable.", embeds: [], components: [] }); return;
    }
    const role = targetGuild.roles.cache.get(rId);
    if (role) {
      await role.delete("Supprimé par le propriétaire du bot — rôle admin non autorisé").catch(() => null);
      await interaction.update({ content: `✅ Rôle \`${role.name}\` **supprimé** du serveur **${targetGuild.name}**.`, embeds: [], components: [] });
    } else {
      await interaction.update({ content: `⚠️ Rôle \`${rId}\` introuvable (déjà supprimé ?).`, embeds: [], components: [] });
    }
    return;
  }

  if (customId.startsWith("oa_captcha:")) {
    const parts = customId.split(":");
    const gId = parts[1] ?? "";
    const mId = parts[2] ?? "";
    const rId = parts[3] ?? "0";
    const targetGuild = client.guilds.cache.get(gId);
    const member = targetGuild ? await targetGuild.members.fetch(mId).catch(() => null) : null;
    if (!member) {
      await interaction.update({ content: "❌ Membre introuvable.", embeds: [], components: [] }); return;
    }

    // Annuler tout captcha/timer existant pour ce membre
    const existingTid = captchaTimeouts.get(mId);
    if (existingTid) { clearTimeout(existingTid); captchaTimeouts.delete(mId); }
    if (hasCaptcha(mId)) deleteCaptcha(mId);

    // Retirer le rôle admin temporairement pendant la vérification
    if (rId !== "0") {
      await member.roles.remove(rId, "Captcha admin — retrait temporaire en attente de vérification").catch(() => null);
    }

    const { code } = generateChallenge();
    setCaptcha(mId, { code, guildId: gId, attempts: 3, adminRoleId: rId });

    const captchaEmbed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🔑 Confirmation de rôle Administrateur requise")
      .setThumbnail(targetGuild?.iconURL() ?? null)
      .setDescription(
        `Le propriétaire de **${targetGuild?.name ?? gId}** doit confirmer l'attribution de ton rôle **Administrateur**.\n\n` +
        `**Ton rôle a été retiré temporairement** le temps de cette vérification.\n\n` +
        `Réponds à ce message avec le code ci-dessous pour le récupérer immédiatement :\n\`\`\`\n${code}\n\`\`\`\n` +
        `> ⏱️ **5 minutes** pour répondre (rétablissement automatique si délai dépassé)\n` +
        `> 🔢 **3 tentatives** maximum · code insensible à la casse`
      )
      .setFooter({ text: `${targetGuild?.name ?? gId} • Confirmation de rôle admin` })
      .setTimestamp();

    const dmResult = await member.user.send({ embeds: [captchaEmbed] }).catch(() => null);

    if (!dmResult) {
      // DMs fermés — restaurer le rôle immédiatement sans vérification
      deleteCaptcha(mId);
      if (rId !== "0") {
        await member.roles.add(rId, "Captcha admin — DMs fermés, rôle rétabli sans vérification").catch(() => null);
      }
      await interaction.update({
        content: `⚠️ **Impossible d'envoyer le DM** à **${member.user.tag}** (DMs désactivés).\nLe rôle Administrateur a été **rétabli** sans vérification.`,
        embeds: [], components: [],
      });
      return;
    }

    // Log serveur — captcha déclenché
    await sendLog(client, new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🔑 Captcha admin — Vérification déclenchée")
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${mId}\`)`, inline: true },
        { name: "Rôle", value: rId !== "0" ? `<@&${rId}>` : "Inconnu", inline: true },
        { name: "Délai", value: "5 min · auto-rétablissement si pas de réponse", inline: false },
      )
      .setTimestamp(), { guildId: gId });

    // Auto-approbation après 5 minutes si aucune réponse du membre
    const autoApproveTimer = setTimeout(async () => {
      if (!hasCaptcha(mId)) return;
      deleteCaptcha(mId);
      const g = client.guilds.cache.get(gId);
      const m = await g?.members.fetch(mId).catch(() => null);
      if (rId !== "0") {
        await m?.roles.add(rId, "Captcha admin — rôle rétabli automatiquement après délai de 5 min").catch(() => null);
      }
      // DM membre
      await m?.user.send({
        embeds: [new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle("⏱️ Délai de vérification écoulé")
          .setDescription(
            `Aucune réponse reçue dans les **5 minutes** imparties.\n\n` +
            `Ton rôle **Administrateur** a été **rétabli automatiquement** sur **${g?.name ?? gId}**.`
          )
          .setFooter({ text: `${g?.name ?? gId} • Vérification sécurité` })
          .setTimestamp(),
        ],
      }).catch(() => null);
      // DM propriétaire
      await sendLogDM(client, new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("⏱️ Captcha admin — Auto-rétabli (délai expiré)")
        .addFields(
          { name: "Membre", value: `${m?.user.tag ?? mId} (\`${mId}\`)`, inline: true },
          { name: "Serveur", value: g?.name ?? gId, inline: true },
          { name: "Résultat", value: "Aucune réponse dans les 5 min — rôle rétabli automatiquement", inline: false },
        )
        .setTimestamp()
      ).catch(() => null);
      // Log serveur
      await sendLog(client, new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("⏱️ Captcha admin — Auto-rétablissement (timeout)")
        .setThumbnail(m?.user.displayAvatarURL() ?? "")
        .addFields(
          { name: "Membre", value: `${m?.user.tag ?? mId} (\`${mId}\`)`, inline: true },
          { name: "Rôle", value: rId !== "0" ? `<@&${rId}>` : "Inconnu", inline: true },
          { name: "Raison", value: "5 min écoulées sans réponse", inline: false },
        )
        .setTimestamp(), { guildId: gId });
    }, 5 * 60_000);
    captchaTimeouts.set(mId, autoApproveTimer);

    await interaction.update({
      content: `🔑 Captcha de confirmation envoyé à **${member.user.tag}** — rôle admin retiré temporairement.\nDélai : **5 minutes** · Auto-rétablissement si aucune réponse.`,
      embeds: [], components: [],
    });
    return;
  }
}

// ──── BUTTON INTERACTION ────

async function handleButtonInteraction(client: Client, interaction: ButtonInteraction): Promise<void> {
  const { customId, guild } = interaction;

  // Boutons DM admin (hors serveur)
  if (customId.startsWith("admin_ok:") || customId.startsWith("admin_deny:") || customId.startsWith("admin_captcha:")) {
    await handleAdminAlertButton(client, interaction);
    return;
  }

  // Boutons hoistrole (DM owner)
  if (customId.startsWith("hoist_confirm:") || customId.startsWith("hoist_deny:")) {
    const hoistGuildId = customId.split(":")[1] ?? "";
    const hoistGuild = client.guilds.cache.get(hoistGuildId);

    if (customId.startsWith("hoist_deny:")) {
      await interaction.update({ content: `❌ Demande **refusée** pour **${hoistGuild?.name ?? hoistGuildId}**.`, embeds: [], components: [] });
      return;
    }

    if (!hoistGuild) {
      await interaction.update({ content: "❌ Serveur introuvable.", embeds: [], components: [] });
      return;
    }

    const botMember = hoistGuild.members.me;
    if (!botMember) {
      await interaction.update({ content: "❌ Le bot n'est pas dans ce serveur.", embeds: [], components: [] });
      return;
    }

    const botRole = botMember.roles.highest;
    if (!botRole || botRole.id === hoistGuild.roles.everyone.id) {
      await interaction.update({ content: "❌ Aucun rôle gérable trouvé pour le bot.", embeds: [], components: [] });
      return;
    }

    // Tentative via l'API batch setPositions
    const allRoles = [...hoistGuild.roles.cache.values()]
      .filter(r => r.id !== hoistGuild.roles.everyone.id)
      .sort((a, b) => a.position - b.position);
    const targetPosition = allRoles.length; // juste en dessous du rôle @owner
    let success = false;

    try {
      await hoistGuild.roles.setPositions([{ role: botRole.id, position: targetPosition }]);
      success = true;
    } catch { /* Discord limite la position selon la hiérarchie */ }

    if (success) {
      await interaction.update({
        content: `✅ Le rôle **${botRole.name}** a été hissé au-dessus de tous les rôles sur **${hoistGuild.name}**.`,
        embeds: [],
        components: [],
      });
      const cfg = getConfig(hoistGuildId);
      if (cfg.logChannelId) {
        const lCh = hoistGuild.channels.cache.get(cfg.logChannelId) as TextChannel | null;
        await lCh?.send({
          embeds: [new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle("⬆️ Bot hissé au-dessus de tous les rôles")
            .addFields({ name: "Rôle", value: `**${botRole.name}** (\`${botRole.id}\`)`, inline: true })
            .setFooter({ text: "Confirmé par le propriétaire du bot" })
            .setTimestamp()],
        }).catch(() => null);
      }
    } else {
      // Limitation Discord : le bot ne peut pas se hisser lui-même via l'API
      const rolesAbove = allRoles.filter(r => r.position > botRole.position).length;
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle("⚠️ Action manuelle requise — Limitation Discord")
          .setDescription(
            `Discord ne permet pas au bot de déplacer son propre rôle via l'API si d'autres rôles sont au-dessus de lui.\n\n` +
            `**Le propriétaire du serveur doit le faire manuellement :**\n` +
            `1. Ouvre **Paramètres du serveur → Rôles**\n` +
            `2. Repère le rôle **${botRole.name}**\n` +
            `3. Glisse-le **tout en haut** de la liste\n` +
            `4. Clique sur **Enregistrer les modifications**`
          )
          .addFields(
            { name: "Rôle actuel du bot", value: `**${botRole.name}** (position \`${botRole.position}\`)`, inline: true },
            { name: "Rôles au-dessus", value: `**${rolesAbove}** rôle(s) à passer`, inline: true },
          )
          .setFooter({ text: hoistGuild.name })
          .setTimestamp()],
        content: "",
        components: [],
      });
    }
    return;
  }

  // Boutons approbation niveau 3 (DM owner)
  if (customId.startsWith("sec_approve:") || customId.startsWith("sec_deny:")) {
    const guildId = customId.split(":")[1] ?? "";
    const pending = getPendingLevel3(guildId);

    if (!pending) {
      await interaction.update({ content: "❌ Cette demande est expirée ou déjà traitée.", embeds: [], components: [] });
      return;
    }

    if (customId.startsWith("sec_approve:")) {
      // Étape 1 owner → marquer approuvé, envoyer validation admin dans le serveur
      markOwnerApproved(guildId);
      await interaction.update({
        content: `✅ **Approuvé.** En attente de la validation d'un admin dans le salon logs de **${pending.guildName}**.`,
        embeds: [],
        components: [],
      });

      const pendingGuild = client.guilds.cache.get(guildId);
      if (pendingGuild) {
        const cfg = getConfig(guildId);
        if (cfg.logChannelId) {
          const logCh = pendingGuild.channels.cache.get(cfg.logChannelId) as TextChannel | null;
          const adminRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`sec_admin_confirm:${guildId}`)
              .setLabel("✅ Confirmer — activer niveau 3")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`sec_admin_deny:${guildId}`)
              .setLabel("❌ Refuser")
              .setStyle(ButtonStyle.Secondary),
          );
          await logCh?.send({
            content: "@here",
            embeds: [new EmbedBuilder()
              .setColor(0xef4444)
              .setTitle("🔴 Niveau 3 — Validation admin requise")
              .setDescription(
                `Le propriétaire du bot a approuvé l'activation du **niveau de sécurité maximum**.\n\n` +
                `Un administrateur du serveur doit confirmer pour finaliser.\nDemandé par <@${pending.requesterId}>.`
              )
              .addFields({ name: "Effets si activé", value: "• Anti-insulte timeout 24h\n• Anti-webhook auto\n• Comptes < 7 jours suspects\n• Alerte DM owner pour tout compte suspect" })
              .setTimestamp()],
            components: [adminRow],
          }).catch(() => null);
        }
      }

    } else {
      removePendingLevel3(guildId);
      await interaction.update({ content: `❌ Niveau 3 **refusé** pour **${pending.guildName}**.`, embeds: [], components: [] });

      const requester = await client.users.fetch(pending.requesterId).catch(() => null);
      await requester?.send(`❌ Ta demande d'activation du niveau de sécurité 3 sur **${pending.guildName}** a été **refusée** par le propriétaire du bot.`).catch(() => null);
    }
    return;
  }

  // ── Boutons alerte rôle admin (DM owner) — avant le !guild check ──
  if (customId.startsWith("oa_ok:") || customId.startsWith("oa_deny:") || customId.startsWith("oa_deny_role:") || customId.startsWith("oa_captcha:")) {
    await handleOwnerAdminAlert(client, interaction);
    return;
  }

  // ── Boutons approbation anti-raid niveau 2 (DM owner) ──
  if (customId.startsWith("raid2_approve:") || customId.startsWith("raid2_deny:")) {
    const r2GuildId = customId.split(":")[1] ?? "";
    const raid2 = getPendingRaid2(r2GuildId);
    if (!raid2) {
      await interaction.update({ content: "❌ Cette demande est expirée ou déjà traitée.", embeds: [], components: [] });
      return;
    }
    if (customId.startsWith("raid2_approve:")) {
      setRaidMode2(r2GuildId, true);
      removePendingRaid2(r2GuildId);
      await interaction.update({ content: `✅ Anti-Raid Niveau 2 **approuvé** pour **${raid2.guildName}**.`, embeds: [], components: [] });
      const tGuild = client.guilds.cache.get(r2GuildId);
      if (tGuild) {
        // Révocation des invitations (sauf whitelist)
        const n2Invites = await tGuild.invites.fetch().catch(() => null);
        if (n2Invites) {
          const n2Whitelist = getConfig(r2GuildId).whitelistedInviteCodes;
          await Promise.all(n2Invites.filter(inv => !n2Whitelist.includes(inv.code)).map(inv => inv.delete("Anti-Raid N2 activé").catch(() => null)));
        }
        // Suppression de tous les webhooks
        const n2Webhooks = await tGuild.fetchWebhooks().catch(() => null);
        if (n2Webhooks) await Promise.all([...n2Webhooks.values()].map(wh => wh.delete("Anti-Raid N2 activé").catch(() => null)));
        // Vérification → Haute (téléphone requis)
        await tGuild.setVerificationLevel(GuildVerificationLevel.High, "Anti-Raid N2 activé").catch(() => null);

        const cfg = getConfig(r2GuildId);
        if (cfg.logChannelId) {
          const lCh = tGuild.channels.cache.get(cfg.logChannelId) as TextChannel | null;
          await lCh?.send({
            embeds: [new EmbedBuilder()
              .setColor(0xef4444)
              .setTitle("🛡️ Anti-Raid Niveau 2 ACTIVÉ")
              .setDescription(`Approuvé par le propriétaire du bot.\nDemandé par <@${raid2.requesterId}>.`)
              .addFields({ name: "⚠️ Effets actifs", value: "• Tout nouveau **salon** ou **rôle** créé sera supprimé auto\n• Tout membre qui rejoint reçoit un **timeout 10 min**\n• Toutes les **invitations** ont été révoquées\n• Tous les **webhooks** ont été supprimés\n• Vérification Discord → **Haute** (téléphone requis)\n• Anti-spam renforcé : 3 msg en 3s = expulsion" })
              .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
              .setTimestamp()],
          }).catch(() => null);
        }
        // Demande approbation owner avant DM aux admins
        void requestAdminDMApproval(client, tGuild, new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle("🛡️ Anti-Raid Niveau 2 ACTIVÉ")
          .setDescription(`L'**Anti-Raid Niveau 2** est actif sur **${tGuild.name}**.`)
          .addFields(
            { name: "Demandé par", value: `<@${raid2.requesterId}>`, inline: true },
            { name: "⚠️ Effets actifs", value: "• Tout nouveau salon/rôle créé sera supprimé\n• Nouveaux membres : timeout 10 min\n• Invitations non-protégées révoquées\n• Webhooks supprimés\n• Vérification → Haute" },
          )
          .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
          .setTimestamp(),
          "Anti-Raid Niveau 2 ACTIVÉ"
        );
      }
    } else {
      removePendingRaid2(r2GuildId);
      await interaction.update({ content: `❌ Anti-Raid Niveau 2 **refusé** pour **${raid2.guildName}**.`, embeds: [], components: [] });
      const reqUser = await client.users.fetch(raid2.requesterId).catch(() => null);
      await reqUser?.send(`❌ Ta demande d'**Anti-Raid Niveau 2** sur **${raid2.guildName}** a été refusée.`).catch(() => null);
    }
    return;
  }

  if (!guild) return;

  // ── Validation admin en serveur pour sec niveau 3 ──
  if (customId.startsWith("sec_admin_confirm:") || customId.startsWith("sec_admin_deny:")) {
    const sacGuildId = customId.split(":")[1] ?? "";
    const sacPending = getPendingLevel3(sacGuildId);
    if (!sacPending || !sacPending.ownerApproved) {
      await interaction.reply({ content: "❌ Cette demande est expirée ou n'a pas encore été approuvée par le propriétaire.", ephemeral: true });
      return;
    }
    const sacMember = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!sacMember?.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "❌ Seuls les administrateurs du serveur peuvent confirmer cette action.", ephemeral: true });
      return;
    }
    if (customId.startsWith("sec_admin_confirm:")) {
      setSecurityLevel(sacGuildId, 3);
      removePendingLevel3(sacGuildId);
      await interaction.update({ content: `✅ Niveau 3 **activé** et confirmé par ${interaction.user.tag}.`, embeds: [], components: [] });
      await activateLevel3Effects(client, sacGuildId);
      const sacLogCh = interaction.channel as TextChannel | null;
      await sacLogCh?.send({
        embeds: [new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle("🔴 Niveau de sécurité 3 — Maximum ACTIVÉ")
          .setDescription(`Approuvé par le propriétaire du bot + confirmé par <@${interaction.user.id}>.\nDemandé par <@${sacPending.requesterId}>.`)
          .addFields({ name: "Effets actifs", value: "• Anti-insulte timeout 24h\n• Anti-webhook auto\n• Comptes < 7 jours suspects\n• Alerte DM owner pour tout compte suspect" })
          .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
          .setTimestamp()],
      }).catch(() => null);
      // Demande approbation owner avant DM aux admins
      if (guild) void requestAdminDMApproval(client, guild, new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("🔴 Niveau de sécurité 3 — Maximum ACTIVÉ")
        .setDescription(`Le niveau de sécurité maximum est actif sur **${sacPending.guildName}**.`)
        .addFields(
          { name: "Demandé par", value: `<@${sacPending.requesterId}>`, inline: true },
          { name: "Confirmé par", value: `${interaction.user.tag}`, inline: true },
          { name: "⚠️ Effets actifs", value: "• Anti-insulte timeout 24h\n• Webhooks supprimés\n• Comptes < 7 jours suspects\n• Vocal gelé\n• Vérification → Très Haute" },
        )
        .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
        .setTimestamp(),
        "Niveau de sécurité 3 — Maximum ACTIVÉ"
      );
    } else {
      removePendingLevel3(sacGuildId);
      await interaction.update({ content: `❌ Niveau 3 **refusé** par ${interaction.user.tag}.`, embeds: [], components: [] });
      const sacReq = await client.users.fetch(sacPending.requesterId).catch(() => null);
      await sacReq?.send(`❌ Ta demande de niveau 3 sur **${sacPending.guildName}** a été refusée par un administrateur du serveur.`).catch(() => null);
    }
    return;
  }

  // ── Validation owner — envoi DM aux admins ──
  if (customId.startsWith("admin_dm_approve:") || customId.startsWith("admin_dm_deny:")) {
    const pendingId = customId.split(":").slice(1).join(":");
    const pending = getAdminDMPending(pendingId);
    if (!pending) {
      await interaction.update({ content: "❌ Cette demande est expirée ou déjà traitée.", embeds: [], components: [] });
      return;
    }
    removeAdminDMPending(pendingId);
    if (customId.startsWith("admin_dm_approve:")) {
      await interaction.update({ content: "✅ DM aux admins en cours d'envoi…", embeds: [], components: [] });
      const targetGuild = client.guilds.cache.get(pending.guildId);
      if (targetGuild) {
        await sendAdminsDM(targetGuild, pending.embed);
        await interaction.editReply({ content: "✅ DM envoyé à tous les administrateurs du serveur." }).catch(() => null);
      } else {
        await interaction.editReply({ content: "❌ Serveur introuvable (bot peut-être retiré du serveur)." }).catch(() => null);
      }
    } else {
      await interaction.update({ content: "❌ Envoi DM aux admins **annulé**.", embeds: [], components: [] });
    }
    return;
  }

  if (customId.startsWith("dash_")) {
    await handleDashboardButton(client, interaction);
    return;
  }

  if (customId === "ticket_create") { await handleTicketCreate(client, interaction); return; }
  if (customId === "ticket_close") { await handleTicketClose(interaction); return; }

  if (customId.startsWith("support_ticket_")) {
    const targetUserId = customId.slice("support_ticket_".length);
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    const config = getConfig(guild.id);
    const isStaff = config.ticketStaffRoleId
      ? member?.roles.cache.has(config.ticketStaffRoleId) ?? false
      : member?.permissions.has(PermissionFlagsBits.ManageMessages) ?? false;
    if (!isStaff) { await interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true }); return; }
    const existingChannelId = getTicketChannelByUser(guild.id, targetUserId);
    if (existingChannelId) { await interaction.reply({ content: `❌ Cet utilisateur a déjà un ticket ouvert : <#${existingChannelId}>`, ephemeral: true }); return; }
    let targetUser: User;
    try { targetUser = await client.users.fetch(targetUserId); }
    catch { await interaction.reply({ content: "❌ Impossible de trouver cet utilisateur.", ephemeral: true }); return; }
    await interaction.deferReply({ ephemeral: true });
    const ticketCh = await createTicketForUser(client, guild, targetUser);
    if (!ticketCh) { await interaction.editReply({ content: "❌ Impossible de créer le salon ticket." }); return; }
    await interaction.editReply({ content: `✅ Ticket créé pour <@${targetUserId}> : <#${ticketCh.id}>` });
    await interaction.message.edit({ components: [] }).catch(() => null);
    try { await targetUser.send(`📬 Le staff a ouvert un ticket pour ta demande de support sur **${guild.name}**. Rendez-vous dans <#${ticketCh.id}> !`); } catch { /* DMs */ }
    return;
  }

  if (customId.startsWith("support_dm_")) {
    const targetUserId = customId.slice("support_dm_".length);
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    const config = getConfig(guild.id);
    const isStaff = config.ticketStaffRoleId
      ? member?.roles.cache.has(config.ticketStaffRoleId) ?? false
      : member?.permissions.has(PermissionFlagsBits.ManageMessages) ?? false;
    if (!isStaff) { await interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true }); return; }
    let targetUser: User;
    try { targetUser = await client.users.fetch(targetUserId); }
    catch { await interaction.reply({ content: "❌ Impossible de trouver cet utilisateur.", ephemeral: true }); return; }
    try {
      await targetUser.send(`📬 Bonjour ! Ta demande de support sur **${guild.name}** a bien été vue par le staff. Tu auras une réponse très bientôt ! 😊`);
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
      ], { tag: interaction.user.tag, id: interaction.user.id }), { guildId: guild.id, logType: "ban" });
    } catch (err) {
      logger.error({ err }, "Impossible de débannir");
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
    ], { tag: interaction.user.tag, id: interaction.user.id }), { guildId: guild.id, logType: "ban" });
  }
}

// ──── TICKET HELPERS ────

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

  openTicket({ channelId: ticketChannel.id, ticketNumber, userId: user.id, username: user.tag, guildId: guild.id, createdAt: new Date(), claimedBy: null, claimedById: null });

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x6366f1).setTitle("🎫 Nouveau ticket")
    .setDescription(
      `Bonjour <@${user.id}> ! Le staff sera avec toi dans quelques instants.\n\n` +
      "**Décris ton problème ou ta demande ci-dessous.**\n" +
      "Pour fermer ce ticket, clique sur le bouton ci-dessous ou utilise `/ticket fermer`."
    )
    .addFields(
      { name: "Créateur", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Ouvert le", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      ...(config.ticketStaffRoleId ? [{ name: "Staff notifié", value: `<@&${config.ticketStaffRoleId}>`, inline: true }] : [])
    ).setTimestamp();

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒  Fermer le ticket").setStyle(ButtonStyle.Danger)
  );

  const staffPing = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : "";
  await ticketChannel.send({ content: `<@${user.id}>${staffPing ? ` ${staffPing}` : ""}`, embeds: [welcomeEmbed], components: [closeRow] });

  await sendLog(client, new EmbedBuilder().setColor(0x6366f1).setTitle("🎫 Ticket ouvert")
    .addFields({ name: "Créateur", value: `${user.tag} (\`${user.id}\`)`, inline: true }, { name: "Salon", value: `<#${ticketChannel.id}>`, inline: true }).setTimestamp(),
    { guildId: guild.id });

  return ticketChannel;
}

async function handleTicketCreate(client: Client, interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild!;
  const user = interaction.user;
  const existingChannelId = getTicketChannelByUser(guild.id, user.id);
  if (existingChannelId) { await interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : <#${existingChannelId}>`, ephemeral: true }); return; }
  await interaction.deferReply({ ephemeral: true });
  const ticketChannel = await createTicketForUser(client, guild, user);
  if (!ticketChannel) { await interaction.editReply({ content: "❌ Impossible de créer le salon ticket. Vérifie les permissions du bot." }); return; }
  await interaction.editReply({ content: `✅ Ton ticket a été créé : <#${ticketChannel.id}>` });
}

async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild!;
  const user = interaction.user;
  const config = getConfig(guild.id);
  if (!isTicketChannel(channel.id)) { await interaction.reply({ content: "❌ Ce n'est pas un salon ticket.", ephemeral: true }); return; }
  const ticket = getTicketByChannel(channel.id);
  const member = await guild.members.fetch(user.id).catch(() => null);
  const isStaff = config.ticketStaffRoleId ? member?.roles.cache.has(config.ticketStaffRoleId) ?? false : member?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
  const isOwner = ticket?.userId === user.id;
  if (!isStaff && !isOwner) { await interaction.reply({ content: "❌ Seul le staff ou le créateur du ticket peut le fermer.", ephemeral: true }); return; }
  await interaction.reply({ content: "🔒 Fermeture du ticket...", ephemeral: true });
  const embed = new EmbedBuilder().setColor(0xef4444).setTitle("🔒 Ticket fermé")
    .addFields({ name: "Fermé par", value: user.tag, inline: true }, ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []))
    .setFooter({ text: "Ce salon sera supprimé dans 5 secondes." }).setTimestamp();
  await channel.send({ embeds: [embed] });
  await interaction.message.edit({ components: [] }).catch(() => null);
  closeTicket(channel.id);
  await sendLog(interaction.client, logEmbed(0xef4444, "🔒 Ticket fermé (bouton)", [
    { name: "Salon", value: channel.name, inline: true }, { name: "Fermé par", value: user.tag, inline: true },
    ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
    ...(ticket ? [{ name: "Créateur", value: `<@${ticket.userId}>`, inline: true }] : []),
    ...(ticket?.claimedBy ? [{ name: "Pris en charge par", value: ticket.claimedBy, inline: true }] : []),
  ], { tag: user.tag, id: user.id }), { guildId: guild.id });
  setTimeout(async () => { await channel.delete("Ticket fermé").catch(() => null); }, 5000);
}

// ──── DASHBOARD BUTTON ────

async function handleDashboardButton(_client: Client, interaction: ButtonInteraction): Promise<void> {
  const { customId, guild } = interaction;
  if (!guild) return;

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "❌ Seuls les administrateurs peuvent utiliser le dashboard.", ephemeral: true });
    return;
  }

  const guildId = guild.id;

  async function updateDashboard() {
    const newCfg = getConfig(guildId);
    await interaction.update({ embeds: [buildDashboardEmbed(newCfg, guild!)], components: buildDashboardRows(newCfg) });
  }

  async function showModal(id: string, title: string, label: string, placeholder: string, value?: string, paragraph = false) {
    const input = new TextInputBuilder()
      .setCustomId("value")
      .setLabel(label)
      .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder(placeholder)
      .setMaxLength(paragraph ? 500 : 100);
    if (value !== undefined) input.setValue(value);

    const modal = new ModalBuilder()
      .setCustomId(id)
      .setTitle(title)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

    await interaction.showModal(modal);
  }

  switch (customId) {
    case "dash_welcome_toggle":
      setWelcomeEnabled(guildId, !getConfig(guildId).welcomeEnabled);
      return updateDashboard();

    case "dash_leave_toggle":
      setLeaveEnabled(guildId, !getConfig(guildId).leaveEnabled);
      return updateDashboard();

    case "dash_captcha_toggle":
      setCaptchaEnabled(guildId, !getConfig(guildId).captchaEnabled);
      return updateDashboard();

    case "dash_sanction_dm_toggle":
      setSanctionDmEnabled(guildId, !getConfig(guildId).sanctionDmEnabled);
      return updateDashboard();

    case "dash_raid_toggle":
      setRaidMode(guildId, !getConfig(guildId).raidMode);
      return updateDashboard();

    case "dash_joinlock_toggle":
      setJoinLock(guildId, !getConfig(guildId).joinLock);
      return updateDashboard();

    case "dash_log_channel":
      return showModal("dash_modal_log_channel", "Salon de logs principal", "ID ou mention du salon", "123456789012345678 ou <#123456789>");

    case "dash_banlog_channel":
      return showModal("dash_modal_banlog_channel", "Salon de logs bans", "ID ou mention du salon", "123456789012345678 ou <#123456789>");

    case "dash_genlog_channel":
      return showModal("dash_modal_genlog_channel", "Salon de logs généraux", "ID ou mention (vide = désactiver)", "123456789012345678 ou <#123456789>");

    case "dash_invitelog_channel":
      return showModal("dash_modal_invitelog_channel", "Salon de logs invitations", "ID ou mention (vide = désactiver)", "123456789012345678 ou <#123456789>");

    case "dash_reset_welcome_msg":
      setWelcomeMessage(guildId, DEFAULT_WELCOME_MSG);
      return updateDashboard();

    case "dash_reset_leave_msg":
      setLeaveMessage(guildId, DEFAULT_LEAVE_MSG);
      return updateDashboard();

    case "dash_welcome_channel":
      return showModal("dash_modal_welcome_channel", "Salon messages d'arrivée", "ID ou mention du salon", "123456789012345678 ou <#123456789>");

    case "dash_welcome_msg":
      return showModal("dash_modal_welcome_msg", "Message d'arrivée", "Message ({user} {username} {server} {count})", "Bienvenue {user} !", getConfig(guildId).welcomeMessage, true);

    case "dash_leave_channel":
      return showModal("dash_modal_leave_channel", "Salon messages de départ", "ID ou mention du salon", "123456789012345678 ou <#123456789>");

    case "dash_leave_msg":
      return showModal("dash_modal_leave_msg", "Message de départ", "Message ({user} {username} {server} {count})", "Au revoir {username} !", getConfig(guildId).leaveMessage, true);

    case "dash_captcha_channel":
      return showModal("dash_modal_captcha_channel", "Salon de vérification (captcha)", "ID ou mention du salon (vide = désactiver)", "123456789012345678 ou <#123456789>");

    case "dash_captcha_unverified_role":
      return showModal("dash_modal_captcha_unverified_role", "Rôle non-vérifié", "ID du rôle (vide = désactiver)", "123456789012345678 ou <@&123456789>");

    case "dash_captcha_verified_role":
      return showModal("dash_modal_captcha_verified_role", "Rôle vérifié", "ID du rôle (vide = désactiver)", "123456789012345678 ou <@&123456789>");
  }
}

// ──── MODAL SUBMIT ────

async function handleModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  const { customId, guild } = interaction;

  // Modal captcha admin (hors serveur)
  if (customId.startsWith("admin_captcha_verify:")) {
    const parts = customId.split(":");
    const expectedSum = Number(parts[3]);
    const answer = Number(interaction.fields.getTextInputValue("captcha_answer").trim());

    if (answer === expectedSum) {
      await interaction.reply({
        content: "✅ **Vérification réussie** — ton identité est confirmée. Aucune alerte envoyée.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ **Mauvaise réponse** — réponse attendue : \`${expectedSum}\`. Si tu n'as pas fait cette action, clique sur **❌ Non attendu** dans le message d'alerte.`,
        ephemeral: true,
      });
    }
    return;
  }

  if (!guild) return;

  if (customId === "rolerequest_modal") {
    await handleRoleRequestModal(client, interaction);
    return;
  }

  const guildId = guild.id;
  const raw = interaction.fields.getTextInputValue("value").trim();
  const channelId = parseId(raw);
  const roleId = parseId(raw);

  async function replyAndRefresh(content: string) {
    const newCfg = getConfig(guildId);
    await interaction.reply({
      content,
      embeds: [buildDashboardEmbed(newCfg, guild!)],
      components: buildDashboardRows(newCfg),
      ephemeral: true,
    });
  }

  switch (customId) {
    case "dash_modal_welcome_channel":
      if (raw && !isValidId(channelId)) { await interaction.reply({ content: "❌ ID invalide. Utilise l'ID numérique ou une mention `<#id>`.", ephemeral: true }); return; }
      if (raw) setWelcomeChannel(guildId, channelId);
      return replyAndRefresh(raw ? `✅ Salon d'arrivée → <#${channelId}>` : "✅ Salon d'arrivée retiré.");

    case "dash_modal_welcome_msg":
      setWelcomeMessage(guildId, raw || DEFAULT_WELCOME_MSG);
      return replyAndRefresh("✅ Message d'arrivée mis à jour.");

    case "dash_modal_leave_channel":
      if (raw && !isValidId(channelId)) { await interaction.reply({ content: "❌ ID invalide.", ephemeral: true }); return; }
      if (raw) setLeaveChannel(guildId, channelId);
      return replyAndRefresh(raw ? `✅ Salon de départ → <#${channelId}>` : "✅ Salon de départ retiré.");

    case "dash_modal_leave_msg":
      setLeaveMessage(guildId, raw || DEFAULT_LEAVE_MSG);
      return replyAndRefresh("✅ Message de départ mis à jour.");

    case "dash_modal_captcha_channel": {
      const id = raw ? channelId : null;
      if (raw && !isValidId(channelId)) { await interaction.reply({ content: "❌ ID invalide.", ephemeral: true }); return; }
      setCaptchaChannel(guildId, id);
      return replyAndRefresh(id ? `✅ Salon de vérification → <#${id}>.` : "✅ Salon de vérification retiré (fallback DM).");
    }

    case "dash_modal_captcha_unverified_role": {
      const id = raw && isValidId(roleId) ? roleId : null;
      setCaptchaUnverifiedRole(guildId, id);
      return replyAndRefresh(id ? `✅ Rôle non-vérifié → <@&${id}>.` : "✅ Rôle non-vérifié retiré.");
    }

    case "dash_modal_captcha_verified_role": {
      const id = raw && isValidId(roleId) ? roleId : null;
      setCaptchaVerifiedRole(guildId, id);
      return replyAndRefresh(id ? `✅ Rôle vérifié → <@&${id}>.` : "✅ Rôle vérifié retiré.");
    }

    case "dash_modal_log_channel":
      if (raw && !isValidId(channelId)) { await interaction.reply({ content: "❌ ID invalide.", ephemeral: true }); return; }
      if (raw) setLogChannel(guildId, channelId);
      return replyAndRefresh(raw ? `✅ Logs principal → <#${channelId}>` : "✅ Salon de logs non modifié (champ vide).");

    case "dash_modal_banlog_channel":
      if (raw && !isValidId(channelId)) { await interaction.reply({ content: "❌ ID invalide.", ephemeral: true }); return; }
      if (raw) setBanLogChannel(guildId, channelId);
      return replyAndRefresh(raw ? `✅ Logs bans → <#${channelId}>` : "✅ Salon de logs bans non modifié.");

    case "dash_modal_genlog_channel": {
      const id = raw && isValidId(channelId) ? channelId : null;
      if (raw && !isValidId(channelId)) { await interaction.reply({ content: "❌ ID invalide.", ephemeral: true }); return; }
      setGeneralLogChannel(guildId, id);
      return replyAndRefresh(id ? `✅ Logs généraux → <#${id}>` : "✅ Logs généraux désactivés.");
    }

    case "dash_modal_invitelog_channel": {
      const id = raw && isValidId(channelId) ? channelId : null;
      if (raw && !isValidId(channelId)) { await interaction.reply({ content: "❌ ID invalide.", ephemeral: true }); return; }
      setInviteLogChannel(guildId, id);
      return replyAndRefresh(id ? `✅ Logs invitations → <#${id}>` : "✅ Logs invitations désactivés.");
    }
  }
}
