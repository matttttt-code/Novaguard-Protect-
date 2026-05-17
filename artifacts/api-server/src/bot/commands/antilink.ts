import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getAntilinkConfig, setAntilinkConfig } from "../antilink-store.js";

export const data = new SlashCommandBuilder()
  .setName("antilink")
  .setDescription("Configurer le filtre anti-lien")
  .addSubcommand((sub) =>
    sub.setName("activer").setDescription("Activer le filtre anti-lien")
  )
  .addSubcommand((sub) =>
    sub.setName("désactiver").setDescription("Désactiver le filtre anti-lien")
  )
  .addSubcommand((sub) =>
    sub.setName("action")
      .setDescription("Choisir l'action à effectuer sur un lien détecté")
      .addStringOption((o) => o.setName("type").setDescription("Action").setRequired(true)
        .addChoices(
          { name: "Supprimer uniquement", value: "delete" },
          { name: "Supprimer + Avertissement", value: "warn" },
          { name: "Supprimer + Timeout", value: "timeout" },
        ))
      .addIntegerOption((o) => o.setName("durée").setDescription("Durée du timeout en minutes (si action = timeout)").setMinValue(1).setMaxValue(1440))
  )
  .addSubcommand((sub) =>
    sub.setName("whitelist")
      .setDescription("Ajouter ou retirer un domaine de la liste blanche")
      .addStringOption((o) => o.setName("domaine").setDescription("Domaine autorisé (ex: discord.gg, youtube.com)").setRequired(true))
      .addBooleanOption((o) => o.setName("retirer").setDescription("Retirer le domaine de la liste blanche ?"))
  )
  .addSubcommand((sub) =>
    sub.setName("info").setDescription("Voir la configuration actuelle")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const config = getAntilinkConfig(interaction.guildId);

  if (sub === "activer") {
    setAntilinkConfig(interaction.guildId, { enabled: true });
    return interaction.reply({ content: "✅ Filtre anti-lien **activé**.", ephemeral: true });
  }

  if (sub === "désactiver") {
    setAntilinkConfig(interaction.guildId, { enabled: false });
    return interaction.reply({ content: "✅ Filtre anti-lien **désactivé**.", ephemeral: true });
  }

  if (sub === "action") {
    const type = interaction.options.getString("type", true) as "delete" | "warn" | "timeout";
    const duration = interaction.options.getInteger("durée") ?? config.timeoutMinutes;
    setAntilinkConfig(interaction.guildId, { action: type, timeoutMinutes: duration });
    const labels = { delete: "Suppression uniquement", warn: "Suppression + Avertissement", timeout: "Suppression + Timeout" };
    return interaction.reply({ content: `✅ Action configurée : **${labels[type]}**${type === "timeout" ? ` (${duration} min)` : ""}.`, ephemeral: true });
  }

  if (sub === "whitelist") {
    const domain = interaction.options.getString("domaine", true).toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!;
    const remove = interaction.options.getBoolean("retirer") ?? false;
    const domains = remove
      ? config.allowedDomains.filter((d) => d !== domain)
      : [...new Set([...config.allowedDomains, domain])];
    setAntilinkConfig(interaction.guildId, { allowedDomains: domains });
    return interaction.reply({ content: remove ? `✅ **${domain}** retiré de la liste blanche.` : `✅ **${domain}** ajouté à la liste blanche.`, ephemeral: true });
  }

  if (sub === "info") {
    const cfg = getAntilinkConfig(interaction.guildId);
    const actionLabels = { delete: "Suppression", warn: "Suppression + Warn", timeout: "Suppression + Timeout" };
    const embed = new EmbedBuilder().setColor(0x6366f1).setTitle("🔗 Configuration Anti-Lien")
      .addFields(
        { name: "Statut", value: cfg.enabled ? "✅ Activé" : "❌ Désactivé", inline: true },
        { name: "Action", value: actionLabels[cfg.action], inline: true },
        ...(cfg.action === "timeout" ? [{ name: "Durée timeout", value: `${cfg.timeoutMinutes} min`, inline: true }] : []),
        { name: "Domaines autorisés", value: cfg.allowedDomains.length ? cfg.allowedDomains.map((d) => `\`${d}\``).join(", ") : "*Aucun — tous les liens sont bloqués*" },
      ).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "antilink";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Permission insuffisante."); return;
  }

  const sub = args[0]?.toLowerCase();
  if (!sub) { await message.reply("Usage : `&antilink activer|désactiver|info|whitelist <domaine>`"); return; }

  const guildId = message.guild.id;

  if (sub === "activer") { setAntilinkConfig(guildId, { enabled: true }); await message.reply("✅ Anti-lien **activé**."); return; }
  if (sub === "désactiver") { setAntilinkConfig(guildId, { enabled: false }); await message.reply("✅ Anti-lien **désactivé**."); return; }
  if (sub === "whitelist") {
    const domain = args[1]?.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    if (!domain) { await message.reply("❌ Domaine manquant. Ex: `&antilink whitelist discord.gg`"); return; }
    const cfg = getAntilinkConfig(guildId);
    const domains = cfg.allowedDomains.includes(domain)
      ? cfg.allowedDomains.filter((d) => d !== domain)
      : [...new Set([...cfg.allowedDomains, domain])];
    setAntilinkConfig(guildId, { allowedDomains: domains });
    await message.reply(cfg.allowedDomains.includes(domain) ? `✅ **${domain}** retiré.` : `✅ **${domain}** ajouté.`); return;
  }
  if (sub === "info") {
    const cfg = getAntilinkConfig(guildId);
    await message.reply(`Anti-lien : ${cfg.enabled ? "✅ Activé" : "❌ Désactivé"} | Action : ${cfg.action} | Domaines : ${cfg.allowedDomains.join(", ") || "aucun"}`); return;
  }

  await message.reply("Sous-commandes : `activer`, `désactiver`, `whitelist`, `info`");
}
