import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { addNote, getNotes, deleteNote, clearNotes } from "../notes-store.js";

export const data = new SlashCommandBuilder()
  .setName("note")
  .setDescription("Gérer les notes admin privées sur un membre")
  .addSubcommand((sub) =>
    sub.setName("ajouter")
      .setDescription("Ajouter une note sur un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre concerné").setRequired(true))
      .addStringOption((o) => o.setName("contenu").setDescription("Contenu de la note").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("liste")
      .setDescription("Voir les notes sur un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre concerné").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("supprimer")
      .setDescription("Supprimer une note par son ID")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre concerné").setRequired(true))
      .addIntegerOption((o) => o.setName("id").setDescription("ID de la note").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("effacer")
      .setDescription("Supprimer toutes les notes d'un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre concerné").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getUser("membre", true);

  if (sub === "ajouter") {
    const content = interaction.options.getString("contenu", true);
    const note = addNote(interaction.guildId, target.id, {
      content,
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      timestamp: new Date().toISOString(),
    });
    const embed = new EmbedBuilder().setColor(0x6366f1).setTitle("📝 Note ajoutée")
      .addFields(
        { name: "Membre", value: `${target.tag} (\`${target.id}\`)`, inline: true },
        { name: "Note #" + note.id, value: content },
        { name: "Modérateur", value: interaction.user.tag, inline: true },
      ).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "liste") {
    const notes = getNotes(interaction.guildId, target.id);
    if (notes.length === 0) return interaction.reply({ content: `Aucune note sur **${target.tag}**.`, ephemeral: true });
    const embed = new EmbedBuilder().setColor(0x6366f1).setTitle(`📝 Notes — ${target.tag}`)
      .setDescription(notes.map((n) =>
        `**#${n.id}** <t:${Math.floor(new Date(n.timestamp).getTime() / 1000)}:d> · *${n.moderator}*\n${n.content}`
      ).join("\n\n").slice(0, 4000))
      .setFooter({ text: `${notes.length} note(s)` }).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "supprimer") {
    const noteId = interaction.options.getInteger("id", true);
    const deleted = deleteNote(interaction.guildId, target.id, noteId);
    return interaction.reply({ content: deleted ? `✅ Note **#${noteId}** supprimée.` : `❌ Note #${noteId} introuvable.`, ephemeral: true });
  }

  if (sub === "effacer") {
    const count = clearNotes(interaction.guildId, target.id);
    return interaction.reply({ content: `✅ **${count}** note(s) supprimée(s) pour **${target.tag}**.`, ephemeral: true });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "note";
export const prefixAliases = ["notes"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ Permission insuffisante."); return;
  }

  const sub = args[0]?.toLowerCase();
  const userId = args[1]?.replace(/[<@!>]/g, "");

  if (!sub || !userId || !/^\d+$/.test(userId)) {
    await message.reply("Usage : `&note ajouter @user <texte>` · `&note liste @user` · `&note supprimer @user <id>` · `&note effacer @user`"); return;
  }

  if (sub === "ajouter") {
    const content = args.slice(2).join(" ");
    if (!content) { await message.reply("❌ Contenu vide."); return; }
    const note = addNote(message.guild.id, userId, { content, moderator: message.author.tag, moderatorId: message.author.id, timestamp: new Date().toISOString() });
    await message.reply(`✅ Note **#${note.id}** ajoutée sur <@${userId}>.`); return;
  }

  if (sub === "liste") {
    const notes = getNotes(message.guild.id, userId);
    if (notes.length === 0) { await message.reply(`Aucune note sur <@${userId}>.`); return; }
    const embed = new EmbedBuilder().setColor(0x6366f1).setTitle(`📝 Notes — <@${userId}>`)
      .setDescription(notes.map((n) => `**#${n.id}** *${n.moderator}* — ${n.content}`).join("\n").slice(0, 4000))
      .setFooter({ text: `${notes.length} note(s)` });
    await message.reply({ embeds: [embed] }); return;
  }

  if (sub === "supprimer") {
    const noteId = parseInt(args[2] ?? "", 10);
    if (isNaN(noteId)) { await message.reply("❌ ID invalide."); return; }
    const deleted = deleteNote(message.guild.id, userId, noteId);
    await message.reply(deleted ? `✅ Note **#${noteId}** supprimée.` : `❌ Note introuvable.`); return;
  }

  if (sub === "effacer") {
    const count = clearNotes(message.guild.id, userId);
    await message.reply(`✅ **${count}** note(s) supprimée(s).`); return;
  }

  await message.reply("Sous-commande inconnue. Utilise : `ajouter`, `liste`, `supprimer`, `effacer`.");
}
