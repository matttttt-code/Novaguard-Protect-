import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getWarnings } from "../warnings-store.js";

async function buildSanctionEmbed(
  member: GuildMember,
  guildId: string
): Promise<EmbedBuilder> {
  const warnings = getWarnings(guildId, member.id);

  const isTimedOut =
    member.communicationDisabledUntil &&
    member.communicationDisabledUntil > new Date();

  let isBanned = false;
  try {
    await member.guild.bans.fetch(member.id);
    isBanned = true;
  } catch {
    isBanned = false;
  }

  const warningList =
    warnings.length === 0
      ? "Aucun avertissement"
      : warnings
          .map(
            (w, i) =>
              `**${i + 1}.** ${w.reason}\n> Par ${w.moderator} — <t:${Math.floor(w.timestamp.getTime() / 1000)}:R>`
          )
          .join("\n\n");

  return new EmbedBuilder()
    .setColor(warnings.length > 0 ? 0xf97316 : 0x22c55e)
    .setTitle(`🗂️ Sanctions — ${member.user.tag}`)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "ID", value: `\`${member.id}\``, inline: true },
      {
        name: "Statut timeout",
        value: isTimedOut
          ? `🔇 Jusqu'au <t:${Math.floor(member.communicationDisabledUntil!.getTime() / 1000)}:F>`
          : "✅ Aucun",
        inline: true,
      },
      {
        name: "Statut ban",
        value: isBanned ? "🔨 Banni" : "✅ Non banni",
        inline: true,
      },
      {
        name: `⚠️ Avertissements (${warnings.length})`,
        value: warningList,
      }
    )
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("sanctioninfo")
  .setDescription("Affiche toutes les sanctions d'un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à inspecter").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  if (!member || !interaction.guildId) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }

  await interaction.deferReply();
  const embed = await buildSanctionEmbed(member, interaction.guildId);
  return interaction.editReply({ embeds: [embed] });
}

export const prefixName = "sanctioninfo";
export const prefixAliases = ["si", "sanctions"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;

  const mention = args[0];
  let member: GuildMember | null = null;

  if (mention) {
    const userId = mention.replace(/[<@!>]/g, "");
    try {
      member = await message.guild.members.fetch(userId);
    } catch {
      await message.reply("❌ Membre introuvable.");
      return;
    }
  } else {
    member = message.member as GuildMember;
  }

  const embed = await buildSanctionEmbed(member, message.guild.id);
  await message.reply({ embeds: [embed] });
}
