import {
  Client,
  Events,
  EmbedBuilder,
  TextChannel,
  ChannelType,
  AuditLogEvent,
  Guild,
  User,
  PermissionFlagsBits,
  type PartialUser,
} from "discord.js";
import { getConfig } from "./guild-config-store.js";
import { logger } from "../lib/logger.js";
import { sendLogDM } from "./dm-notify.js";

const PERM_FR: Partial<Record<string, string>> = {
  Administrator: "Administrateur",
  ManageGuild: "Gérer le serveur",
  ManageRoles: "Gérer les rôles",
  ManageChannels: "Gérer les salons",
  ManageMessages: "Gérer les messages",
  ManageWebhooks: "Gérer les webhooks",
  ManageNicknames: "Gérer les pseudos",
  ManageEmojisAndStickers: "Gérer les emojis",
  KickMembers: "Expulser des membres",
  BanMembers: "Bannir des membres",
  MentionEveryone: "Mentionner @everyone",
  ViewAuditLog: "Voir les logs d'audit",
  ModerateMembers: "Mettre en timeout",
  MoveMembers: "Déplacer des membres",
  MuteMembers: "Rendre muet",
  DeafenMembers: "Rendre sourd",
  ManageEvents: "Gérer les événements",
  ManageThreads: "Gérer les fils",
  ViewGuildInsights: "Voir les statistiques",
  SendMessages: "Envoyer des messages",
  EmbedLinks: "Intégrer des liens",
  AttachFiles: "Joindre des fichiers",
  ReadMessageHistory: "Lire l'historique",
  UseApplicationCommands: "Utiliser les commandes",
  Connect: "Se connecter (vocal)",
  Speak: "Parler (vocal)",
  Stream: "Streamer",
};

const CHANNEL_TYPE_FR: Partial<Record<ChannelType, string>> = {
  [ChannelType.GuildText]: "Texte",
  [ChannelType.GuildVoice]: "Vocal",
  [ChannelType.GuildCategory]: "Catégorie",
  [ChannelType.GuildAnnouncement]: "Annonces",
  [ChannelType.GuildStageVoice]: "Scène",
  [ChannelType.GuildForum]: "Forum",
  [ChannelType.GuildMedia]: "Médias",
};

async function sendGenLog(client: Client, guildId: string, embed: EmbedBuilder): Promise<void> {
  const cfg = getConfig(guildId);
  if (!cfg.generalLogChannelId) return;
  try {
    const ch = await client.channels.fetch(cfg.generalLogChannelId);
    if (ch?.isTextBased()) await (ch as TextChannel).send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Erreur envoi log général");
  }
}

async function sendGenLogEmbeds(client: Client, guildId: string, embeds: EmbedBuilder[]): Promise<void> {
  if (embeds.length === 0) return;
  const cfg = getConfig(guildId);
  if (!cfg.generalLogChannelId) return;
  try {
    const ch = await client.channels.fetch(cfg.generalLogChannelId);
    if (ch?.isTextBased()) await (ch as TextChannel).send({ embeds: embeds.slice(0, 10) });
  } catch (err) {
    logger.error({ err }, "Erreur envoi log général (multi-embeds)");
  }
}

function userField(user: User | PartialUser | null | undefined, label = "Exécuteur"): { name: string; value: string; inline: true } {
  return {
    name: label,
    value: user ? `${user.tag ?? user.username ?? "Inconnu"} (\`${user.id}\`)` : "Inconnu",
    inline: true,
  };
}

async function getAuditExecutor(guild: Guild, actionType: AuditLogEvent, targetId?: string): Promise<User | PartialUser | null> {
  try {
    const entries = await guild.fetchAuditLogs({ type: actionType, limit: 3 });
    const entry = targetId
      ? entries.entries.find((e) => (e.target as { id?: string } | null)?.id === targetId)
      : entries.entries.first();
    if (!entry) return null;
    if (Date.now() - entry.createdTimestamp > 5000) return null;
    return entry.executor;
  } catch {
    return null;
  }
}

