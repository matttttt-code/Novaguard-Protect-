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
  setAntiInsultWords,
} from "../guild-config-store.js";
import { DEFAULT_INSULT_WORDS } from "../insult-list.js";

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
  .addSubcommand((s) =>
    s.setName("charger-defaults").setDescription(`Charge la liste française prédéfinie (${DEFAULT_INSULT_WORDS.length} mots + dérivés)`)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === "activer") {
    setAntiInsultEnabled(guildId, true);
    const cfg = getConfig(guildId);
    const lvl = cfg.securityLevel;
    const punishment = lvl >= 3 ? "timeout 24h" : lvl >= 2 ? "timeout 1h" : "avertissement + suppression";
    const wordCount = cfg.antiInsultWords.length;
    const hint = wordCount === 0 ? " ⚠️ Aucun mot dans le filtre — utilisez `/antiinsult charger-defaults` pour charger la liste française." : ` (${wordCount} mots filtrés)`;
    return interaction.reply({ content: `✅ Anti-insulte **activé**. Sanction niveau ${lvl} : **${punishment}**.${hint}`, ephemeral: true });
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
      return interaction.reply({ content: "ℹ️ Aucun mot dans le filtre. Utilisez `/antiinsult charger-defaults` pour charger la liste française prédéfinie.", ephemeral: true });
    }
    const chunks = words.join(", ");
    const display = chunks.length > 3900 ? chunks.slice(0, 3900) + "..." : chunks;
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle(`🤬 Mots filtrés — ${words.length} entrée(s)`)
        .setDescription(display.split(", ").map((w) => `\`${w}\``).join(", "))
        .setFooter({ text: `Anti-insulte : ${getConfig(guildId).antiInsultEnabled ? "✅ Actif" : "❌ Inactif"}` })
        .setTimestamp()],
      ephemeral: true,
    });
  }

  if (sub === "charger-defaults") {
    const existing = getConfig(guildId).antiInsultWords;
    const merged = [...new Set([...existing, ...DEFAULT_INSULT_WORDS])];
    setAntiInsultWords(guildId, merged);
    const added = merged.length - existing.length;
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("✅ Liste française chargée")
        .setDescription(
          `**${added}** nouveaux mots ajoutés depuis la liste prédéfinie.\n` +
          `**Total actuel : ${merged.length} mots** dans le filtre.\n\n` +
          `Couvre : connard·e·s, putain, enculé·e, salope, fdp, ntm, tg, branleur, pédé, imbécile, abruti, et ~${DEFAULT_INSULT_WORDS.length} termes au total avec dérivés.\n\n` +
          `Utilisez \`/antiinsult activer\` si ce n'est pas encore fait.`
        )
        .setTimestamp()],
      ephemeral: true,
    });
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
    const wc = getConfig(guildId).antiInsultWords.length;
    await message.reply(`✅ Anti-insulte **activé**. ${wc === 0 ? "⚠️ Aucun mot — utilisez `&antiinsult charger-defaults`." : `(${wc} mots filtrés)`}`); return;
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
    if (words.length === 0) { await message.reply("ℹ️ Aucun mot filtré. Utilisez `&antiinsult charger-defaults`."); return; }
    const disp = words.map((w) => `\`${w}\``).join(", ");
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle(`🤬 Mots filtrés — ${words.length}`).setDescription(disp.slice(0, 4000)).setTimestamp()] });
    return;
  }
  if (sub === "charger-defaults" || sub === "defaults") {
    const existing = getConfig(guildId).antiInsultWords;
    const merged = [...new Set([...existing, ...DEFAULT_INSULT_WORDS])];
    setAntiInsultWords(guildId, merged);
    await message.reply(`✅ Liste française chargée — **${merged.length}** mots au total dans le filtre.`);
    return;
  }
  await message.reply("Sous-commandes : `activer`, `désactiver`, `ajouter <mot>`, `retirer <mot>`, `liste`, `charger-defaults`");
}
