import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Expulse un membre du serveur")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à expulser").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison de l'expulsion")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason =
    interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (!member.kickable) {
    return interaction.reply({
      content: "Je ne peux pas expulser ce membre (permissions insuffisantes).",
      ephemeral: true,
    });
  }
  if (member.id === interaction.user.id) {
    return interaction.reply({
      content: "Vous ne pouvez pas vous expulser vous-même.",
      ephemeral: true,
    });
  }

  await member.kick(reason);

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("👢 Membre expulsé")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
