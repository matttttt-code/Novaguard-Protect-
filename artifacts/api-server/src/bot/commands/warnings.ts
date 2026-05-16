import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getWarnings, clearWarnings } from "../warnings-store.js";

export const data = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("Gère les avertissements d'un membre")
  .addSubcommand((sub) =>
    sub.setName("voir").setDescription("Voir les avertissements d'un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("effacer").setDescription("Effacer tous les avertissements d'un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const member = interaction.options.getMember("membre") as GuildMember | null;
  if (!member) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });

  if (sub === "voir") {
    const warns = getWarnings(interaction.guildId, member.id);
    const embed = new EmbedBuilder().setColor(0xf97316).setTitle(`⚠️ Avertissements — ${member.user.tag}`)
      .setDescription(warns.length === 0 ? "Aucun avertissement." :
        warns.map((w, i) => `**${i + 1}.** ${w.reason}\n> Par ${w.moderator} — <t:${Math.floor(w.timestamp.getTime() / 1000)}:R>`).join("\n\n"))
      .setFooter({ text: `Total : ${warns.length} avertissement(s)` }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
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
  if (sub !== "voir" && sub !== "effacer") {
    await message.reply("Usage : `&warnings voir @membre` ou `&warnings effacer @membre`"); return;
  }

  const userId = args[1]?.replace(/[<@!>]/g, "");
  if (!userId) { await message.reply("❌ Membre manquant."); return; }

  let member: GuildMember;
  try { member = await message.guild.members.fetch(userId); }
  catch { await message.reply("❌ Membre introuvable."); return; }

  if (sub === "voir") {
    const warns = getWarnings(message.guild.id, member.id);
    const embed = new EmbedBuilder().setColor(0xf97316).setTitle(`⚠️ Avertissements — ${member.user.tag}`)
      .setDescription(warns.length === 0 ? "Aucun avertissement." :
        warns.map((w, i) => `**${i + 1}.** ${w.reason}\n> Par ${w.moderator} — <t:${Math.floor(w.timestamp.getTime() / 1000)}:R>`).join("\n\n"))
      .setFooter({ text: `Total : ${warns.length} avertissement(s)` }).setTimestamp();
    await message.reply({ embeds: [embed] });
  } else {
    const count = clearWarnings(message.guild.id, member.id);
    const embed = new EmbedBuilder().setColor(0x22c55e).setTitle("🗑️ Avertissements effacés")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Supprimés", value: String(count), inline: true }
      ).setTimestamp();
    await message.reply({ embeds: [embed] });
  }
}
