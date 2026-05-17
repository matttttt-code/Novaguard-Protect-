import { EmbedBuilder, TextChannel, Client } from "discord.js";
import { logger } from "../lib/logger.js";
import { sendLogDM } from "./dm-notify.js";
import { getConfig } from "./guild-config-store.js";
import { getAlertPing } from "./alert-ping.js";

export interface SendLogOptions {
  pingEveryone?: boolean;
  pingContent?: string;
  guildId?: string;
  logType?: "general" | "ban";
  commandChannelId?: string;
}

async function sendToChannel(
  client: Client,
  channelId: string,
  embed: EmbedBuilder,
  pingEveryone?: boolean,
  pingContent?: string,
  guildId?: string,
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send({
        content: pingEveryone ? getAlertPing(guildId) : (pingContent ?? undefined),
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

  // Build a dedicated DM embed with a green jump link
  let dmEmbed = embed;
  if (options?.guildId && options?.commandChannelId) {
    const jumpUrl = `https://discord.com/channels/${options.guildId}/${options.commandChannelId}`;
    dmEmbed = EmbedBuilder.from(embed.toJSON())
      .setURL(jumpUrl)
      .addFields({
        name: "📍 Lieu d'exécution",
        value: `[🟢 Aller au salon](${jumpUrl})`,
        inline: true,
      });
  }

  await Promise.allSettled([
    ...targets.map((id) => sendToChannel(client, id, embed, options?.pingEveryone, options?.pingContent, options?.guildId)),
    sendLogDM(client, dmEmbed),
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
