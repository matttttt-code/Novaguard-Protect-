import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Affiche les informations du serveur");

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild as Guild | null;
  if (!guild) {
    return interaction.reply({ content: "Cette commande n'est disponible que sur un serveur.", ephemeral: true });
  }

  await guild.fetch();

  const owner = await guild.fetchOwner();
  const createdAt = Math.floor(guild.createdTimestamp / 1000);

  const verificationLevels: Record<number, string> = {
    0: "Aucune",
    1: "Faible",
    2: "Moyenne",
    3: "Élevée",
    4: "Très élevée",
  };

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`🏠 ${guild.name}`)
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: "ID", value: `\`${guild.id}\``, inline: true },
      { name: "Propriétaire", value: owner.user.tag, inline: true },
      { name: "Créé le", value: `<t:${createdAt}:F>`, inline: false },
      { name: "Membres", value: String(guild.memberCount), inline: true },
      { name: "Salons", value: String(guild.channels.cache.size), inline: true },
      { name: "Rôles", value: String(guild.roles.cache.size), inline: true },
      { name: "Emojis", value: String(guild.emojis.cache.size), inline: true },
      {
        name: "Niveau de vérification",
        value: verificationLevels[guild.verificationLevel] ?? "Inconnu",
        inline: true,
      },
      { name: "Boosts", value: String(guild.premiumSubscriptionCount ?? 0), inline: true }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
