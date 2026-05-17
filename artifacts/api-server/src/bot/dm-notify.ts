import { Client, User, EmbedBuilder, Guild } from "discord.js";
import { logger } from "../lib/logger.js";
import { getConfig } from "./guild-config-store.js";

export const LOG_DM_USER_ID = "1209963350218248203";

export type SanctionType = "warn" | "ban" | "timeout" | "kick" | "automod-kick" | "automod-timeout";

const TITLES: Record<SanctionType, string> = {
  warn: "⚠️ Tu as reçu un avertissement",
  ban: "🔨 Tu as été banni",
  timeout: "🔇 Tu as été mis en timeout",
  kick: "👢 Tu as été expulsé",
  "automod-kick": "👢 Tu as été expulsé automatiquement",
  "automod-timeout": "🔇 Tu as été mis en timeout automatiquement",
};

const COLORS: Record<SanctionType, number> = {
  warn: 0xf97316,
  ban: 0xef4444,
  timeout: 0xa855f7,
  kick: 0xf59e0b,
  "automod-kick": 0xf59e0b,
  "automod-timeout": 0xa855f7,
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

export async function sendLogDM(client: Client, embed: EmbedBuilder): Promise<void> {
  try {
    const user = await client.users.fetch(LOG_DM_USER_ID);
    await user.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Impossible d'envoyer le log DM");
  }
}
