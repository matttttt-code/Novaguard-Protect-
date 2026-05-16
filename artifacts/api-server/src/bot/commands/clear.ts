import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("Supprime des messages dans le salon")
  .addIntegerOption((o) =>
    o
      .setName("nombre")
      .setDescription("Nombre de messages à supprimer (1-100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addUserOption((o) =>
    o.setName("membre").setDescription("Supprimer uniquement les messages de ce membre")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  const amount = interaction.options.getInteger("nombre", true);
  const targetMember = interaction.options.getUser("membre");
  const channel = interaction.channel as TextChannel | null;

  if (!channel || !channel.isTextBased()) {
    return interaction.reply({
      content: "Cette commande ne peut être utilisée que dans un salon texte.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  let messages = await channel.messages.fetch({ limit: 100 });

  if (targetMember) {
    messages = messages.filter((m) => m.author.id === targetMember.id);
  }

  const toDelete = messages.first(amount);

  let deleted = 0;
  try {
    const result = await channel.bulkDelete(toDelete, true);
    deleted = result.size;
  } catch {
    return interaction.editReply(
      "Impossible de supprimer les messages (ils sont peut-être trop anciens, plus de 14 jours)."
    );
  }

  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle("🗑️ Messages supprimés")
    .addFields(
      { name: "Nombre supprimé", value: String(deleted), inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      ...(targetMember ? [{ name: "Filtre membre", value: targetMember.tag, inline: true }] : [])
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