export function registerGeneralLog(client: Client): void {

  // ── VOCAL ──
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const guildId = newState.guild.id;
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    if (!oldState.channelId && newState.channelId) {
      await sendGenLog(client, guildId, new EmbedBuilder()
        .setColor(0x22c55e).setTitle("🔊 Rejoint un salon vocal")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Salon", value: `<#${newState.channelId}> — \`${newState.channel?.name ?? "?"}\``, inline: true },
        )
        .setFooter({ text: `ID : ${member.id}` })
        .setTimestamp());

    } else if (oldState.channelId && !newState.channelId) {
      await sendGenLog(client, guildId, new EmbedBuilder()
        .setColor(0xef4444).setTitle("🔇 Quitté un salon vocal")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Salon", value: `\`${oldState.channel?.name ?? "?"}\``, inline: true },
        )
        .setFooter({ text: `ID : ${member.id}` })
        .setTimestamp());

    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await sendGenLog(client, guildId, new EmbedBuilder()
        .setColor(0x6366f1).setTitle("🔀 Changement de salon vocal")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Avant", value: `\`${oldState.channel?.name ?? "?"}\``, inline: true },
          { name: "Après", value: `<#${newState.channelId}> — \`${newState.channel?.name ?? "?"}\``, inline: true },
        )
        .setFooter({ text: `ID : ${member.id}` })
        .setTimestamp());
    }
  });

  // ── MESSAGES MODIFIÉS ──
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (newMsg.author?.bot) return;
    if (!newMsg.guildId) return;
    if (oldMsg.content === newMsg.content) return;

    const before = (oldMsg.content || "*[Non disponible — non mis en cache]*").slice(0, 1000);
    const after = (newMsg.content || "*[Vide]*").slice(0, 1000);

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("✏️ Message modifié")
      .setURL(newMsg.url)
      .setThumbnail(newMsg.author?.displayAvatarURL() ?? null)
      .addFields(
        { name: "Auteur", value: `${newMsg.author?.tag ?? "Inconnu"} (\`${newMsg.author?.id ?? "?"}\`)`, inline: true },
        { name: "Salon", value: `<#${newMsg.channelId}>`, inline: true },
        { name: "📍 Lien", value: `[Voir le message](${newMsg.url})`, inline: true },
        { name: "Avant", value: `\`\`\`\n${before}\n\`\`\`` },
        { name: "Après", value: `\`\`\`\n${after}\n\`\`\`` },
      )
      .setFooter({ text: `ID auteur : ${newMsg.author?.id ?? "?"}` })
      .setTimestamp();

    // Pièces jointes présentes sur le message modifié
    const attachments = [...(newMsg.attachments?.values() ?? [])];
    const imageAttachments = attachments.filter((a) => a.contentType?.startsWith("image/") ?? /\.(png|jpe?g|gif|webp)$/i.test(a.name));
    const otherAttachments = attachments.filter((a) => !(a.contentType?.startsWith("image/") ?? /\.(png|jpe?g|gif|webp)$/i.test(a.name)));

    if (imageAttachments[0]) embed.setImage(imageAttachments[0].url);
    if (otherAttachments.length > 0) {
      embed.addFields({
        name: "📎 Pièces jointes",
        value: otherAttachments.map((a) => `[${a.name}](${a.url})`).join("\n").slice(0, 1024),
      });
    }

    const embeds: EmbedBuilder[] = [embed];
    // Images supplémentaires (embed vierge avec uniquement l'image)
    for (const img of imageAttachments.slice(1, 4)) {
      embeds.push(new EmbedBuilder().setURL(newMsg.url).setImage(img.url).setColor(0xf59e0b));
    }

    await sendGenLogEmbeds(client, newMsg.guildId, embeds);
  });

  // ── MESSAGES SUPPRIMÉS ──
  client.on(Events.MessageDelete, async (msg) => {
    if (msg.author?.bot) return;
    if (!msg.guildId) return;

    const guild = msg.guild;
    const executor = guild ? await getAuditExecutor(guild, AuditLogEvent.MessageDelete, msg.author?.id) : null;

    const content = msg.content?.trim() || "";
    const attachments = [...(msg.attachments?.values() ?? [])];
    const imageAttachments = attachments.filter((a) => a.contentType?.startsWith("image/") ?? /\.(png|jpe?g|gif|webp)$/i.test(a.name));
    const otherAttachments = attachments.filter((a) => !(a.contentType?.startsWith("image/") ?? /\.(png|jpe?g|gif|webp)$/i.test(a.name)));

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("🗑️ Message supprimé")
      .setThumbnail(msg.author?.displayAvatarURL() ?? null)
      .addFields(
        { name: "Auteur", value: msg.author ? `${msg.author.tag} (\`${msg.author.id}\`)` : "Inconnu", inline: true },
        { name: "Salon", value: `<#${msg.channelId}>`, inline: true },
      );

    if (executor && executor.id !== msg.author?.id) {
      embed.addFields(userField(executor, "Supprimé par"));
    }

    // Contenu texte
    if (content) {
      embed.addFields({ name: "Contenu", value: `\`\`\`\n${content.slice(0, 1000)}\n\`\`\`` });
    } else if (attachments.length === 0) {
      embed.addFields({ name: "Contenu", value: "*[Non disponible — non mis en cache]*" });
    }

    // Pièces jointes non-images
    if (otherAttachments.length > 0) {
      embed.addFields({
        name: "📎 Pièces jointes",
        value: otherAttachments.map((a) => `[${a.name}](${a.url})`).join("\n").slice(0, 1024),
      });
    }

    // Première image dans l'embed principal
    if (imageAttachments[0]) {
      embed.setImage(imageAttachments[0].url);
      if (imageAttachments.length > 1) {
        embed.addFields({ name: "🖼️ Images", value: `${imageAttachments.length} image(s) ci-dessous` });
      }
    }

    embed.setFooter({ text: `ID auteur : ${msg.author?.id ?? "?"}` }).setTimestamp();

    const embeds: EmbedBuilder[] = [embed];
    // Images supplémentaires en embeds liés (même URL = groupés par Discord)
    for (const img of imageAttachments.slice(1, 4)) {
      embeds.push(new EmbedBuilder().setURL(`https://discord.com/channels/${msg.guildId}/${msg.channelId}`).setImage(img.url).setColor(0xef4444));
    }

    await sendGenLogEmbeds(client, msg.guildId, embeds);
  });

  // ── SUPPRESSION MASSIVE ──
  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    if (!channel.guildId) return;

    const guild = channel.guild;
    const executor = guild ? await getAuditExecutor(guild, AuditLogEvent.MessageBulkDelete) : null;

    const uniqueAuthors = [...new Set(
      messages
        .filter((m) => m.author && !m.author.bot)
        .map((m) => `${m.author!.tag} (\`${m.author!.id}\`)`),
    )].slice(0, 8);

    const embed = new EmbedBuilder()
      .setColor(0xef4444).setTitle("🗑️ Suppression massive de messages")
      .addFields(
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Nombre supprimés", value: `**${messages.size}**`, inline: true },
      );

    if (uniqueAuthors.length > 0) {
      embed.addFields({ name: "Auteurs concernés", value: uniqueAuthors.join("\n") });
    }
    if (executor) {
      embed.addFields(userField(executor, "Exécuté par"));
      embed.setFooter({ text: `ID exécuteur : ${executor.id}` });
    }

    embed.setTimestamp();
    await sendGenLog(client, channel.guildId, embed);
  });

  // ── SALONS CRÉÉS ──
  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guildId) return;
    const executor = await getAuditExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await sendGenLog(client, channel.guildId, new EmbedBuilder()
      .setColor(0x22c55e).setTitle("📁 Salon créé")
      .addFields(
        { name: "Nom", value: channel.name, inline: true },
        { name: "Type", value: CHANNEL_TYPE_FR[channel.type] ?? String(channel.type), inline: true },
        { name: "Mention", value: `<#${channel.id}> (\`${channel.id}\`)`, inline: true },
        userField(executor, "Créé par"),
      )
      .setFooter({ text: `ID salon : ${channel.id}${executor ? ` • ID auteur : ${executor.id}` : ""}` })
      .setTimestamp());
  });

  // ── SALONS SUPPRIMÉS ──
  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guildId" in channel) || !channel.guildId) return;
    const executor = await getAuditExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await sendGenLog(client, channel.guildId, new EmbedBuilder()
      .setColor(0xef4444).setTitle("📁 Salon supprimé")
      .addFields(
        { name: "Nom", value: channel.name, inline: true },
        { name: "Type", value: CHANNEL_TYPE_FR[channel.type] ?? String(channel.type), inline: true },
        { name: "ID", value: `\`${channel.id}\``, inline: true },
        userField(executor, "Supprimé par"),
      )
      .setFooter({ text: `ID salon : ${channel.id}${executor ? ` • ID auteur : ${executor.id}` : ""}` })
      .setTimestamp());
  });

  // ── SALONS MODIFIÉS ──
  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!("guildId" in newChannel) || !newChannel.guildId) return;
    const changes: string[] = [];
    if ("name" in oldChannel && "name" in newChannel && oldChannel.name !== newChannel.name)
      changes.push(`**Nom** : \`${oldChannel.name}\` → \`${newChannel.name}\``);
    if ("topic" in oldChannel && "topic" in newChannel && oldChannel.topic !== newChannel.topic)
      changes.push(`**Description** : ${oldChannel.topic || "*(vide)*"} → ${newChannel.topic || "*(vide)*"}`);
    if ("bitrate" in oldChannel && "bitrate" in newChannel && oldChannel.bitrate !== newChannel.bitrate)
      changes.push(`**Bitrate** : ${oldChannel.bitrate}kbps → ${newChannel.bitrate}kbps`);
    if (!changes.length) return;

    const executor = await getAuditExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    await sendGenLog(client, newChannel.guildId, new EmbedBuilder()
      .setColor(0xf59e0b).setTitle("📝 Salon modifié")
      .addFields(
        { name: "Salon", value: `<#${newChannel.id}> (\`${newChannel.id}\`)`, inline: true },
        userField(executor, "Modifié par"),
        { name: "Modifications", value: changes.join("\n") },
      )
      .setFooter({ text: `ID salon : ${newChannel.id}${executor ? ` • ID auteur : ${executor.id}` : ""}` })
      .setTimestamp());
  });

  // ── RÔLES CRÉÉS ──
  client.on(Events.GuildRoleCreate, async (role) => {
    const executor = await getAuditExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    await sendGenLog(client, role.guild.id, new EmbedBuilder()
      .setColor(0x22c55e).setTitle("🎭 Rôle créé")
      .addFields(
        { name: "Nom", value: role.name, inline: true },
        { name: "Couleur", value: role.hexColor, inline: true },
        { name: "ID", value: `\`${role.id}\``, inline: true },
        userField(executor, "Créé par"),
      )
      .setFooter({ text: `ID rôle : ${role.id}${executor ? ` • ID auteur : ${executor.id}` : ""}` })
      .setTimestamp());
  });

  // ── RÔLES SUPPRIMÉS ──
  client.on(Events.GuildRoleDelete, async (role) => {
    const executor = await getAuditExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    await sendGenLog(client, role.guild.id, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🎭 Rôle supprimé")
      .addFields(
        { name: "Nom", value: role.name, inline: true },
        { name: "ID", value: `\`${role.id}\``, inline: true },
        userField(executor, "Supprimé par"),
      )
      .setFooter({ text: `ID rôle : ${role.id}${executor ? ` • ID auteur : ${executor.id}` : ""}` })
      .setTimestamp());
  });

  // ── RÔLES MODIFIÉS ──
  client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    const changes: string[] = [];
    if (oldRole.name !== newRole.name)
      changes.push(`**Nom** : \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.hexColor !== newRole.hexColor)
      changes.push(`**Couleur** : ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.hoist !== newRole.hoist)
      changes.push(`**Affiché séparément** : ${oldRole.hoist ? "Oui" : "Non"} → ${newRole.hoist ? "Oui" : "Non"}`);
    if (oldRole.mentionable !== newRole.mentionable)
      changes.push(`**Mentionnable** : ${oldRole.mentionable ? "Oui" : "Non"} → ${newRole.mentionable ? "Oui" : "Non"}`);

    // Diff des permissions
    // A.missing(B) = permissions présentes dans B mais absentes de A
    const addedPerms = oldRole.permissions.missing(newRole.permissions);   // dans new mais pas dans old = ajoutées
    const removedPerms = newRole.permissions.missing(oldRole.permissions); // dans old mais pas dans new = retirées
    const fmtPerm = (p: string) => `\`${PERM_FR[p] ?? p}\``;
    if (addedPerms.length)
      changes.push(`**Permissions accordées** : ${addedPerms.map(fmtPerm).join(", ")}`);
    if (removedPerms.length)
      changes.push(`**Permissions retirées** : ${removedPerms.map(fmtPerm).join(", ")}`);

    if (!changes.length) return;

    const executor = await getAuditExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

    // Alerte si la permission Administrateur vient d'être accordée à ce rôle
    const adminJustGranted = addedPerms.includes("Administrator");
    const color = adminJustGranted ? 0xef4444 : 0xf59e0b;
    const title = adminJustGranted ? "🚨 Rôle modifié — Permission Admin accordée !" : "🎭 Rôle modifié";

    const embed = new EmbedBuilder()
      .setColor(color).setTitle(title)
      .addFields(
        { name: "Rôle", value: `<@&${newRole.id}> — \`${newRole.name}\` (\`${newRole.id}\`)`, inline: true },
        userField(executor, "Modifié par"),
        { name: "Modifications", value: changes.join("\n").slice(0, 1024) },
      )
      .setFooter({ text: `ID rôle : ${newRole.id}${executor ? ` • ID auteur : ${executor.id}` : ""}` })
      .setTimestamp();

    await sendGenLog(client, newRole.guild.id, embed);

    if (adminJustGranted) {
      // Membres déjà porteurs de ce rôle → ils ont admin depuis cette modif
      const affectedMembers = newRole.members.filter((m) => !m.user.bot);

      // Alerte propriétaire bot
      const memberList = affectedMembers.size > 0
        ? affectedMembers.map((m) => `${m.user.tag} (\`${m.id}\`)`).slice(0, 10).join("\n")
        : "Aucun membre";
      const alertOwner = new EmbedBuilder()
        .setColor(0xef4444).setTitle("🚨 Alerte sécurité — Permission Admin sur un rôle")
        .addFields(
          { name: "Serveur", value: `${newRole.guild.name} (\`${newRole.guild.id}\`)`, inline: true },
          { name: "Rôle", value: `${newRole.name} (\`${newRole.id}\`)`, inline: true },
          userField(executor, "Modifié par"),
          { name: `👥 Membres impactés (${affectedMembers.size})`, value: memberList },
        )
        .setTimestamp();
      await sendLogDM(client, alertOwner);

      // DM à chaque membre porteur du rôle
      for (const member of affectedMembers.values()) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle("⚠️ Alerte sécurité — Tu possèdes maintenant un rôle Administrateur")
          .setThumbnail(newRole.guild.iconURL())
          .setDescription(
            `Le rôle **${newRole.name}** sur **${newRole.guild.name}** vient de recevoir la permission **Administrateur**.\n` +
            `Tu possèdes ce rôle — tu as donc désormais accès aux permissions Admin.\n` +
            `Si tu ne t'attendais pas à cette action, contacte immédiatement un administrateur du serveur.`,
          )
          .addFields(
            { name: "Serveur", value: newRole.guild.name, inline: true },
            { name: "Rôle concerné", value: `\`${newRole.name}\``, inline: true },
            ...(executor ? [userField(executor, "Modifié par")] : []),
          )
          .setTimestamp();
        try { await member.user.send({ embeds: [dmEmbed] }); }
        catch { /* DMs fermés */ }
      }
    }
  });

  // ── MEMBRES MODIFIÉS ──
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (newMember.user.bot) return;
    const changes: string[] = [];

    if (oldMember.nickname !== newMember.nickname)
      changes.push(`**Pseudo** : \`${oldMember.nickname ?? "Aucun"}\` → \`${newMember.nickname ?? "Aucun"}\``);

    const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
    if (addedRoles.size > 0)
      changes.push(`**Rôles ajoutés** : ${addedRoles.map((r) => `<@&${r.id}>`).join(", ")}`);

    const removedRoles = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
    if (removedRoles.size > 0)
      changes.push(`**Rôles retirés** : ${removedRoles.map((r) => `<@&${r.id}>`).join(", ")}`);

    if (!changes.length) return;

    // Rôles admin nouvellement reçus
    const newAdminRoles = addedRoles.filter((r) => r.permissions.has(PermissionFlagsBits.Administrator));

    // MemberRoleUpdate pour les changements de rôles, MemberUpdate pour le reste (pseudo)
    const hasRoleChange = addedRoles.size > 0 || removedRoles.size > 0;
    const auditEvent = hasRoleChange ? AuditLogEvent.MemberRoleUpdate : AuditLogEvent.MemberUpdate;
    const executor = await getAuditExecutor(newMember.guild, auditEvent, newMember.id);

    const isAdminAlert = newAdminRoles.size > 0;
    const embed = new EmbedBuilder()
      .setColor(isAdminAlert ? 0xef4444 : 0x6366f1)
      .setTitle(isAdminAlert ? "🚨 Membre modifié — Rôle Admin attribué !" : "👤 Membre modifié")
      .setThumbnail(newMember.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${newMember.user.tag} (\`${newMember.id}\`)`, inline: true },
        { name: "Modifications", value: changes.join("\n").slice(0, 1024) },
      );

    if (isAdminAlert) {
      embed.addFields({
        name: "⚠️ Rôles admin accordés",
        value: newAdminRoles.map((r) => `<@&${r.id}> — \`${r.name}\``).join("\n"),
      });
    }

    if (executor && executor.id !== newMember.id) {
      embed.addFields(userField(executor, "Modifié par"));
      embed.setFooter({ text: `ID membre : ${newMember.id} • ID auteur : ${executor.id}` });
    } else {
      embed.setFooter({ text: `ID membre : ${newMember.id}` });
    }

    embed.setTimestamp();
    await sendGenLog(client, newMember.guild.id, embed);

    if (isAdminAlert) {
      // DM à l'utilisateur concerné
      const dmEmbed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("⚠️ Alerte sécurité — Rôle Administrateur reçu")
        .setThumbnail(newMember.guild.iconURL())
        .setDescription(
          `Tu viens de recevoir un rôle avec la permission **Administrateur** sur **${newMember.guild.name}**.\n` +
          `Si tu ne t'attendais pas à cette action, contacte immédiatement un administrateur du serveur.`,
        )
        .addFields(
          { name: "Serveur", value: newMember.guild.name, inline: true },
          {
            name: "Rôle(s) reçu(s)",
            value: newAdminRoles.map((r) => `\`${r.name}\``).join(", "),
            inline: true,
          },
          ...(executor ? [userField(executor, "Attribué par")] : []),
        )
        .setTimestamp();

      try { await newMember.user.send({ embeds: [dmEmbed] }); }
      catch { /* DMs fermés */ }

      // Alerte propriétaire bot
      const ownerEmbed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("🚨 Alerte sécurité — Rôle Admin attribué à un membre")
        .addFields(
          { name: "Serveur", value: `${newMember.guild.name} (\`${newMember.guild.id}\`)`, inline: true },
          { name: "Membre", value: `${newMember.user.tag} (\`${newMember.id}\`)`, inline: true },
          { name: "Rôle(s)", value: newAdminRoles.map((r) => `${r.name} (\`${r.id}\`)`).join(", "), inline: true },
          ...(executor ? [userField(executor, "Attribué par")] : []),
        )
        .setTimestamp();
      await sendLogDM(client, ownerEmbed);
    }
  });

  // ── INVITATIONS CRÉÉES ──
  client.on(Events.InviteCreate, async (invite) => {
    if (!invite.guild?.id) return;
    await sendGenLog(client, invite.guild.id, new EmbedBuilder()
      .setColor(0x22c55e).setTitle("🔗 Invitation créée")
      .addFields(
        { name: "Code", value: `\`${invite.code}\``, inline: true },
        { name: "Créateur", value: invite.inviter ? `${invite.inviter.tag} (\`${invite.inviter.id}\`)` : "Inconnu", inline: true },
        { name: "Salon", value: invite.channel ? `<#${invite.channel.id}>` : "Inconnu", inline: true },
        { name: "Max utilisations", value: invite.maxUses ? String(invite.maxUses) : "Illimité", inline: true },
        { name: "Expire", value: invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : "Jamais", inline: true },
      )
      .setFooter({ text: invite.inviter ? `ID créateur : ${invite.inviter.id}` : "Créateur inconnu" })
      .setTimestamp());
  });

  // ── INVITATIONS SUPPRIMÉES ──
  client.on(Events.InviteDelete, async (invite) => {
    if (!invite.guild?.id) return;
    const guild = invite.guild instanceof Guild ? invite.guild : null;
    const executor = guild ? await getAuditExecutor(guild, AuditLogEvent.InviteDelete) : null;
    await sendGenLog(client, invite.guild.id, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🔗 Invitation supprimée")
      .addFields(
        { name: "Code", value: `\`${invite.code}\``, inline: true },
        { name: "Salon", value: invite.channel ? `<#${invite.channel.id}>` : "Inconnu", inline: true },
        userField(executor, "Supprimée par"),
      )
      .setFooter({ text: executor ? `ID auteur : ${executor.id}` : "Auteur inconnu" })
      .setTimestamp());
  });
}
