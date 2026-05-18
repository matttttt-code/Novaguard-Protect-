import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  GuildMember,
  User,
} from "discord.js";
import { getBlacklistedServers, getBlacklistedServerIds } from "../server-blacklist-store.js";

function buildVerifEmbed(
  targetUser: User,
  found: { guildId: string; label: string; memberCount?: number }[],
  checkedCount: number
): EmbedBuilder {
  if (found.length === 0) {
    return new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Vérification — Aucun serveur suspect")
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription(
        `**${targetUser.tag}** (\`${targetUser.id}\`) n'est présent dans aucun des **${checkedCount}** serveurs blacklistés visibles par le bot.`
      )
      .setTimestamp();
  }

  const lines = found.map((g) => `🔴 **${g.label}** — \`${g.guildId}\``);

  return new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("⚠️ Serveurs suspects détectés")
    .setThumbnail(targetUser.displayAvatarURL())
    .setDescription(
      `**${targetUser.tag}** (\`${targetUser.id}\`) est présent dans **${found.length}** serveur(s) blacklisté(s) :\n\n${lines.join("\n")}`
    )
    .setFooter({ text: `${checkedCount} serveurs blacklistés vérifiés (bot présent)` })
    .setTimestamp();
}

async function runVerif(
  targetUser: User,
  client: import("discord.js").Client
): Promise<EmbedBuilder> {
  const blacklistedIds = getBlacklistedServerIds();
  const allServers = getBlacklistedServers();
  const checkedCount = allServers.length;

  if (blacklistedIds.size === 0) {
    return new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("⚠️ Aucun serveur blacklisté configuré")
      .setDescription("Ajoutez des serveurs à la blacklist depuis le panel Owner → Config → Serveurs Blacklistés.")
      .setTimestamp();
  }

  const found: { guildId: string; label: string }[] = [];

  for (const id of blacklistedIds) {
    const guild = client.guilds.cache.get(id);
    if (!guild) continue;
    try {
      await guild.members.fetch(targetUser.id);
      const entry = allServers.find((s) => s.guildId === id);
      found.push({ guildId: id, label: entry?.label ?? id });
    } catch { /* utilisateur non présent dans ce serveur */ }
  }

  return buildVerifEmbed(targetUser, found, checkedCount);
}

export const data = new SlashCommandBuilder()
  .setName("verif")
  .setDescription("Vérifie si un membre est présent dans des serveurs blacklistés")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à vérifier").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser("membre", true);
  const embed = await runVerif(targetUser, interaction.client);
  await interaction.editReply({ embeds: [embed] });
}

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
    targetUser = await message.client.users.fetch(userId);
  } catch {
    await message.reply("❌ Utilisateur introuvable.");
    return;
  }

  const msg = await message.reply("🔍 Vérification en cours…");
  const embed = await runVerif(targetUser, message.client);
  await msg.edit({ content: "", embeds: [embed] });
}
