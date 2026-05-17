import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  Message,
  ChannelType,
  GuildVerificationLevel,
  GuildExplicitContentFilter,
  GuildPremiumTier,
} from "discord.js";
import { getInviteBlacklist } from "../invite-blacklist-store.js";
import { getInviteStats } from "../invite-tracker.js";
import { getConfig } from "../guild-config-store.js";

const VERIFICATION_FR: Record<GuildVerificationLevel, string> = {
  [GuildVerificationLevel.None]: "Aucune",
  [GuildVerificationLevel.Low]: "Faible (e-mail vérifié)",
  [GuildVerificationLevel.Medium]: "Moyenne (inscrit depuis +5 min)",
  [GuildVerificationLevel.High]: "Élevée (membre depuis +10 min)",
  [GuildVerificationLevel.VeryHigh]: "Très élevée (téléphone vérifié)",
};

const EXPLICIT_FR: Record<GuildExplicitContentFilter, string> = {
  [GuildExplicitContentFilter.Disabled]: "Désactivé",
  [GuildExplicitContentFilter.MembersWithoutRoles]: "Membres sans rôle",
  [GuildExplicitContentFilter.AllMembers]: "Tous les membres",
};

const BOOST_TIER_FR: Record<GuildPremiumTier, string> = {
  [GuildPremiumTier.None]: "Aucun",
  [GuildPremiumTier.Tier1]: "Niveau 1",
  [GuildPremiumTier.Tier2]: "Niveau 2",
  [GuildPremiumTier.Tier3]: "Niveau 3",
};

