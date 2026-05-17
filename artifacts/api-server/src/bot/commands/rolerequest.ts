import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("rolerequest")
  .setDescription("Soumettre une demande de rôle au staff via un formulaire");

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("rolerequest_modal")
    .setTitle("📋 Demande de rôle");

  const roleInput = new TextInputBuilder()
    .setCustomId("role_name")
    .setLabel("Quel rôle souhaitez-vous obtenir ?")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex : @Artiste, @VIP, @Staff...")
    .setMaxLength(100)
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Pourquoi méritez-vous ce rôle ?")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Expliquez en quelques phrases pourquoi vous souhaitez ce rôle...")
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
  );

  await interaction.showModal(modal);
}

export const prefixName = "rolerequest";
export const prefixAliases = ["demanderole", "rr"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;

  if (args.length < 2) {
    await message.reply(
      "❌ Usage : `&rolerequest <rôle> <raison>`\n" +
      "Exemple : `&rolerequest Artiste Je crée des illustrations régulièrement sur le serveur.`\n\n" +
      "💡 Tu peux aussi utiliser `/rolerequest` pour un formulaire interactif."
    );
    return;
  }

  const roleName = args[0]!.replace(/[<@&>]/g, "");
  const reason = args.slice(1).join(" ");

  const resolved = message.guild.roles.cache.find((r) =>
    r.id === roleName || r.name.toLowerCase() === roleName.toLowerCase()
  );

  await sendLog(message.client, new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📋 Demande de rôle")
    .setThumbnail(message.author.displayAvatarURL())
    .addFields(
      { name: "Demandeur", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
      { name: "Salon", value: `<#${message.channelId}>`, inline: true },
      { name: "Rôle demandé", value: resolved ? `<@&${resolved.id}> (\`${resolved.name}\`)` : `\`${args[0]}\`` },
      { name: "Raison", value: reason },
    )
    .setFooter({ text: "Demande de rôle via préfixe" })
    .setTimestamp(), { guildId: message.guild.id });

  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Demande envoyée")
      .setDescription("Ta demande de rôle a été transmise au staff dans les logs. Sois patient·e !")
      .setTimestamp()],
  });
}

export async function handleRoleRequestModal(
  client: Parameters<typeof sendLog>[0],
  interaction: import("discord.js").ModalSubmitInteraction,
): Promise<void> {
  const { guild } = interaction;
  if (!guild) return;

  const roleName = interaction.fields.getTextInputValue("role_name").trim();
  const reason = interaction.fields.getTextInputValue("reason").trim();

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);

  const resolved = guild.roles.cache.find((r) =>
    r.name.toLowerCase() === roleName.replace(/^@/, "").toLowerCase()
  );

  await sendLog(client, new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📋 Demande de rôle")
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "Demandeur", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true },
      { name: "Salon", value: interaction.channel ? `<#${interaction.channel.id}>` : "Inconnu", inline: true },
      { name: "Rôle demandé", value: resolved ? `<@&${resolved.id}> (\`${resolved.name}\`)` : `\`${roleName}\`` },
      { name: "Raison", value: reason },
    )
    .addFields(
      { name: "Compte créé", value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "Sur le serveur depuis", value: member ? `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>` : "Inconnu", inline: true },
    )
    .setFooter({ text: `${guild.name} • Demande de rôle`, iconURL: guild.iconURL() ?? undefined })
    .setTimestamp(), { guildId: guild.id });

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Demande envoyée !")
      .setDescription(
        `Ta demande pour le rôle **${roleName}** a été transmise au staff dans les logs.\n` +
        `Sois patient·e, un modérateur examinera ta demande prochainement.`
      )
      .setTimestamp()],
    ephemeral: true,
  });
}
