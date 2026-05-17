import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  TextChannel,
} from "discord.js";

function buildPanel(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🎫 Ouvrir un ticket")
    .setDescription(
      "Besoin d'aide ou tu as un signalement à faire ?\n\n" +
      "Clique sur le bouton ci-dessous pour ouvrir un **ticket privé** avec le staff.\n\n" +
      "**Règles :**\n" +
      "• Ouvre un ticket uniquement si tu as besoin d'aide\n" +
      "• Décris clairement ton problème\n" +
      "• Un ticket par personne à la fois\n" +
      "• Les abus entraîneront une sanction"
    )
    .setFooter({ text: "Un seul ticket actif par utilisateur" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel("🎫  Créer un ticket")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

export const data = new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Envoie le panel de création de tickets dans ce salon")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const panel = buildPanel();
  await interaction.reply({ content: "✅ Panel envoyé !", ephemeral: true });
  if (interaction.channel && "send" in interaction.channel) {
    await (interaction.channel as TextChannel).send(panel);
  }
}

export const prefixName = "ticketpanel";
export const prefixAliases = ["tpanel"];

export async function executeMessage(message: Message) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }
  const panel = buildPanel();
  await message.delete().catch(() => null);
  if ("send" in message.channel) {
    await (message.channel as TextChannel).send(panel);
  }
}
