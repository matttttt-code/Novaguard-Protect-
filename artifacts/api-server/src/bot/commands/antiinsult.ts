import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import {
  getConfig,
  setAntiInsultEnabled,
  addAntiInsultWord,
  removeAntiInsultWord,
} from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("antiinsult")
  .setDescription("Gère le filtre anti-insulte automatique")
  .addSubcommand((s) => s.setName("activer").setDescription("Active le filtre anti-insulte"))
  .addSubcommand((s) => s.setName("désactiver").setDescription("Désactive le filtre anti-insulte"))
  .addSubcommand((s) =>
    s.setName("ajouter")
      .setDescription("Ajoute un mot au filtre")
      .addStringOption((o) => o.setName("mot").setDescription("Mot ou expression à filtrer").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("retirer")
      .setDescription("Retire un mot du filtre")
      .addStringOption((o) => o.setName("mot").setDescription("Mot à retirer").setRequired(true))
  )
  .addSubcommand((s) => s.setName("liste").setDescription("Affiche tous les mots filtrés"))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === "activer") {
    setAntiInsultEnabled(guildId, true);
    const lvl = getConfig(guildId).securityLevel;
    const punishment = lvl >= 3 ? "timeout 24h" : lvl >= 2 ? "timeout 1h" : "avertissement + suppression";
    return interaction.reply({ content: `✅ Anti-insulte **activé**. Sanction selon niveau de sécurité actuel (niveau ${lvl}) : **${punishment}**.`, ephemeral: true });
  }

  if (sub === "désactiver") {
    setAntiInsultEnabled(guildId, false);
    return interaction.reply({ content: "❌ Anti-insulte **désactivé**.", ephemeral: true });
  }

  if (sub === "ajouter") {
    const mot = interaction.options.getString("mot", true).toLowerCase().trim();
    if (mot.length < 2) return interaction.reply({ content: "❌ Le mot doit faire au moins 2 caractères.", ephemeral: true });
    addAntiInsultWord(guildId, mot);
    return interaction.reply({ content: `✅ Mot ajouté au filtre : \`${mot}\``, ephemeral: true });
  }

  if (sub === "retirer") {
    const mot = interaction.options.getString("mot", true).toLowerCase().trim();
    const removed = removeAntiInsultWord(guildId, mot);
    return interaction.reply({ content: removed ? `✅ Mot retiré : \`${mot}\`` : `❌ Mot \`${mot}\` introuvable dans le filtre.`, ephemeral: true });
  }

  if (sub === "liste") {
    const words = getConfig(guildId).antiInsultWords;
    if (words.length === 0) {
      return interaction.reply({ content: "ℹ️ Le filtre anti-insulte ne contient aucun mot. Ajoutez-en avec `/antiinsult ajouter`.", ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle(`🤬 Mots filtrés — ${words.length} entrée(s)`)
      .setDescription(words.map((w) => `\`${w}\``).join(", "))
      .setFooter({ text: `Anti-insulte : ${getConfig(guildId).antiInsultEnabled ? "Actif" : "Inactif"}` })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "antiinsult";
export const prefixAliases = ["aif", "filtreinsult"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;

  if (sub === "activer") {
    setAntiInsultEnabled(guildId, true);
    await message.reply("✅ Anti-insulte **activé**."); return;
  }
  if (sub === "désactiver" || sub === "desactiver") {
    setAntiInsultEnabled(guildId, false);
    await message.reply("❌ Anti-insulte **désactivé**."); return;
  }
  if (sub === "ajouter") {
    const mot = args.slice(1).join(" ").toLowerCase().trim();
    if (!mot || mot.length < 2) { await message.reply("❌ Mot invalide."); return; }
    addAntiInsultWord(guildId, mot);
    await message.reply(`✅ Mot ajouté : \`${mot}\``); return;
  }
  if (sub === "retirer") {
    const mot = args.slice(1).join(" ").toLowerCase().trim();
    const removed = removeAntiInsultWord(guildId, mot);
    await message.reply(removed ? `✅ Mot retiré : \`${mot}\`` : `❌ Mot \`${mot}\` introuvable.`); return;
  }
  if (sub === "liste") {
    const words = getConfig(guildId).antiInsultWords;
    if (words.length === 0) { await message.reply("ℹ️ Aucun mot filtré."); return; }
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle(`🤬 Mots filtrés — ${words.length}`).setDescription(words.map((w) => `\`${w}\``).join(", ")).setTimestamp()] });
    return;
  }
  await message.reply("Sous-commandes : `activer`, `désactiver`, `ajouter <mot>`, `retirer <mot>`, `liste`");
}
