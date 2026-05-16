import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  Role,
  EmbedBuilder,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("role")
  .setDescription("Ajoute ou retire un rôle à un membre")
  .addSubcommand((sub) =>
    sub
      .setName("ajouter")
      .setDescription("Ajoute un rôle à un membre")
      .addUserOption((o) =>
        o.setName("membre").setDescription("Le membre").setRequired(true)
      )
      .addRoleOption((o) =>
        o.setName("rôle").setDescription("Le rôle à ajouter").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("retirer")
      .setDescription("Retire un rôle à un membre")
      .addUserOption((o) =>
        o.setName("membre").setDescription("Le membre").setRequired(true)
      )
      .addRoleOption((o) =>
        o.setName("rôle").setDescription("Le rôle à retirer").setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const role = interaction.options.getRole("rôle") as Role | null;

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (!role) {
    return interaction.reply({ content: "Rôle introuvable.", ephemeral: true });
  }

  const botMember = interaction.guild?.members.me;
  if (botMember && role.position >= botMember.roles.highest.position) {
    return interaction.reply({
      content: "Je ne peux pas gérer ce rôle (il est supérieur ou égal au mien).",
      ephemeral: true,
    });
  }

  if (sub === "ajouter") {
    if (member.roles.cache.has(role.id)) {
      return interaction.reply({
        content: `${member.user.tag} possède déjà le rôle <@&${role.id}>.`,
        ephemeral: true,
      });
    }
    await member.roles.add(role, `Ajout par ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x22c55e)
      .setTitle("✅ Rôle ajouté")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Rôle", value: `<@&${role.id}>`, inline: true },
        { name: "Modérateur", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    return sendLog(
      interaction.client,
      logEmbed(
        role.color || 0x22c55e,
        "✅ Rôle ajouté",
        [
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Rôle", value: `<@&${role.id}>`, inline: true },
        ],
        { tag: interaction.user.tag, id: interaction.user.id }
      )
    );
  } else {
    if (!member.roles.cache.has(role.id)) {
      return interaction.reply({
        content: `${member.user.tag} n'a pas le rôle <@&${role.id}>.`,
        ephemeral: true,
      });
    }
    await member.roles.remove(role, `Retrait par ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle("➖ Rôle retiré")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Rôle", value: `<@&${role.id}>`, inline: true },
        { name: "Modérateur", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await sendLog(
      interaction.client,
      logEmbed(
        0xf97316,
        "➖ Rôle retiré",
        [
          { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: "Rôle", value: `<@&${role.id}>`, inline: true },
        ],
        { tag: interaction.user.tag, id: interaction.user.id }
      )
    );
  }
}
