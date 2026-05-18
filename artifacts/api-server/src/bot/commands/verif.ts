import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  User,
  UserFlags,
} from "discord.js";
import { getBlacklistedServers, getBlacklistedServerIds } from "../server-blacklist-store.js";
import { getSuspectsByUserId } from "../suspect-accounts-db.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function accountAgeDays(user: User): number {
  return Math.floor((Date.now() - user.createdTimestamp) / 86_400_000);
}

function ageLabel(days: number): string {
  if (days < 1) return `${Math.floor((Date.now() - 0) / 3_600_000)}h (< 1 jour)`;
  if (days < 30) return `${days} jour(s)`;
  if (days < 365) return `${Math.floor(days / 30)} mois`;
  return `${Math.floor(days / 365)} an(s) ${Math.floor((days % 365) / 30)}m`;
}

function ageRisk(days: number): { emoji: string; label: string; score: number } {
  if (days < 7)   return { emoji: "🔴", label: "CRITIQUE (< 7j)",  score: 40 };
  if (days < 30)  return { emoji: "🟠", label: "ÉLEVÉ (< 30j)",    score: 25 };
  if (days < 90)  return { emoji: "🟡", label: "MODÉRÉ (< 3 mois)", score: 10 };
  if (days < 365) return { emoji: "🟢", label: "FAIBLE (< 1 an)",  score: 3  };
  return           { emoji: "✅", label: "OK (> 1 an)",             score: 0  };
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

// ── Main logic ─────────────────────────────────────────────────────────────────

interface VerifResult {
  user: User;
  ageDays: number;
  hasAvatar: boolean;
  badges: { trust: string[]; neutral: string[] };
  suspectHistory: Awaited<ReturnType<typeof getSuspectsByUserId>>;
  blacklistedFound: { guildId: string; label: string }[];
  blacklistedChecked: number;
}

async function runVerif(targetUser: User, client: import("discord.js").Client): Promise<VerifResult> {
  const [suspectHistory, blacklistResult] = await Promise.all([
    getSuspectsByUserId(targetUser.id).catch(() => [] as Awaited<ReturnType<typeof getSuspectsByUserId>>),
    (async () => {
      const blacklistedIds = getBlacklistedServerIds();
      const allServers = getBlacklistedServers();
      const found: { guildId: string; label: string }[] = [];
      for (const id of blacklistedIds) {
        const guild = client.guilds.cache.get(id);
        if (!guild) continue;
        try {
          await guild.members.fetch(targetUser.id);
          const entry = allServers.find((s) => s.guildId === id);
          found.push({ guildId: id, label: entry?.label ?? id });
        } catch { /* not present */ }
      }
      return { found, checked: allServers.length };
    })(),
  ]);

  return {
    user: targetUser,
    ageDays: accountAgeDays(targetUser),
    hasAvatar: !!targetUser.avatar,
    badges: badgeInfo(targetUser),
    suspectHistory,
    blacklistedFound: blacklistResult.found,
    blacklistedChecked: blacklistResult.checked,
  };
}

function buildVerifEmbed(r: VerifResult): EmbedBuilder {
  const age = ageRisk(r.ageDays);

  // ── Score de risque ──────────────────────────────────────────────────────────
  let riskScore = age.score;
  if (!r.hasAvatar)                                        riskScore += 10;
  if (r.badges.trust.length === 0)                         riskScore += 5;
  const vpnFlagged = r.suspectHistory.some((s) => s.vpnSuspicion);
  if (vpnFlagged)                                          riskScore += 20;
  const suspectCount = r.suspectHistory.length;
  riskScore += Math.min(suspectCount * 8, 40);
  if (r.blacklistedFound.length > 0)                       riskScore += r.blacklistedFound.length * 15;

  // ── Multi-serveurs ───────────────────────────────────────────────────────────
  const guildsSeenIn = [...new Set(r.suspectHistory.map((s) => s.guildId))];
  const isMultiServer = guildsSeenIn.length > 1;
  if (isMultiServer)                                       riskScore += 15;

  // ── Couleur & niveau ─────────────────────────────────────────────────────────
  let embedColor: number;
  let riskLevel: string;
  if (riskScore >= 60)      { embedColor = 0xef4444; riskLevel = "🔴 DANGER ÉLEVÉ"; }
  else if (riskScore >= 35) { embedColor = 0xf97316; riskLevel = "🟠 SUSPECT"; }
  else if (riskScore >= 15) { embedColor = 0xf59e0b; riskLevel = "🟡 MODÉRÉ"; }
  else                      { embedColor = 0x22c55e; riskLevel = "✅ FAIBLE"; }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🔍 Vérification — ${r.user.tag}`)
    .setThumbnail(r.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  // ── Infos compte ─────────────────────────────────────────────────────────────
  embed.addFields({
    name: "👤 Compte Discord",
    value: [
      `**ID :** \`${r.user.id}\``,
      `**Tag :** ${r.user.tag}`,
      `**Créé le :** <t:${Math.floor(r.user.createdTimestamp / 1000)}:D> (${ageLabel(r.ageDays)})`,
      `**Avatar :** ${r.hasAvatar ? "✅ Personnalisé" : "⚠️ Défaut (aucun avatar)"}`,
    ].join("\n"),
  });

  // ── Âge du compte ────────────────────────────────────────────────────────────
  embed.addFields({
    name: "📅 Âge du compte",
    value: `${age.emoji} **${age.label}**`,
    inline: true,
  });

  // ── Badges Discord ───────────────────────────────────────────────────────────
  const badgeLines: string[] = [
    ...r.badges.trust,
    ...r.badges.neutral,
  ];
  embed.addFields({
    name: "🏅 Badges Discord",
    value: badgeLines.length > 0 ? badgeLines.join("\n") : "*(aucun badge)*",
    inline: true,
  });

  // ── Score de risque ──────────────────────────────────────────────────────────
  embed.addFields({
    name: "⚠️ Niveau de risque",
    value: `${riskLevel}\n*Score : ${riskScore}/100*`,
    inline: true,
  });

  // ── Suspicion VPN/proxy ──────────────────────────────────────────────────────
  if (vpnFlagged || r.ageDays < 30) {
    const vpnLines: string[] = [];
    if (vpnFlagged) vpnLines.push("🔴 **Déjà signalé** comme suspect VPN/proxy par le bot");
    else if (r.ageDays < 7)  vpnLines.push("🟠 Compte très récent — risque VPN/proxy élevé");
    else if (r.ageDays < 30) vpnLines.push("🟡 Compte récent — possible VPN/proxy");
    if (!r.hasAvatar) vpnLines.push("⚠️ Pas d'avatar — signal supplémentaire");

    embed.addFields({
      name: "🌐 Suspicion VPN / Proxy",
      value: vpnLines.join("\n"),
    });
  }

  // ── Historique suspect ───────────────────────────────────────────────────────
  if (suspectCount > 0) {
    const histLines = r.suspectHistory.slice(0, 5).map((s) => {
      const date = s.detectedAt ? `<t:${Math.floor(new Date(s.detectedAt).getTime() / 1000)}:d>` : "?";
      const vpn = s.vpnSuspicion ? " 🌐VPN" : "";
      return `• ${date} — **${s.guildName}** — *${s.reasons.slice(0, 2).join(", ")}*${vpn} → **${s.actionTaken}**`;
    });
    if (suspectCount > 5) histLines.push(`*…et ${suspectCount - 5} autre(s)*`);

    embed.addFields({
      name: `🚨 Historique suspect (${suspectCount} entrée${suspectCount > 1 ? "s" : ""})`,
      value: histLines.join("\n"),
    });
  }

  // ── Multi-comptes / multi-serveurs ───────────────────────────────────────────
  if (isMultiServer) {
    embed.addFields({
      name: "👥 Multi-serveurs détecté",
      value: `Compte signalé sur **${guildsSeenIn.length}** serveurs différents du bot → probable raider ou multi-compte.`,
    });
  }

  // ── Serveurs blacklistés ─────────────────────────────────────────────────────
  if (r.blacklistedChecked > 0) {
    if (r.blacklistedFound.length === 0) {
      embed.addFields({
        name: "🖤 Serveurs blacklistés",
        value: `✅ Absent des **${r.blacklistedChecked}** serveurs blacklistés vérifiés`,
      });
    } else {
      embed.addFields({
        name: `🖤 Serveurs blacklistés (${r.blacklistedFound.length} trouvé${r.blacklistedFound.length > 1 ? "s" : ""})`,
        value: r.blacklistedFound.map((g) => `🔴 **${g.label}** — \`${g.guildId}\``).join("\n"),
      });
    }
  }

  return embed;
}

// ── Commande Slash ─────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("verif")
  .setDescription("Vérification complète d'un compte (âge, VPN, historique, blacklist…)")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à vérifier").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser("membre", true);
  const result = await runVerif(targetUser, interaction.client);
  await interaction.editReply({ embeds: [buildVerifEmbed(result)] });
}

// ── Commande préfixe ──────────────────────────────────────────────────────────

export const prefixName = "verif";
export const prefixAliases = ["vérifserv", "verifserv"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;

  const userId = args[0]?.replace(/[<@!>]/g, "");
  if (!userId) {
    await message.reply("❌ Utilisation : `&verif @membre` ou `&verif <id>`");
    return;
  }

  let targetUser: User;
  try {
    targetUser = await message.client.users.fetch(userId, { force: true });
  } catch {
    await message.reply("❌ Utilisateur introuvable.");
    return;
  }

  const msg = await message.reply("🔍 Vérification complète en cours…");
  const result = await runVerif(targetUser, message.client);
  await msg.edit({ content: "", embeds: [buildVerifEmbed(result)] });
}
