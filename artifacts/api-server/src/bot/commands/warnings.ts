import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { getWarnings, clearWarnings } from "../warnings-store.js";

export const data = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("Gère les avertissements d'un membre")
  .addSubcommand((sub) =>
    sub
      .setName("voir")
      .setDescription("Voir les avertissements d'un membre")
      .addUserOption((o) =>
        o.setName("membre").setDescription("Le membre").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("effacer")
      .setDescription("Effacer tous les avertissements d'un membre")
      .addUserOption((o) =>
        o.setName("membre").setDescription("Le membre").setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    return interaction.reply({ content: "Cette commande n'est disponible que sur un serveur.", ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();
  const member = interaction.options.getMember("membre") as GuildMember | null;

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }

  if (sub === "voir") {
    const warns = getWarnings(interaction.guildId, member.id);

    const embed = new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle(`⚠️ Avertissements — ${member.user.tag}`)
      .setDescription(
        warns.length === 0
          ? "Aucun avertissement enregistré."
          : warns
              .map((w, i) =>
                `**${i + 1}.** ${w.reason}\n> Par ${w.moderator} — <t:${Math.floor(w.timestamp.getTime() / 1000)}:R>`
              )
              .join("\n\n")
      )
      .setFooter({ text: `Total : ${warns.length} avertissement(s)` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "effacer") {
    const count = clearWarnings(interaction.guildId, member.id);

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("🗑️ Avertissements effacés")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Avertissements supprimés", value: String(count), inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}
