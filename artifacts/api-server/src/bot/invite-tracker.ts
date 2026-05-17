import {
  Client,
  Events,
  GuildMember,
  EmbedBuilder,
  TextChannel,
  type PartialGuildMember,
  Collection,
  Invite,
} from "discord.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getConfig } from "./guild-config-store.js";
import { sendLogDM } from "./dm-notify.js";
import { logger } from "../lib/logger.js";

// ──── Types ────
interface CachedInvite {
  uses: number;
  inviterId: string | null;
  maxUses: number | null;
}

export interface InviteStats {
  invited: number;
  left: number;
}

interface MemberInviterEntry {
  inviterId: string;
  code: string;
}

// ──── In-memory state ────
const inviteCache = new Map<string, Map<string, CachedInvite>>();
const inviteStats = new Map<string, Map<string, InviteStats>>();
const memberInviter = new Map<string, Map<string, MemberInviterEntry>>();

// ──── Persistence ────
const DATA_DIR = join(process.cwd(), "data");
const STATS_FILE = join(DATA_DIR, "invite-stats.json");
const MAPPING_FILE = join(DATA_DIR, "invite-mapping.json");

function saveToDisk(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    const statsObj: Record<string, Record<string, InviteStats>> = {};
    inviteStats.forEach((gMap, gId) => {
      statsObj[gId] = {};
      gMap.forEach((s, uid) => { statsObj[gId]![uid] = s; });
    });
    writeFileSync(STATS_FILE, JSON.stringify(statsObj, null, 2), "utf8");

    const mappingObj: Record<string, Record<string, MemberInviterEntry>> = {};
    memberInviter.forEach((gMap, gId) => {
      mappingObj[gId] = {};
      gMap.forEach((e, mid) => { mappingObj[gId]![mid] = e; });
    });
    writeFileSync(MAPPING_FILE, JSON.stringify(mappingObj, null, 2), "utf8");
  } catch (err) {
    logger.error({ err }, "[invite-tracker] Impossible de sauvegarder");
  }
}

function loadFromDisk(): void {
  try {
    if (existsSync(STATS_FILE)) {
      const raw = JSON.parse(readFileSync(STATS_FILE, "utf8")) as Record<string, Record<string, InviteStats>>;
      for (const [gId, gMap] of Object.entries(raw)) {
        const m = new Map<string, InviteStats>();
        for (const [uid, s] of Object.entries(gMap)) m.set(uid, s);
        inviteStats.set(gId, m);
      }
    }
    if (existsSync(MAPPING_FILE)) {
      const raw = JSON.parse(readFileSync(MAPPING_FILE, "utf8")) as Record<string, Record<string, MemberInviterEntry>>;
      for (const [gId, gMap] of Object.entries(raw)) {
        const m = new Map<string, MemberInviterEntry>();
        for (const [mid, e] of Object.entries(gMap)) m.set(mid, e);
        memberInviter.set(gId, m);
      }
    }
  } catch (err) {
    logger.error({ err }, "[invite-tracker] Impossible de charger");
  }
}

loadFromDisk();

// ──── Cache helpers ────
async function cacheGuildInvites(guild: { id: string; invites: { fetch: () => Promise<Collection<string, Invite>> } }): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    const cache = new Map<string, CachedInvite>();
    for (const [code, inv] of invites) {
      cache.set(code, {
        uses: inv.uses ?? 0,
        inviterId: inv.inviter?.id ?? null,
        maxUses: inv.maxUses ?? null,
      });
    }
    inviteCache.set(guild.id, cache);
  } catch {
    // pas la permission ManageGuild — on ignore silencieusement
  }
}

// ──── Initialisation (à appeler sur ClientReady) ────
export async function initInviteTracker(client: Client): Promise<void> {
  await Promise.allSettled(client.guilds.cache.map((g) => cacheGuildInvites(g)));

  client.on(Events.GuildCreate, async (guild) => {
    await cacheGuildInvites(guild);
  });

  client.on(Events.InviteCreate, (invite) => {
    if (!invite.guild) return;
    const cache = inviteCache.get(invite.guild.id) ?? new Map();
    cache.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviter?.id ?? null,
      maxUses: invite.maxUses ?? null,
    });
    inviteCache.set(invite.guild.id, cache);
  });

  client.on(Events.InviteDelete, (invite) => {
    if (!invite.guild) return;
    inviteCache.get(invite.guild.id)?.delete(invite.code);
  });

  logger.info("Invite tracker initialisé");
}

