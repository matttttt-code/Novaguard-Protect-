import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  Message,
} from "discord.js";

async function buildServerEmbed(guild: Guild): Promise<EmbedBuilder> {
  await guild.fetch();
  const owner = await guild.fetchOwner();
  const createdAt = Math.floor(guild.createdTimestamp / 1000);

  const verificationLevels: Record<number, string> = {
    0: "Aucune", 1: "Faible", 2: "Moyenne", 3: "Élevée", 4: "Très élevée",
  };

  return new EmbedBuilder()
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
      { name: "Niveau de vérification", value: verificationLevels[guild.verificationLevel] ?? "Inconnu", inline: true },
      { name: "Boosts", value: String(guild.premiumSubscriptionCount ?? 0), inline: true }
    )
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Affiche les informations du serveur");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });
  await interaction.deferReply();
  const embed = await buildServerEmbed(interaction.guild);
  return interaction.editReply({ embeds: [embed] });
}

export const prefixName = "serverinfo";
export const prefixAliases = ["serveur", "si2", "sv"];

export async function executeMessage(message: Message) {
  if (!message.guild) return;
  const embed = await buildServerEmbed(message.guild);
  await message.reply({ embeds: [embed] });
}
