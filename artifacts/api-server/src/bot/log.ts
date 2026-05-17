import { EmbedBuilder, TextChannel, Client } from "discord.js";
import { logger } from "../lib/logger.js";
import { sendLogDM } from "./dm-notify.js";
import { getConfig } from "./guild-config-store.js";

export interface SendLogOptions {
  pingEveryone?: boolean;
  guildId?: string;
  logType?: "general" | "ban";
}

async function sendToChannel(
  client: Client,
  channelId: string,
  embed: EmbedBuilder,
  pingEveryone?: boolean
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send({
        content: pingEveryone ? "@everyone" : undefined,
        embeds: [embed],
      });
    }
  } catch (err) {
    logger.error({ err, channelId }, "Impossible d'envoyer le log dans le salon");
  }
}

export async function sendLog(
  client: Client,
  embed: EmbedBuilder,
  options?: SendLogOptions
): Promise<void> {
  const targets: string[] = [];

  if (options?.guildId) {
    const config = getConfig(options.guildId);

    if (options.logType === "ban" && config.banLogChannelId) {
      targets.push(config.banLogChannelId);
    }

    if (config.logChannelId && !targets.includes(config.logChannelId)) {
      targets.push(config.logChannelId);
    }
  }

  await Promise.allSettled([
    ...targets.map((id) => sendToChannel(client, id, embed, options?.pingEveryone)),
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