// ──── Quand un membre rejoint ────
export async function onMemberJoin(client: Client, member: GuildMember): Promise<void> {
  const guildId = member.guild.id;
  const cache = inviteCache.get(guildId) ?? new Map<string, CachedInvite>();

  // Tenter de fetch les invitations — continuer même en cas d'échec (permission manquante)
  let currentInvites: Collection<string, Invite> = new Collection();
  try {
    currentInvites = await member.guild.invites.fetch();
  } catch {
    // Pas la permission MANAGE_GUILD : on loguera quand même sans info d'invite
  }

  // Trouver l'invitation utilisée
  let usedCode: string | null = null;
  let inviterId: string | null = null;

  for (const [code, invite] of currentInvites) {
    const cached = cache.get(code);
    if (cached && (invite.uses ?? 0) > cached.uses) {
      usedCode = code;
      inviterId = invite.inviter?.id ?? cached.inviterId;
      break;
    }
  }

  // Cas : invitation à usage unique supprimée après utilisation
  if (!usedCode) {
    for (const [code, cached] of cache) {
      if (!currentInvites.has(code) && cached.maxUses === 1) {
        usedCode = code;
        inviterId = cached.inviterId;
        break;
      }
    }
  }

  // Mettre à jour le cache
  const newCache = new Map<string, CachedInvite>();
  for (const [code, inv] of currentInvites) {
    newCache.set(code, {
      uses: inv.uses ?? 0,
      inviterId: inv.inviter?.id ?? null,
      maxUses: inv.maxUses ?? null,
    });
  }
  inviteCache.set(guildId, newCache);

  // Mettre à jour les stats
  if (inviterId && usedCode) {
    const guildStatsMap = inviteStats.get(guildId) ?? new Map<string, InviteStats>();
    const prev = guildStatsMap.get(inviterId) ?? { invited: 0, left: 0 };
    guildStatsMap.set(inviterId, { invited: prev.invited + 1, left: prev.left });
    inviteStats.set(guildId, guildStatsMap);

    const guildMappingMap = memberInviter.get(guildId) ?? new Map<string, MemberInviterEntry>();
    guildMappingMap.set(member.id, { inviterId, code: usedCode });
    memberInviter.set(guildId, guildMappingMap);
    saveToDisk();
  }

  // Construire l'embed (toujours, même sans info d'invite)
  const inviterUser = inviterId ? await client.users.fetch(inviterId).catch(() => null) : null;
  const iStats = inviterId ? (inviteStats.get(guildId)?.get(inviterId) ?? { invited: 1, left: 0 }) : null;
  const active = iStats ? iStats.invited - iStats.left : 0;

  const accountAgeMs = Date.now() - member.user.createdTimestamp;
  const accountAgeDays = Math.floor(accountAgeMs / 86_400_000);
  const accountAgeHours = Math.floor(accountAgeMs / 3_600_000);
  const ageStr = accountAgeDays < 1 ? `${accountAgeHours}h` : `${accountAgeDays}j`;

  const embed = new EmbedBuilder()
    .setColor(inviterId ? 0x22c55e : 0x6b7280)
    .setTitle("📨 Nouveau membre — Arrivée")
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Âge du compte", value: ageStr, inline: true },
      { name: "Arrivée", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      {
        name: "Invité par",
        value: inviterUser
          ? `${inviterUser.tag} (\`${inviterId}\`)`
          : inviterId
            ? `\`${inviterId}\``
            : currentInvites.size === 0
              ? "Indéterminable (permission manquante)"
              : "Inconnu (vanity URL / OAuth / bot)",
        inline: true,
      },
      ...(usedCode ? [{ name: "Code utilisé", value: `\`${usedCode}\``, inline: true }] : []),
      { name: "Membres", value: `**${member.guild.memberCount}**`, inline: true },
      ...(iStats ? [{
        name: "Stats inviteur",
        value: `✅ **${iStats.invited}** invités · ❌ **${iStats.left}** partis · 🟢 **${Math.max(0, active)}** actifs`,
        inline: false,
      }] : []),
    )
    .setFooter({ text: `${member.guild.name} · ID membre : ${member.id}${inviterId ? ` · ID inviteur : ${inviterId}` : ""}` })
    .setTimestamp();

  // Envoyer dans le salon configuré
  const cfg = getConfig(guildId);
  if (cfg.inviteLogChannelId) {
    try {
      const ch = await client.channels.fetch(cfg.inviteLogChannelId);
      if (ch?.isTextBased()) await (ch as TextChannel).send({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "[invite-tracker] Erreur envoi salon invite log");
    }
  }

  // Envoyer en DM au propriétaire du bot
  await sendLogDM(client, EmbedBuilder.from(embed.toJSON())
    .setTitle(`📨 [${member.guild.name}] Nouveau membre`)
  ).catch(() => null);
}

// ──── Quand un membre quitte ────
export function onMemberLeave(member: GuildMember | PartialGuildMember): void {
  const guildId = member.guild.id;
  const mapping = memberInviter.get(guildId)?.get(member.id);
  if (!mapping) return;

  const guildStatsMap = inviteStats.get(guildId);
  if (!guildStatsMap) return;
  const prev = guildStatsMap.get(mapping.inviterId);
  if (!prev) return;

  guildStatsMap.set(mapping.inviterId, { invited: prev.invited, left: prev.left + 1 });
  saveToDisk();
}

// ──── Getters publics ────
export function getInviteStats(guildId: string, userId: string): InviteStats {
  return inviteStats.get(guildId)?.get(userId) ?? { invited: 0, left: 0 };
}

export function getAllInviteStats(guildId: string): Array<{ userId: string; stats: InviteStats }> {
  const gMap = inviteStats.get(guildId);
  if (!gMap) return [];
  return [...gMap.entries()]
    .map(([userId, stats]) => ({ userId, stats }))
    .sort((a, b) => (b.stats.invited - b.stats.left) - (a.stats.invited - a.stats.left));
}

export function getMemberInviter(guildId: string, memberId: string): MemberInviterEntry | null {
  return memberInviter.get(guildId)?.get(memberId) ?? null;
}
