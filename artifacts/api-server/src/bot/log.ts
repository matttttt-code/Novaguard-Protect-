import { EmbedBuilder, TextChannel, Client } from "discord.js";
import { logger } from "../lib/logger.js";

export const LOG_CHANNEL_ID = "1505255721988657322";

export async function sendLog(
  client: Client,
  embed: EmbedBuilder
): Promise<void> {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send({ embeds: [embed] });
    }
  } catch (err) {
    logger.error({ err }, "Impossible d'envoyer le log de modération");
  }
}

export function logEmbed(
  color: number,
  title: string,
  fields: { name: string; value: string; inline?: boolean }[],
  moderator: { tag: string; id: string }
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      ...fields,
      { name: "Modérateur", value: `${moderator.tag} (\`${moderator.id}\`)` }
    )
    .setTimestamp();
}
