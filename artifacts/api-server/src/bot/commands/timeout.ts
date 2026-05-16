import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";

const DURATIONS: Record<string, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "10m": 10 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1j": 24 * 60 * 60 * 1000,
  "7j": 7 * 24 * 60 * 60 * 1000,
  "28j": 28 * 24 * 60 * 60 * 1000,
};

export const data = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Met en sourdine temporaire un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à mettre en timeout").setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("durée")
      .setDescription("Durée du timeout")
      .setRequired(true)
      .addChoices(
        { name: "1 minute", value: "1m" },
        { name: "5 minutes", value: "5m" },
        { name: "10 minutes", value: "10m" },
        { name: "30 minutes", value: "30m" },
        { name: "1 heure", value: "1h" },
        { name: "6 heures", value: "6h" },
        { name: "12 heures", value: "12h" },
        { name: "1 jour", value: "1j" },
        { name: "7 jours", value: "7j" },
        { name: "28 jours", value: "28j" }
      )
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du timeout")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const dureeKey = interaction.options.getString("durée", true);
  const reason =
    interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (!member.moderatable) {
    return interaction.reply({
      content: "Je ne peux pas mettre ce membre en timeout (permissions insuffisantes).",
      ephemeral: true,
    });
  }
  if (member.id === interaction.user.id) {
    return interaction.reply({
      content: "Vous ne pouvez pas vous mettre en timeout vous-même.",
      ephemeral: true,
    });
  }

  const ms = DURATIONS[dureeKey]!;
  await member.timeout(ms, reason);

  const labels: Record<string, string> = {
    "1m": "1 minute", "5m": "5 minutes", "10m": "10 minutes",
    "30m": "30 minutes", "1h": "1 heure", "6h": "6 heures",
    "12h": "12 heures", "1j": "1 jour", "7j": "7 jours", "28j": "28 jours",
  };

  const embed = new EmbedBuilder()
    .setColor(0xa855f7)
    .setTitle("🔇 Membre mis en timeout")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Durée", value: labels[dureeKey] ?? dureeKey, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
