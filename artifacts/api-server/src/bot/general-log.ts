import {
  Client,
  Events,
  EmbedBuilder,
  TextChannel,
  ChannelType,
  AuditLogEvent,
  Guild,
  User,
  type PartialUser,
} from "discord.js";
import { getConfig } from "./guild-config-store.js";
import { logger } from "../lib/logger.js";

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

    const before = (oldMsg.content || "*[Non disponible — contenu non mis en cache]*").slice(0, 1000);
    const after = (newMsg.content || "*[Non disponible]*").slice(0, 1000);

    await sendGenLog(client, newMsg.guildId, new EmbedBuilder()
      .setColor(0xf59e0b).setTitle("✏️ Message modifié")
      .setURL(newMsg.url)
      .addFields(
        { name: "Auteur", value: `${newMsg.author?.tag ?? "Inconnu"} (\`${newMsg.author?.id ?? "?"}\`)`, inline: true },
        { name: "Salon", value: `<#${newMsg.channelId}>`, inline: true },
        { name: "📍 Lien", value: `[🟢 Voir le message](${newMsg.url})`, inline: true },
        { name: "Avant", value: before },
        { name: "Après", value: after },
      )
      .setFooter({ text: `ID auteur : ${newMsg.author?.id ?? "?"}` })
      .setTimestamp());
  });

  // ── MESSAGES SUPPRIMÉS ──
  client.on(Events.MessageDelete, async (msg) => {
    if (msg.author?.bot) return;
    if (!msg.guildId) return;

    const guild = msg.guild;
    const executor = guild ? await getAuditExecutor(guild, AuditLogEvent.MessageDelete, msg.author?.id) : null;

    const embed = new EmbedBuilder()
      .setColor(0xef4444).setTitle("🗑️ Message supprimé")
      .addFields(
        { name: "Auteur", value: msg.author ? `${msg.author.tag} (\`${msg.author.id}\`)` : "Inconnu", inline: true },
        { name: "Salon", value: `<#${msg.channelId}>`, inline: true },
        { name: "Contenu", value: (msg.content || "*[Non disponible — contenu non mis en cache]*").slice(0, 1024) },
      );

    if (executor && executor.id !== msg.author?.id) {
      embed.addFields(userField(executor, "Supprimé par"));
    }

    embed.setFooter({ text: `ID auteur : ${msg.author?.id ?? "?"}` }).setTimestamp();

    await sendGenLog(client, msg.guildId, embed);
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
    if (!changes.length) return;

    const executor = await getAuditExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    await sendGenLog(client, newRole.guild.id, new EmbedBuilder()
      .setColor(0xf59e0b).setTitle("🎭 Rôle modifié")
      .addFields(
        { name: "Rôle", value: `<@&${newRole.id}> — \`${newRole.name}\` (\`${newRole.id}\`)`, inline: true },
        userField(executor, "Modifié par"),
        { name: "Modifications", value: changes.join("\n") },
      )
      .setFooter({ text: `ID rôle : ${newRole.id}${executor ? ` • ID auteur : ${executor.id}` : ""}` })
      .setTimestamp());
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

    const executor = await getAuditExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);

    const embed = new EmbedBuilder()
      .setColor(0x6366f1).setTitle("👤 Membre modifié")
      .setThumbnail(newMember.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${newMember.user.tag} (\`${newMember.id}\`)`, inline: true },
        { name: "Modifications", value: changes.join("\n") },
      );

    if (executor && executor.id !== newMember.id) {
      embed.addFields(userField(executor, "Modifié par"));
      embed.setFooter({ text: `ID membre : ${newMember.id} • ID auteur : ${executor.id}` });
    } else {
      embed.setFooter({ text: `ID membre : ${newMember.id}` });
    }

    embed.setTimestamp();
    await sendGenLog(client, newMember.guild.id, embed);
  });

  // ── BANS ──
  client.on(Events.GuildBanAdd, async (ban) => {
    const executor = await getAuditExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await sendGenLog(client, ban.guild.id, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🔨 Membre banni")
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        userField(executor, "Banni par"),
        { name: "Raison", value: ban.reason ?? "Aucune raison fournie" },
      )
      .setFooter({ text: `ID banni : ${ban.user.id}${executor ? ` • ID modérateur : ${executor.id}` : ""}` })
      .setTimestamp());
  });

  // ── DÉBANS ──
  client.on(Events.GuildBanRemove, async (ban) => {
    const executor = await getAuditExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await sendGenLog(client, ban.guild.id, new EmbedBuilder()
      .setColor(0x22c55e).setTitle("🔓 Membre débanni")
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        userField(executor, "Débanni par"),
      )
      .setFooter({ text: `ID débanni : ${ban.user.id}${executor ? ` • ID modérateur : ${executor.id}` : ""}` })
      .setTimestamp());
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
