import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getAllInviteStats } from "../invite-tracker.js";

const PAGE_SIZE = 15;

async function buildLeaderboardEmbed(
  client: ChatInputCommandInteraction["client"] | Message["client"],
  guildId: string,
  guildName: string,
  guildIcon: string | null,
): Promise<EmbedBuilder> {
  const all = getAllInviteStats(guildId);

  if (all.length === 0) {
    return new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle("📋 Classement des invitations")
      .setDescription("Aucune invitation trackée pour l'instant.\nDéfinissez un salon avec `/setinvitelog` pour activer le suivi.")
      .setTimestamp();
  }

  const top = all.slice(0, PAGE_SIZE);

  const lines = await Promise.all(
    top.map(async ({ userId, stats }, i) => {
      const active = Math.max(0, stats.invited - stats.left);
      const user = await client.users.fetch(userId).catch(() => null);
      const name = user ? user.tag : `\`${userId}\``;
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
      return `${medal} ${name} — ✅ **${stats.invited}** invités · ❌ **${stats.left}** partis · 🟢 **${active}** actifs`;
    })
  );

  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📋 Classement des invitations")
    .setDescription(lines.join("\n"))
    .setFooter({
      text: `${guildName} · ${all.length} inviteur${all.length > 1 ? "s" : ""} — Top ${Math.min(PAGE_SIZE, all.length)}`,
      iconURL: guildIcon ?? undefined,
    })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("checkinvites")
  .setDescription("Classement des invitations du serveur (Admin)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) return;
  await interaction.deferReply({ ephemeral: true });
  const embed = await buildLeaderboardEmbed(
    interaction.client,
    interaction.guildId,
    interaction.guild.name,
    interaction.guild.iconURL(),
  );
  await interaction.editReply({ embeds: [embed] });
}

export const prefixName = "checkinvites";
export const prefixAliases = ["invites", "leaderboardinvites", "topinvites"];

export async function executeMessage(message: Message) {
  if (!message.guild) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Commande réservée aux administrateurs."); return;
  }
  const embed = await buildLeaderboardEmbed(
    message.client,
    message.guild.id,
    message.guild.name,
    message.guild.iconURL(),
  );
  await message.reply({ embeds: [embed] });
}
