import { Client, User, EmbedBuilder, Guild } from "discord.js";
import { logger } from "../lib/logger.js";
import { getConfig } from "./guild-config-store.js";

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
