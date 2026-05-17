import {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  TextChannel,
  EmbedBuilder,
  ButtonInteraction,
  type ApplicationCommandDataResolvable,
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
import { sendLog, logEmbed, LOG_CHANNEL_ID } from "./log.js";
import { isRaidMode, getConfig } from "./guild-config-store.js";
import { getSupportRequest, removeSupportRequest } from "./pending-support-store.js";
import { handleSupportResponse } from "./commands/support.js";

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
        const channelId = config.logChannelId ?? LOG_CHANNEL_ID;
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

    await sendLog(client, joinEmbed, {
      guildId,
      pingEveryone: isSuspect,
    });
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
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Impossible de se connecter à Discord");
  });
}

async function handleButtonInteraction(client: Client, interaction: ButtonInteraction): Promise<void> {
  const { customId, guild } = interaction;
  if (!guild) return;

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
