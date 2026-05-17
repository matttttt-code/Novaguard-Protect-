import {
  Client,
  Events,
  EmbedBuilder,
  TextChannel,
  ChannelType,
  GuildMember,
  PartialGuildMember,
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
        ).setTimestamp());

    } else if (oldState.channelId && !newState.channelId) {
      await sendGenLog(client, guildId, new EmbedBuilder()
        .setColor(0xef4444).setTitle("🔇 Quitté un salon vocal")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Salon", value: `\`${oldState.channel?.name ?? "?"}\``, inline: true },
        ).setTimestamp());

    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await sendGenLog(client, guildId, new EmbedBuilder()
        .setColor(0x6366f1).setTitle("🔀 Changement de salon vocal")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Avant", value: `\`${oldState.channel?.name ?? "?"}\``, inline: true },
          { name: "Après", value: `<#${newState.channelId}> — \`${newState.channel?.name ?? "?"}\``, inline: true },
        ).setTimestamp());
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
      ).setTimestamp());
  });

  // ── MESSAGES SUPPRIMÉS ──
  client.on(Events.MessageDelete, async (msg) => {
    if (msg.author?.bot) return;
    if (!msg.guildId) return;

    await sendGenLog(client, msg.guildId, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🗑️ Message supprimé")
      .addFields(
        { name: "Auteur", value: msg.author ? `${msg.author.tag} (\`${msg.author.id}\`)` : "Inconnu", inline: true },
        { name: "Salon", value: `<#${msg.channelId}>`, inline: true },
        { name: "Contenu", value: (msg.content || "*[Non disponible — contenu non mis en cache]*").slice(0, 1024) },
      ).setTimestamp());
  });

  // ── SUPPRESSION MASSIVE ──
  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    if (!channel.guildId) return;
    await sendGenLog(client, channel.guildId, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🗑️ Suppression massive de messages")
      .addFields(
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Nombre supprimés", value: `**${messages.size}**`, inline: true },
      ).setTimestamp());
  });

  // ── SALONS CRÉÉS ──
  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guildId) return;
    await sendGenLog(client, channel.guildId, new EmbedBuilder()
      .setColor(0x22c55e).setTitle("📁 Salon créé")
      .addFields(
        { name: "Nom", value: channel.name, inline: true },
        { name: "Type", value: CHANNEL_TYPE_FR[channel.type] ?? String(channel.type), inline: true },
        { name: "Mention", value: `<#${channel.id}>`, inline: true },
      ).setTimestamp());
  });

  // ── SALONS SUPPRIMÉS ──
  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guildId" in channel) || !channel.guildId) return;
    await sendGenLog(client, channel.guildId, new EmbedBuilder()
      .setColor(0xef4444).setTitle("📁 Salon supprimé")
      .addFields(
        { name: "Nom", value: channel.name, inline: true },
        { name: "Type", value: CHANNEL_TYPE_FR[channel.type] ?? String(channel.type), inline: true },
        { name: "ID", value: `\`${channel.id}\``, inline: true },
      ).setTimestamp());
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
    await sendGenLog(client, newChannel.guildId, new EmbedBuilder()
      .setColor(0xf59e0b).setTitle("📝 Salon modifié")
      .addFields(
        { name: "Salon", value: `<#${newChannel.id}>`, inline: true },
        { name: "Modifications", value: changes.join("\n") },
      ).setTimestamp());
  });

  // ── RÔLES CRÉÉS ──
  client.on(Events.GuildRoleCreate, async (role) => {
    await sendGenLog(client, role.guild.id, new EmbedBuilder()
      .setColor(0x22c55e).setTitle("🎭 Rôle créé")
      .addFields(
        { name: "Nom", value: role.name, inline: true },
        { name: "Couleur", value: role.hexColor, inline: true },
        { name: "ID", value: `\`${role.id}\``, inline: true },
      ).setTimestamp());
  });

  // ── RÔLES SUPPRIMÉS ──
  client.on(Events.GuildRoleDelete, async (role) => {
    await sendGenLog(client, role.guild.id, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🎭 Rôle supprimé")
      .addFields(
        { name: "Nom", value: role.name, inline: true },
        { name: "ID", value: `\`${role.id}\``, inline: true },
      ).setTimestamp());
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
    await sendGenLog(client, newRole.guild.id, new EmbedBuilder()
      .setColor(0xf59e0b).setTitle("🎭 Rôle modifié")
      .addFields(
        { name: "Rôle", value: `<@&${newRole.id}> — \`${newRole.name}\``, inline: true },
        { name: "Modifications", value: changes.join("\n") },
      ).setTimestamp());
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
    await sendGenLog(client, newMember.guild.id, new EmbedBuilder()
      .setColor(0x6366f1).setTitle("👤 Membre modifié")
      .setThumbnail(newMember.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${newMember.user.tag} (\`${newMember.id}\`)`, inline: true },
        { name: "Modifications", value: changes.join("\n") },
      ).setTimestamp());
  });

  // ── BANS ──
  client.on(Events.GuildBanAdd, async (ban) => {
    await sendGenLog(client, ban.guild.id, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🔨 Membre banni")
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: "Raison", value: ban.reason ?? "Aucune raison fournie" },
      ).setTimestamp());
  });

  // ── DÉBANS ──
  client.on(Events.GuildBanRemove, async (ban) => {
    await sendGenLog(client, ban.guild.id, new EmbedBuilder()
      .setColor(0x22c55e).setTitle("🔓 Membre débanni")
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
      ).setTimestamp());
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
      ).setTimestamp());
  });

  // ── INVITATIONS SUPPRIMÉES ──
  client.on(Events.InviteDelete, async (invite) => {
    if (!invite.guild?.id) return;
    await sendGenLog(client, invite.guild.id, new EmbedBuilder()
      .setColor(0xef4444).setTitle("🔗 Invitation supprimée")
      .addFields(
        { name: "Code", value: `\`${invite.code}\``, inline: true },
        { name: "Salon", value: invite.channel ? `<#${invite.channel.id}>` : "Inconnu", inline: true },
      ).setTimestamp());
  });
}
