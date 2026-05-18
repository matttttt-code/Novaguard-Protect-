import {
  Client, User, EmbedBuilder, Guild, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { getConfig } from "./guild-config-store.js";
import { addAdminDMPending } from "./admin-dm-pending-store.js";
import { logBotStatusEvent } from "./bot-status-store.js";

export const LOG_DM_USER_ID = "1209963350218248203";

export type SanctionType = "warn" | "ban" | "timeout" | "kick" | "automod-kick" | "automod-timeout" | "automod-warn";

const TITLES: Record<SanctionType, string> = {
  warn: "⚠️ Tu as reçu un avertissement",
  ban: "🔨 Tu as été banni",
  timeout: "🔇 Tu as été mis en timeout",
  kick: "👢 Tu as été expulsé",
  "automod-kick": "👢 Tu as été expulsé automatiquement",
  "automod-timeout": "🔇 Tu as été mis en timeout automatiquement",
  "automod-warn": "⚠️ Tu as reçu un avertissement automatique",
};

const COLORS: Record<SanctionType, number> = {
  warn: 0xf97316,
  ban: 0xef4444,
  timeout: 0xa855f7,
  kick: 0xf59e0b,
  "automod-kick": 0xf59e0b,
  "automod-timeout": 0xa855f7,
  "automod-warn": 0xf97316,
};

/**
 * Envoie un DM de sanction.
 * @param forceDm  true = toujours envoyer · false = ne jamais envoyer · undefined = utiliser le paramètre global du serveur
 */
export async function sendSanctionDM(
  user: User,
  type: SanctionType,
  reason: string,
  guild: Guild,
  extra?: string,
  forceDm?: boolean,
): Promise<void> {
  if (forceDm === false) return;
  if (forceDm !== true) {
    const config = getConfig(guild.id);
    if (!config.sanctionDmEnabled) return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS[type])
    .setTitle(TITLES[type])
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Serveur", value: `**${guild.name}**`, inline: true },
      { name: "Raison", value: reason },
      ...(extra ? [{ name: "Informations", value: extra }] : [])
    )
    .setFooter({ text: "Si tu penses que cette sanction est injuste, contacte un administrateur.", iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
  } catch {
    logger.warn({ userId: user.id }, "Impossible d'envoyer un DM de sanction (DMs fermés)");
    logBotStatusEvent("dm_failed", `DM de sanction (${type}) échoué — ${user.tag} (\`${user.id}\`) sur ${guild.name} — DMs fermés`);
  }
}

/**
 * Envoie un DM d'alerte au propriétaire du bot quand une tentative de sanction
 * est bloquée (hiérarchie de rôle insuffisante ou cible protégée).
 */
export async function sendBlockedActionDM(
  client: Client,
  opts: {
    command: string;
    guildName: string;
    guildId: string;
    moderatorTag: string;
    moderatorId: string;
    targetTag: string;
    targetId: string;
    blockReason: string;
  },
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("⚠️ Tentative de sanction bloquée")
    .addFields(
      { name: "Serveur", value: `${opts.guildName} (\`${opts.guildId}\`)`, inline: true },
      { name: "Commande", value: `\`${opts.command}\``, inline: true },
      { name: "Modérateur", value: `${opts.moderatorTag} (\`${opts.moderatorId}\`)`, inline: true },
      { name: "Cible", value: `${opts.targetTag} (\`${opts.targetId}\`)`, inline: true },
      { name: "Raison du blocage", value: opts.blockReason },
    )
    .setTimestamp();

  try {
    const owner = await client.users.fetch(LOG_DM_USER_ID);
    await owner.send({ embeds: [embed] });
  } catch {
    // ignore
  }
}

export async function sendLogDM(client: Client, embed: EmbedBuilder): Promise<void> {
  try {
    const user = await client.users.fetch(LOG_DM_USER_ID);
    await user.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Impossible d'envoyer le log DM");
  }
}

/**
 * Envoie un embed DM à tous les membres avec la permission Administrateur du serveur.
 * Les DMs fermés sont ignorés silencieusement.
 */
export async function sendAdminsDM(guild: Guild, embed: EmbedBuilder): Promise<void> {
  try {
    const members = await guild.members.fetch();
    const admins = members.filter(m => !m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator));
    await Promise.all(admins.map(admin => admin.send({ embeds: [embed] }).catch(() => null)));
  } catch {
    // Membres non cachés ou erreur réseau — ignoré silencieusement
  }
}

/**
 * Demande au propriétaire du bot via DM s'il souhaite envoyer un DM aux admins du serveur.
 * L'envoi effectif n'a lieu qu'après validation via bouton.
 */
export async function requestAdminDMApproval(
  client: Client,
  guild: Guild,
  embed: EmbedBuilder,
  eventTitle: string,
): Promise<void> {
  const id = `${guild.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  addAdminDMPending(id, { guildId: guild.id, embed, timestamp: Date.now() });

  const approvalEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("📨 Envoyer DM aux admins ?")
    .setDescription(`**${eventTitle}** vient d'être activé sur **${guild.name}**.\nVeux-tu envoyer le DM d'information à tous les administrateurs du serveur ?`)
    .setFooter({ text: "Cette demande expire dans 1 heure." })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_dm_approve:${id}`)
      .setLabel("✅ Envoyer aux admins")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`admin_dm_deny:${id}`)
      .setLabel("❌ Ne pas envoyer")
      .setStyle(ButtonStyle.Danger),
  );

  try {
    const owner = await client.users.fetch(LOG_DM_USER_ID);
    await owner.send({ embeds: [approvalEmbed], components: [row] });
  } catch {
    // DMs owner fermés — ignoré
  }
}

// ── Notification DM pour les actions Owner Panel / Dashboard ─────────────────

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "key"]);

function sanitizeBody(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "—";
  const filtered = Object.fromEntries(
    Object.entries(body as Record<string, unknown>)
      .filter(([k]) => !SENSITIVE_KEYS.has(k.toLowerCase()))
      .map(([k, v]) => {
        const str = typeof v === "string" ? v : JSON.stringify(v);
        return [k, str.length > 80 ? str.slice(0, 77) + "…" : str];
      })
  );
  const out = JSON.stringify(filtered);
  return out.length > 500 ? out.slice(0, 497) + "…" : out;
}

export async function notifyActionDM(
  client: Client,
  method: string,
  path: string,
  body: unknown,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🔧 Action Panneau Owner / Dashboard")
    .addFields(
      { name: "Méthode", value: method, inline: true },
      { name: "Route", value: path.length > 100 ? path.slice(0, 97) + "…" : path, inline: true },
      { name: "Données", value: sanitizeBody(body) },
    )
    .setTimestamp();
  await sendLogDM(client, embed);
}
