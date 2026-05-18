import {
  Client,
  Events,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { getConfig } from "../guild-config-store.js";
import { sendLog, logEmbed } from "../log.js";
import { logger } from "../../lib/logger.js";

export function registerAntiEveryone(client: Client): void {
  client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.bot) return;

    const cfg = getConfig(msg.guild.id);
    if (!cfg.antiEveryoneEnabled) return;

    const hasEveryone = msg.mentions.everyone;
    const hasHere = msg.content.includes("@here");
    if (!hasEveryone && !hasHere) return;

    const member = msg.member ?? await msg.guild.members.fetch(msg.author.id).catch(() => null);
    if (!member) return;

    if (member.permissions.has(PermissionFlagsBits.MentionEveryone)) return;

    const timeoutMs = (cfg.antiEveryoneTimeoutSecs ?? 300) * 1000;
    const mentionType = hasEveryone && hasHere
      ? "@everyone / @here"
      : hasEveryone ? "@everyone" : "@here";

    try {
      await (member as GuildMember).timeout(timeoutMs, `Anti-mention global : utilisation de ${mentionType}`);
    } catch (err) {
      logger.warn({ err }, "[antieveryone] Impossible de timeout le membre");
    }

    try {
      await msg.delete().catch(() => null);
    } catch { /* silent */ }

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle(`🔇 Anti-mention global — ${mentionType}`)
      .addFields(
        { name: "Auteur", value: `<@${msg.author.id}> (\`${msg.author.tag}\`)`, inline: true },
        { name: "Salon", value: `<#${msg.channelId}>`, inline: true },
        { name: "Action", value: `Timeout ${cfg.antiEveryoneTimeoutSecs}s + suppression du message`, inline: false },
        { name: "Contenu (tronqué)", value: `\`\`\`${msg.content.slice(0, 400) || "(vide)"}\`\`\`` },
      )
      .setTimestamp();

    await sendLog(client, logEmbed(0xef4444, `🔇 Anti-mention global — ${mentionType}`, [
      { name: "Auteur", value: `${msg.author.tag} (\`${msg.author.id}\`)`, inline: true },
      { name: "Salon", value: `<#${msg.channelId}>`, inline: true },
      { name: "Action", value: `Timeout ${cfg.antiEveryoneTimeoutSecs}s + message supprimé` },
    ], { tag: "Automod", id: "0" }), { guildId: msg.guild.id });

    try {
      if (msg.channel.isTextBased()) {
        await msg.channel.send({ embeds: [embed] }).catch(() => null);
      }
    } catch { /* silent */ }
  });
}
