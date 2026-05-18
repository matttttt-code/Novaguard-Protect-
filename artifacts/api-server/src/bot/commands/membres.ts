import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  Message,
} from "discord.js";
import { isOwner } from "../owner-store.js";

async function fetchMemberIds(
  client: import("discord.js").Client,
  guildId: string,
): Promise<{ ids: string[]; guildName: string } | { error: string }> {
  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { error: `Serveur \`${guildId}\` introuvable (le bot n'y est peut-être pas présent).` };

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return { error: "Impossible de récupérer les membres (permissions insuffisantes)." };

  const ids = members.filter((m) => !m.user.bot).map((m) => m.user.id);
  return { ids, guildName: guild.name };
}

export const data = new SlashCommandBuilder()
  .setName("membres")
  .setDescription("[OWNER] Récupère tous les IDs des membres d'un serveur donné.")
  .addStringOption((o) =>
    o.setName("guildid").setDescription("L'ID du serveur cible").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: "❌ Commande réservée au propriétaire du bot.", flags: 64 });
    return;
  }

  const guildId = interaction.options.getString("guildid", true).trim();
  await interaction.deferReply({ flags: 64 });

  const result = await fetchMemberIds(interaction.client, guildId);
  if ("error" in result) {
    await interaction.editReply({ content: `❌ ${result.error}` });
    return;
  }

  const { ids, guildName } = result;

  const txt = ids.join("\n");
  const file = new AttachmentBuilder(Buffer.from(txt, "utf-8"), {
    name: `membres-${guildId}.txt`,
    description: `IDs membres de ${guildName}`,
  });

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`👥 Membres de ${guildName}`)
    .setDescription(`**${ids.length}** membre(s) humain(s) trouvé(s).\nListe des IDs en pièce jointe.`)
    .addFields({ name: "ID Serveur", value: `\`${guildId}\``, inline: true })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [file] });
}

export const prefixName = "membres";
export const prefixAliases = ["memberids", "listmembers"];

export async function executeMessage(message: Message, args: string[]) {
  if (!isOwner(message.author.id)) {
    await message.reply("❌ Commande réservée au propriétaire du bot.");
    return;
  }

  const guildId = args[0]?.trim();
  if (!guildId) {
    await message.reply("❌ Utilisation : `&membres <guildId>`");
    return;
  }

  const loading = await message.reply("🔍 Récupération des membres en cours…");

  const result = await fetchMemberIds(message.client, guildId);
  if ("error" in result) {
    await loading.edit(`❌ ${result.error}`);
    return;
  }

  const { ids, guildName } = result;

  const txt = ids.join("\n");
  const file = new AttachmentBuilder(Buffer.from(txt, "utf-8"), {
    name: `membres-${guildId}.txt`,
    description: `IDs membres de ${guildName}`,
  });

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`👥 Membres de ${guildName}`)
    .setDescription(`**${ids.length}** membre(s) humain(s) trouvé(s).\nListe des IDs en pièce jointe.`)
    .addFields({ name: "ID Serveur", value: `\`${guildId}\``, inline: true })
    .setTimestamp();

  await loading.edit({ content: "", embeds: [embed], files: [file] });
}
