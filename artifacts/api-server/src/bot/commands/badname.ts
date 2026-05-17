import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildMember,
} from "discord.js";
import { getBadnameConfig, setBadnameConfig, shouldRename } from "../badname-store.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("badname")
  .setDescription("Renommer automatiquement les membres avec un pseudo problématique")
  .addSubcommand((sub) => sub.setName("activer").setDescription("Activer le filtre de pseudo"))
  .addSubcommand((sub) => sub.setName("désactiver").setDescription("Désactiver le filtre de pseudo"))
  .addSubcommand((sub) =>
    sub.setName("config")
      .setDescription("Configurer le filtre")
      .addBooleanOption((o) => o.setName("hoist").setDescription("Bloquer les caractères hoist (!, «, », ...) en début de pseudo"))
      .addStringOption((o) => o.setName("remplacement").setDescription("Pseudo de remplacement (défaut : Modéré)").setMaxLength(32))
  )
  .addSubcommand((sub) =>
    sub.setName("mot_interdit")
      .setDescription("Ajouter ou retirer un mot interdit dans les pseudos")
      .addStringOption((o) => o.setName("mot").setDescription("Mot interdit (insensible à la casse)").setRequired(true))
      .addBooleanOption((o) => o.setName("retirer").setDescription("Retirer le mot de la liste ?"))
  )
  .addSubcommand((sub) =>
    sub.setName("scan")
      .setDescription("Scanner et renommer tous les membres non conformes maintenant")
  )
  .addSubcommand((sub) => sub.setName("info").setDescription("Voir la configuration actuelle"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "activer") {
    setBadnameConfig(guildId, { enabled: true });
    return interaction.reply({ content: "✅ Filtre de pseudo **activé**. Les nouveaux membres seront vérifiés à l'arrivée.", ephemeral: true });
  }
  if (sub === "désactiver") {
    setBadnameConfig(guildId, { enabled: false });
    return interaction.reply({ content: "✅ Filtre de pseudo **désactivé**.", ephemeral: true });
  }
  if (sub === "config") {
    const patch: Parameters<typeof setBadnameConfig>[1] = {};
    const hoist = interaction.options.getBoolean("hoist");
    const remplacement = interaction.options.getString("remplacement");
    if (hoist !== null) patch.hoistChars = hoist;
    if (remplacement) patch.replacement = remplacement;
    const updated = setBadnameConfig(guildId, patch);
    return interaction.reply({ content: `✅ Config : hoist **${updated.hoistChars ? "ON" : "OFF"}** | Remplacement : **${updated.replacement}**.`, ephemeral: true });
  }
  if (sub === "mot_interdit") {
    const mot = interaction.options.getString("mot", true).toLowerCase();
    const retirer = interaction.options.getBoolean("retirer") ?? false;
    const cfg = getBadnameConfig(guildId);
    const newList = retirer
      ? cfg.bannedWords.filter((w) => w !== mot)
      : [...new Set([...cfg.bannedWords, mot])];
    setBadnameConfig(guildId, { bannedWords: newList });
    return interaction.reply({ content: retirer ? `✅ **${mot}** retiré de la liste.` : `✅ **${mot}** ajouté à la liste des mots interdits.`, ephemeral: true });
  }
  if (sub === "scan") {
    await interaction.deferReply({ ephemeral: true });
    const cfg = getBadnameConfig(guildId);
    if (!cfg.enabled) return interaction.editReply("❌ Le filtre de pseudo est désactivé. Active-le d'abord.");
    const members = await interaction.guild.members.fetch();
    let renamed = 0;
    for (const [, member] of members) {
      if (member.user.bot) continue;
      if (!member.manageable) continue;
      const name = member.nickname ?? member.user.displayName;
      if (shouldRename(name, guildId)) {
        try {
          await member.setNickname(cfg.replacement, "Badname — scan manuel");
          renamed++;
        } catch { /* pas de permission */ }
      }
    }
    await sendLog(interaction.client, logEmbed(0x6366f1, "✏️ Badname — Scan manuel", [
      { name: "Membres renommés", value: String(renamed), inline: true },
      { name: "Remplacement", value: cfg.replacement, inline: true },
    ], { tag: interaction.user.tag, id: interaction.user.id }), { guildId });
    return interaction.editReply(`✅ Scan terminé : **${renamed}** membre(s) renommé(s).`);
  }
  if (sub === "info") {
    const cfg = getBadnameConfig(guildId);
    const embed = new EmbedBuilder().setColor(0x6366f1).setTitle("✏️ Configuration Badname")
      .addFields(
        { name: "Statut", value: cfg.enabled ? "✅ Activé" : "❌ Désactivé", inline: true },
        { name: "Anti-hoist", value: cfg.hoistChars ? "✅ Oui" : "❌ Non", inline: true },
        { name: "Pseudo de remplacement", value: `\`${cfg.replacement}\``, inline: true },
        { name: `Mots interdits (${cfg.bannedWords.length})`, value: cfg.bannedWords.length ? cfg.bannedWords.map((w) => `\`${w}\``).join(", ") : "*Aucun*" },
      ).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "badname";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
    await message.reply("❌ Permission insuffisante."); return;
  }
  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;
  if (!sub) { await message.reply("Usage : `&badname activer|désactiver|info|scan`"); return; }
  if (sub === "activer") { setBadnameConfig(guildId, { enabled: true }); await message.reply("✅ Filtre pseudo **activé**."); return; }
  if (sub === "désactiver") { setBadnameConfig(guildId, { enabled: false }); await message.reply("✅ Filtre pseudo **désactivé**."); return; }
  if (sub === "info") {
    const cfg = getBadnameConfig(guildId);
    await message.reply(`Badname : ${cfg.enabled ? "✅" : "❌"} | Hoist : ${cfg.hoistChars ? "✅" : "❌"} | Remplacement : \`${cfg.replacement}\` | Mots : ${cfg.bannedWords.length}`); return;
  }
  await message.reply("Sous-commandes : `activer`, `désactiver`, `info`, `scan`, `config`, `mot_interdit`.");
}

// ── Fonction utilitaire appelée au GuildMemberAdd et GuildMemberUpdate ────────
export async function checkAndRenameMember(member: GuildMember): Promise<void> {
  if (member.user.bot || !member.manageable) return;
  const name = member.nickname ?? member.user.displayName;
  if (!shouldRename(name, member.guild.id)) return;
  const cfg = getBadnameConfig(member.guild.id);
  try {
    await member.setNickname(cfg.replacement, "Badname — pseudo non conforme");
    await sendLog(member.client, logEmbed(0x6366f1, "✏️ Badname — Pseudo renommé automatiquement", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Pseudo original", value: name, inline: true },
      { name: "Nouveau pseudo", value: cfg.replacement, inline: true },
    ], { tag: "Auto-Mod", id: "0" }), { guildId: member.guild.id });
  } catch { /* pas de permission ou membre parti */ }
}
