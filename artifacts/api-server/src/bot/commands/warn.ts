import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { addWarning, getWarnings } from "../warnings-store.js";

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Avertit un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à avertir").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison de l'avertissement").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison", true);

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (member.id === interaction.user.id) {
    return interaction.reply({
      content: "Vous ne pouvez pas vous avertir vous-même.",
      ephemeral: true,
    });
  }

  if (!interaction.guildId) {
    return interaction.reply({ content: "Cette commande n'est disponible que sur un serveur.", ephemeral: true });
  }

  addWarning(interaction.guildId, member.id, {
    reason,
    moderator: interaction.user.tag,
    moderatorId: interaction.user.id,
    timestamp: new Date(),
  });

  const totalWarnings = getWarnings(interaction.guildId, member.id).length;

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("⚠️ Avertissement")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Total d'avertissements", value: String(totalWarnings), inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