async function buildServerStatsEmbed(guild: Guild): Promise<EmbedBuilder> {
  await guild.fetch();
  const members = await guild.members.fetch().catch(() => guild.members.cache);

  const totalMembers = members.size;
  const bots = members.filter((m) => m.user.bot).size;
  const humans = totalMembers - bots;
  const presenceIntentActive = process.env["DISCORD_PRESENCE_INTENT"] === "true";
  const onlineRaw = presenceIntentActive
    ? members.filter((m) => m.presence?.status !== undefined && m.presence.status !== "offline").size
    : -1;
  const online = onlineRaw;
  const offline = presenceIntentActive ? totalMembers - online : -1;

  const channels = guild.channels.cache;
  const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
  const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
  const categories = channels.filter((c) => c.type === ChannelType.GuildCategory).size;
  const announcements = channels.filter((c) => c.type === ChannelType.GuildAnnouncement).size;
  const forums = channels.filter((c) => c.type === ChannelType.GuildForum).size;
  const stages = channels.filter((c) => c.type === ChannelType.GuildStageVoice).size;
  const totalChannels = channels.size;

  const roles = guild.roles.cache.size - 1; // exclude @everyone
  const emojis = guild.emojis.cache.size;
  const stickers = guild.stickers.cache.size;
  const boosts = guild.premiumSubscriptionCount ?? 0;
  const boostTier = BOOST_TIER_FR[guild.premiumTier];

  const createdTs = Math.floor(guild.createdTimestamp / 1000);
  const ageMs = Date.now() - guild.createdTimestamp;
  const ageDays = Math.floor(ageMs / 86_400_000);

  const owner = await guild.fetchOwner().catch(() => null);

  const inviteBlacklist = getInviteBlacklist(guild.id).length;
  const config = getConfig(guild.id);

  const configuredCount = [
    config.logChannelId,
    config.banLogChannelId,
    config.generalLogChannelId,
    config.inviteLogChannelId,
    config.welcomeChannelId,
    config.captchaChannelId,
    config.ticketStaffRoleId,
  ].filter(Boolean).length;

  // Top inviteur du serveur
  let topInviterText = "*Aucune donnée*";
  try {
    const allStats = members
      .map((m) => ({ userId: m.id, stats: getInviteStats(guild.id, m.id) }))
      .filter((x) => x.stats.invited > 0)
      .sort((a, b) => (b.stats.invited - b.stats.left) - (a.stats.invited - a.stats.left));

    if (allStats.length > 0) {
      const top3 = allStats.slice(0, 3).map((x, i) => {
        const medals = ["🥇", "🥈", "🥉"];
        const active = Math.max(0, x.stats.invited - x.stats.left);
        return `${medals[i]} <@${x.userId}> — **${x.stats.invited}** invités · **${active}** actifs`;
      });
      topInviterText = top3.join("\n");
    }
  } catch { /* ignore */ }

  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`📊 Statistiques — ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
    .addFields(
      {
        name: "👥 Membres",
        value:
          `👤 **Total :** ${totalMembers}\n` +
          `🧑 **Humains :** ${humans}\n` +
          `🤖 **Bots :** ${bots}\n` +
          `🟢 **En ligne :** ${online === -1 ? "*N/A*" : online}\n` +
          `⚫ **Hors ligne :** ${offline === -1 ? "*N/A*" : offline}`,
        inline: true,
      },
      {
        name: "💬 Salons",
        value:
          `📁 **Total :** ${totalChannels}\n` +
          `💬 **Texte :** ${textChannels}\n` +
          `🔊 **Vocal :** ${voiceChannels}\n` +
          `📂 **Catégories :** ${categories}\n` +
          `📣 **Annonces :** ${announcements}` +
          (forums > 0 ? `\n🗨️ **Forums :** ${forums}` : "") +
          (stages > 0 ? `\n🎤 **Scènes :** ${stages}` : ""),
        inline: true,
      },
      {
        name: "🎭 Rôles & Emojis",
        value:
          `🎭 **Rôles :** ${roles}\n` +
          `😀 **Emojis :** ${emojis}\n` +
          `🎨 **Stickers :** ${stickers}`,
        inline: true,
      },
      {
        name: "✨ Boost",
        value:
          `🚀 **Niveau :** ${boostTier}\n` +
          `💎 **Boosts :** ${boosts}/14`,
        inline: true,
      },
      {
        name: "🛡️ Sécurité",
        value:
          `🔒 **Vérification :** ${VERIFICATION_FR[guild.verificationLevel]}\n` +
          `🔞 **Filtre contenu :** ${EXPLICIT_FR[guild.explicitContentFilter]}\n` +
          `🔑 **2FA modérateurs :** ${guild.mfaLevel === 1 ? "Requis" : "Non requis"}`,
        inline: true,
      },
      {
        name: "⚙️ Configuration bot",
        value:
          `📋 **Options activées :** ${configuredCount}/7\n` +
          `🚫 **Blacklist invites :** ${inviteBlacklist} membre(s)\n` +
          `🛡️ **Mode raid :** ${config.raidMode ? "🚨 Actif" : "✅ Inactif"}\n` +
          `🔒 **Join Lock :** ${config.joinLock ? "🔒 Actif" : "🔓 Inactif"}`,
        inline: true,
      },
      { name: "\u200B", value: "\u200B", inline: false },
      {
        name: "📅 Serveur",
        value:
          `👑 **Propriétaire :** ${owner ? `${owner.user.tag} (\`${owner.id}\`)` : "*Inconnu*"}\n` +
          `🗓️ **Créé le :** <t:${createdTs}:F> (<t:${createdTs}:R>)\n` +
          `📆 **Âge :** ${ageDays} jour(s)\n` +
          `🆔 **ID :** \`${guild.id}\``,
        inline: true,
      },
      {
        name: "🏆 Top inviteurs",
        value: topInviterText,
        inline: true,
      },
    )
    .setImage(guild.bannerURL({ size: 1024 }) ?? null)
    .setFooter({ text: `${guild.name} · ${new Date().toLocaleDateString("fr-FR")}`, iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("serverstats")
  .setDescription("Affiche les statistiques détaillées du serveur");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });
  await interaction.deferReply();
  const embed = await buildServerStatsEmbed(interaction.guild);
  return interaction.editReply({ embeds: [embed] });
}

export const prefixName = "serverstats";
export const prefixAliases = ["stats", "ss", "statistiques"];

export async function executeMessage(message: Message) {
  if (!message.guild) return;
  const embed = await buildServerStatsEmbed(message.guild);
  await message.reply({ embeds: [embed] });
}
