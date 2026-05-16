import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("nickname")
  .setDescription("Change ou réinitialise le surnom d'un membre")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre").setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("surnom")
      .setDescription("Nouveau surnom (vide pour réinitialiser)")
      .setMaxLength(32)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const newNick = interaction.options.getString("surnom");

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (!member.manageable) {
    return interaction.reply({
      content: "Je ne peux pas modifier le surnom de ce membre.",
      ephemeral: true,
    });
  }

  const oldNick = member.nickname ?? member.user.username;
  await member.setNickname(
    newNick,
    `Modifié par ${interaction.user.tag}`
  );

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("✏️ Surnom modifié")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true },
      { name: "Avant", value: oldNick, inline: true },
      {
        name: "Après",
        value: newNick ?? `*(réinitialisé : ${member.user.username})*`,
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(
      0x6366f1,
      "✏️ Surnom modifié",
      [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Avant", value: oldNick, inline: true },
        {
          name: "Après",
          value: newNick ?? `*(réinitialisé)*`,
          inline: true,
        },
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    )
  );
}
