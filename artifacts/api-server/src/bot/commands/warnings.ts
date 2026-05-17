import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getWarnings, clearWarnings, removeWarningByCase } from "../warnings-store.js";

function warningsEmbed(member: GuildMember): EmbedBuilder {
  const warns = getWarnings(member.guild.id, member.id);
  const description =
    warns.length === 0
      ? "Aucun avertissement."
      : warns
          .map((w) => `**Case #${w.caseId}** — ${w.reason}\n> Par ${w.moderator} — <t:${Math.floor(w.timestamp.getTime() / 1000)}:R>`)
          .join("\n\n");

  return new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle(`⚠️ Avertissements — ${member.user.tag}`)
    .setDescription(description)
    .setFooter({ text: `Total : ${warns.length} avertissement(s) | Pour retirer : &warnings retirer @membre <caseId>` })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("Gère les avertissements d'un membre")
  .addSubcommand((sub) =>
    sub.setName("voir").setDescription("Voir les avertissements")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("effacer").setDescription("Effacer TOUS les avertissements d'un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("retirer").setDescription("Retirer un avertissement par Case ID")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
      .addIntegerOption((o) => o.setName("case").setDescription("Le numéro de case à retirer").setRequired(true).setMinValue(1))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const member = interaction.options.getMember("membre") as GuildMember | null;
  if (!member) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });

  if (sub === "voir") {
    return interaction.reply({ embeds: [warningsEmbed(member)] });
  }

  if (sub === "effacer") {
    const count = clearWarnings(interaction.guildId, member.id);
    const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("🗑️ Avertissements effacés")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Supprimés", value: String(count), inline: true }
      ).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "retirer") {
    const caseId = interaction.options.getInteger("case", true);
    const removed = removeWarningByCase(interaction.guildId, member.id, caseId);
    if (!removed) {
      return interaction.reply({ content: `❌ Aucun avertissement avec le Case #${caseId} trouvé pour ce membre.`, ephemeral: true });
    }
    const remaining = getWarnings(interaction.guildId, member.id).length;
    const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("✅ Avertissement retiré")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Case retiré", value: `#${caseId}`, inline: true },
        { name: "Restants", value: String(remaining), inline: true }
      ).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "warnings";
export const prefixAliases = ["warns", "infractions"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ Permission insuffisante."); return;
  }

  const sub = args[0]?.toLowerCase();
  const validSubs = ["voir", "effacer", "retirer"];
  if (!validSubs.includes(sub ?? "")) {
    await message.reply("Usage :\n`&warnings voir @membre`\n`&warnings effacer @membre`\n`&warnings retirer @membre <caseId>`"); return;
  }

  const userId = args[1]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("❌ Membre manquant."); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  if (sub === "voir") {
    await message.reply({ embeds: [warningsEmbed(member)] });
    return;
  }

  if (sub === "effacer") {
    const count = clearWarnings(message.guild.id, member.id);
    const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("🗑️ Avertissements effacés")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Supprimés", value: String(count), inline: true }
      ).setTimestamp();
    await message.reply({ embeds: [embed] });
    return;
  }

  if (sub === "retirer") {
    const caseId = parseInt(args[2] ?? "", 10);
    if (isNaN(caseId)) { await message.reply("❌ Case ID invalide. Usage : `&warnings retirer @membre <caseId>`"); return; }
    const removed = removeWarningByCase(message.guild.id, member.id, caseId);
    if (!removed) {
      await message.reply(`❌ Aucun avertissement avec le Case #${caseId} pour ce membre.`); return;
    }
    const remaining = getWarnings(message.guild.id, member.id).length;
    const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("✅ Avertissement retiré")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Case retiré", value: `#${caseId}`, inline: true },
        { name: "Restants", value: String(remaining), inline: true }
      ).setTimestamp();
    await message.reply({ embeds: [embed] });
    return;
  }
}
