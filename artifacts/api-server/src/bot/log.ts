import { EmbedBuilder, TextChannel, Client } from "discord.js";
import { logger } from "../lib/logger.js";
import { sendLogDM } from "./dm-notify.js";

export const LOG_CHANNEL_ID = "1505255721988657322";

export interface SendLogOptions {
  pingEveryone?: boolean;
}

export async function sendLog(
  client: Client,
  embed: EmbedBuilder,
  options?: SendLogOptions
): Promise<void> {
  await Promise.allSettled([
    (async () => {
      try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
          await (channel as TextChannel).send({
            content: options?.pingEveryone ? "@everyone" : undefined,
            embeds: [embed],
          });
        }
      } catch (err) {
        logger.error({ err }, "Impossible d'envoyer le log dans le salon");
      }
    })(),
    sendLogDM(client, embed),
  ]);
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
