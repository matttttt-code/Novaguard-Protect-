import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  Message,
  User,
  UserFlags,
  type Client,
} from "discord.js";
import { getBlacklistedServers, getBlacklistedServerIds } from "../server-blacklist-store.js";
import { getAllBlServerIds } from "../guild-config-store.js";
import { getSuspectsByUserId } from "../suspect-accounts-db.js";

// ── Helpers âge / risque ──────────────────────────────────────────────────────

function accountAgeDays(user: User): number {
  return Math.floor((Date.now() - user.createdTimestamp) / 86_400_000);
}

function ageLabel(days: number): string {
  if (days < 1)   return "< 1 jour";
  if (days < 30)  return `${days} jour(s)`;
  if (days < 365) return `${Math.floor(days / 30)} mois`;
  return `${Math.floor(days / 365)} an(s) ${Math.floor((days % 365) / 30)}m`;
}

function ageRisk(days: number): { emoji: string; label: string; score: number } {
  if (days < 7)   return { emoji: "🔴", label: "CRITIQUE (< 7j)",   score: 40 };
  if (days < 30)  return { emoji: "🟠", label: "ÉLEVÉ (< 30j)",     score: 25 };
  if (days < 90)  return { emoji: "🟡", label: "MODÉRÉ (< 3 mois)", score: 10 };
  if (days < 365) return { emoji: "🟢", label: "FAIBLE (< 1 an)",   score: 3  };
  return           { emoji: "✅", label: "OK (> 1 an)",              score: 0  };
}

function badgeInfo(user: User): { trust: string[]; neutral: string[] } {
  const f = user.flags;
  const trust: string[] = [];
  const neutral: string[] = [];
  if (!f) return { trust, neutral };
  if (f.has(UserFlags.Staff))                 trust.push("👑 Discord Staff");
  if (f.has(UserFlags.Partner))               trust.push("🤝 Partner");
  if (f.has(UserFlags.BugHunterLevel1))       trust.push("🐛 Bug Hunter");
  if (f.has(UserFlags.BugHunterLevel2))       trust.push("🏆 Bug Hunter Gold");
  if (f.has(UserFlags.PremiumEarlySupporter)) trust.push("💎 Early Supporter");
  if (f.has(UserFlags.VerifiedDeveloper))     trust.push("🔧 Verified Dev");
  if (f.has(UserFlags.CertifiedModerator))    trust.push("🛡️ Certified Mod");
  if (f.has(UserFlags.ActiveDeveloper))       trust.push("⚙️ Active Dev");
  if (f.has(UserFlags.HypeSquadOnlineHouse1)) neutral.push("🏠 HypeSquad Bravery");
  if (f.has(UserFlags.HypeSquadOnlineHouse2)) neutral.push("🏠 HypeSquad Brilliance");
  if (f.has(UserFlags.HypeSquadOnlineHouse3)) neutral.push("🏠 HypeSquad Balance");
  if (f.has(UserFlags.Hypesquad))             neutral.push("🎪 HypeSquad Events");
  return { trust, neutral };
}

// ── Vérification blacklist (les deux stores) ──────────────────────────────────

async function checkBlacklists(user: User, client: Client) {
  // Store global (server-blacklist.json)
  const globalIds = getBlacklistedServerIds();
  const globalServers = getBlacklistedServers();
  // Store par-guilde (guild-configs.json → blServers)
  const guildIds = getAllBlServerIds();
  // Union des deux
  const allIds = new Set([...globalIds, ...guildIds]);

  const found: { guildId: string; label: string }[] = [];
  for (const id of allIds) {
    const guild = client.guilds.cache.get(id);
    if (!guild) continue;
    try {
      await guild.members.fetch(user.id);
      const entry = globalServers.find((s) => s.guildId === id);
      found.push({ guildId: id, label: entry?.label ?? id });
    } catch { /* pas membre */ }
  }
  return { found, checked: allIds.size };
}

// ── Embed principal ───────────────────────────────────────────────────────────

