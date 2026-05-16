import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getBlacklist } from "../blacklist-store.js";

function buildBlacklistEmbed(guildId: string): EmbedBuilder {
  const list = getBlacklist(guildId);

  const description =
    list.length === 0
      ? "✅ Aucun membre blacklisté."
      : list
          .map(
            (e, i) =>
              `**${i + 1}.** ${e.userTag} (\`${e.userId}\`)\n> Raison : ${e.reason}\n> Par ${e.moderatorTag} — <t:${Math.floor(e.timestamp.getTime() / 1000)}:R>`
          )
          .join("\n\n");

  return new EmbedBuilder()
    .setColor(list.length > 0 ? 0x0f0f0f : 0x22c55e)
    .setTitle(`⛔ Liste noire — ${list.length} membre(s)`)
    .setDescription(description)
    .setFooter({ text: "Un déban nécessite l'approbation d'un administrateur." })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("blacklistinfo")
  .setDescription("Affiche tous les membres dans la liste noire")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });
  }
  return interaction.reply({ embeds: [buildBlacklistEmbed(interaction.guildId)] });
}

export const prefixName = "blacklistinfo";
export const prefixAliases = ["bli", "blackliste"];

export async function executeMessage(message: Message) {
  if (!message.guild || !message.member) return;

  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ Permission insuffisante.");
    return;
  }

  await message.reply({ embeds: [buildBlacklistEmbed(message.guild.id)] });
}
