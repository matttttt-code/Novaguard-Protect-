import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("untimeout")
  .setDescription("Retire le timeout d'un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à libérer").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason =
    interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (!member.communicationDisabledUntil) {
    return interaction.reply({
      content: "Ce membre n'est pas en timeout.",
      ephemeral: true,
    });
  }

  await member.timeout(null, reason);

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("🔊 Timeout retiré")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