async function buildFullEmbed(
  targetUser: User,
  member: GuildMember | null,
  client: Client,
): Promise<EmbedBuilder> {
  const ageDays = accountAgeDays(targetUser);
  const age     = ageRisk(ageDays);
  const badges  = badgeInfo(targetUser);
  const hasAvatar = !!targetUser.avatar;

  const [suspectHistory, blacklist] = await Promise.all([
    getSuspectsByUserId(targetUser.id).catch(() => [] as Awaited<ReturnType<typeof getSuspectsByUserId>>),
    checkBlacklists(targetUser, client),
  ]);

  // ── Score risque ────────────────────────────────────────────────────────────
  let risk = age.score;
  if (!hasAvatar)                                         risk += 10;
  if (badges.trust.length === 0)                          risk += 5;
  const vpnFlagged = suspectHistory.some((s) => s.vpnSuspicion);
  if (vpnFlagged)                                         risk += 20;
  risk += Math.min(suspectHistory.length * 8, 40);
  risk += blacklist.found.length * 15;
  const guildsSeenIn = [...new Set(suspectHistory.map((s) => s.guildId))];
  if (guildsSeenIn.length > 1)                            risk += 15;

  let embedColor: number;
  let riskLevel: string;
  if (risk >= 60)      { embedColor = 0xef4444; riskLevel = "🔴 DANGER ÉLEVÉ"; }
  else if (risk >= 35) { embedColor = 0xf97316; riskLevel = "🟠 SUSPECT"; }
  else if (risk >= 15) { embedColor = 0xf59e0b; riskLevel = "🟡 MODÉRÉ"; }
  else                 { embedColor = member ? (member.displayColor || 0x6366f1) : 0x6366f1; riskLevel = "✅ FAIBLE"; }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`👤 ${targetUser.tag}`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  // ── Infos de base ───────────────────────────────────────────────────────────
  const baseLines = [
    `**ID :** \`${targetUser.id}\``,
    `**Créé le :** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:D> (${ageLabel(ageDays)})`,
    `**Avatar :** ${hasAvatar ? "✅ Personnalisé" : "⚠️ Défaut"}`,
  ];
  if (member) {
    if (member.nickname) baseLines.push(`**Surnom :** ${member.nickname}`);
    if (member.joinedTimestamp) baseLines.push(`**A rejoint :** <t:${Math.floor(member.joinedTimestamp / 1000)}:D>`);
    if (member.user.bot) baseLines.push("🤖 **Bot**");
    if (member.permissions.has("Administrator")) baseLines.push("🛡️ **Administrateur**");
  }
  embed.addFields({ name: "👤 Compte", value: baseLines.join("\n") });

  // ── Rôles (si membre) ───────────────────────────────────────────────────────
  if (member) {
    const roles = member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => r.toString())
      .slice(0, 10);
    if (roles.length > 0)
      embed.addFields({ name: `🏷️ Rôles (${roles.length})`, value: roles.join(", ") });
  }

  // ── Âge · Badges · Risque (inline) ─────────────────────────────────────────
  embed.addFields(
    { name: "📅 Âge", value: `${age.emoji} **${age.label}**`, inline: true },
    {
      name: "🏅 Badges",
      value: [...badges.trust, ...badges.neutral].join("\n") || "*(aucun)*",
      inline: true,
    },
    { name: "⚠️ Risque", value: `${riskLevel}\n*Score : ${risk}/100*`, inline: true },
  );

  // ── VPN / proxy ─────────────────────────────────────────────────────────────
  if (vpnFlagged || ageDays < 30) {
    const vpnLines: string[] = [];
    if (vpnFlagged) vpnLines.push("🔴 **Déjà signalé** suspect VPN/proxy par le bot");
    else if (ageDays < 7)  vpnLines.push("🟠 Compte très récent — risque VPN/proxy élevé");
    else if (ageDays < 30) vpnLines.push("🟡 Compte récent — possible VPN/proxy");
    if (!hasAvatar) vpnLines.push("⚠️ Pas d'avatar — signal supplémentaire");
    embed.addFields({ name: "🌐 VPN / Proxy", value: vpnLines.join("\n") });
  }

  // ── Historique suspect ──────────────────────────────────────────────────────
  const sc = suspectHistory.length;
  if (sc > 0) {
    const lines = suspectHistory.slice(0, 5).map((s) => {
      const date = s.detectedAt ? `<t:${Math.floor(new Date(s.detectedAt).getTime() / 1000)}:d>` : "?";
      const vpn  = s.vpnSuspicion ? " 🌐VPN" : "";
      return `• ${date} — **${s.guildName}** — *${s.reasons.slice(0, 2).join(", ")}*${vpn} → **${s.actionTaken}**`;
    });
    if (sc > 5) lines.push(`*…et ${sc - 5} autre(s)*`);
    embed.addFields({ name: `🚨 Historique suspect (${sc})`, value: lines.join("\n") });
  }

  // ── Multi-serveurs ──────────────────────────────────────────────────────────
  if (guildsSeenIn.length > 1)
    embed.addFields({
      name: "👥 Multi-serveurs",
      value: `Signalé sur **${guildsSeenIn.length}** serveurs du bot → probable raider / multi-compte.`,
    });

  // ── Serveurs blacklistés ────────────────────────────────────────────────────
  if (blacklist.checked > 0) {
    if (blacklist.found.length === 0) {
      embed.addFields({ name: "🖤 Blacklist serveurs", value: `✅ Absent des **${blacklist.checked}** serveurs blacklistés` });
    } else {
      embed.addFields({
        name: `🖤 Blacklist serveurs (${blacklist.found.length} détecté${blacklist.found.length > 1 ? "s" : ""})`,
        value: blacklist.found.map((g) => `🔴 **${g.label}** — \`${g.guildId}\``).join("\n"),
      });
    }
  }

  return embed;
}

// ── Slash command ─────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Informations complètes sur un membre (profil, âge, risque, blacklist…)")
  .addUserOption((o) => o.setName("membre").setDescription("Le membre à inspecter"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const user   = interaction.options.getUser("membre") ?? interaction.user;
  const embed  = await buildFullEmbed(user, member, interaction.client);
  await interaction.editReply({ embeds: [embed] });
}

// ── Préfixe : &userinfo / &ui / &user / &verif / &verifserv ──────────────────

export const prefixName = "userinfo";
export const prefixAliases = ["ui", "user", "verif", "vérifserv", "verifserv"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;

  let targetUser: User;
  let member: GuildMember | null = null;

  const rawId = args[0]?.replace(/[<@!>]/g, "");

  if (rawId) {
    try {
      targetUser = await message.client.users.fetch(rawId, { force: true });
    } catch {
      await message.reply("❌ Utilisateur introuvable.");
      return;
    }
    try { member = await message.guild.members.fetch(rawId); } catch { /* pas dans ce serveur */ }
  } else {
    member = message.member as GuildMember;
    targetUser = member.user;
  }

  const msg = await message.reply("🔍 Analyse en cours…");
  const embed = await buildFullEmbed(targetUser, member, message.client);
  await msg.edit({ content: "", embeds: [embed] });
}
