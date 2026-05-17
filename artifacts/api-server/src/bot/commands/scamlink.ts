import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  Client,
  Events,
  GuildMember,
} from "discord.js";
import {
  getScamlinkConfig,
  setScamlinkConfig,
  isScamDomain,
  BUILTIN_SCAM_DOMAINS,
} from "../scamlink-store.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM } from "../dm-notify.js";
import { addWarning } from "../warnings-store.js";
import { logger } from "../../lib/logger.js";

const LINK_REGEX = /https?:\/\/([^/\s]+)|www\.([^/\s]+)/gi;

export const data = new SlashCommandBuilder()
  .setName("scamlink")
  .setDescription("Protection contre les liens de scam connus (nitro fake, steam fake…)")
  .addSubcommand((sub) =>
    sub.setName("activer").setDescription("Activer la protection scam")
  )
  .addSubcommand((sub) =>
    sub.setName("désactiver").setDescription("Désactiver la protection scam")
  )
  .addSubcommand((sub) =>
    sub.setName("action")
      .setDescription("Choisir l'action appliquée sur l'auteur")
      .addStringOption((o) => o.setName("type").setDescription("Action").setRequired(true)
        .addChoices(
          { name: "Supprimer uniquement", value: "delete" },
          { name: "Supprimer + Avertissement", value: "warn" },
          { name: "Supprimer + Timeout", value: "timeout" },
          { name: "Supprimer + Ban", value: "ban" },
        ))
      .addIntegerOption((o) => o.setName("durée").setDescription("Durée du timeout en minutes (si action = timeout)").setMinValue(1).setMaxValue(10080))
  )
  .addSubcommand((sub) =>
    sub.setName("ajouter")
      .setDescription("Ajouter un domaine de scam personnalisé")
      .addStringOption((o) => o.setName("domaine").setDescription("Domaine (ex: fake-nitro.xyz)").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("retirer")
      .setDescription("Retirer un domaine personnalisé")
      .addStringOption((o) => o.setName("domaine").setDescription("Domaine à retirer").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("info").setDescription("Voir la configuration et la liste de base")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "activer") {
    setScamlinkConfig(guildId, { enabled: true });
    return interaction.reply({ content: "✅ Protection anti-scam **activée**.", ephemeral: true });
  }
  if (sub === "désactiver") {
    setScamlinkConfig(guildId, { enabled: false });
    return interaction.reply({ content: "✅ Protection anti-scam **désactivée**.", ephemeral: true });
  }
  if (sub === "action") {
    const type = interaction.options.getString("type", true) as "delete" | "warn" | "timeout" | "ban";
    const dur = interaction.options.getInteger("durée") ?? 60;
    setScamlinkConfig(guildId, { action: type, timeoutMinutes: dur });
    const labels = { delete: "Suppression", warn: "Warn", timeout: `Timeout ${dur}min`, ban: "Ban" };
    return interaction.reply({ content: `✅ Action configurée : **${labels[type]}**.`, ephemeral: true });
  }
  if (sub === "ajouter") {
    const domain = interaction.options.getString("domaine", true).toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!;
    const cfg = getScamlinkConfig(guildId);
    if (cfg.customDomains.includes(domain)) return interaction.reply({ content: `❌ **${domain}** est déjà dans la liste.`, ephemeral: true });
    setScamlinkConfig(guildId, { customDomains: [...cfg.customDomains, domain] });
    return interaction.reply({ content: `✅ **${domain}** ajouté à la liste de scam.`, ephemeral: true });
  }
  if (sub === "retirer") {
    const domain = interaction.options.getString("domaine", true).toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!;
    const cfg = getScamlinkConfig(guildId);
    setScamlinkConfig(guildId, { customDomains: cfg.customDomains.filter((d) => d !== domain) });
    return interaction.reply({ content: `✅ **${domain}** retiré de la liste personnalisée.`, ephemeral: true });
  }
  if (sub === "info") {
    const cfg = getScamlinkConfig(guildId);
    const actionLabels = { delete: "Suppression", warn: "Warn", timeout: `Timeout ${cfg.timeoutMinutes}min`, ban: "Ban" };
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle("🚨 Protection Anti-Scam")
      .addFields(
        { name: "Statut", value: cfg.enabled ? "✅ Activé" : "❌ Désactivé", inline: true },
        { name: "Action", value: actionLabels[cfg.action], inline: true },
        { name: `Domaines intégrés (${BUILTIN_SCAM_DOMAINS.length})`, value: BUILTIN_SCAM_DOMAINS.slice(0, 10).map((d) => `\`${d}\``).join(", ") + (BUILTIN_SCAM_DOMAINS.length > 10 ? `… +${BUILTIN_SCAM_DOMAINS.length - 10}` : "") },
        { name: `Domaines personnalisés (${cfg.customDomains.length})`, value: cfg.customDomains.length ? cfg.customDomains.map((d) => `\`${d}\``).join(", ") : "*Aucun*" },
      ).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "scamlink";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Permission insuffisante."); return;
  }
  const sub = args[0]?.toLowerCase();
  if (!sub) { await message.reply("Usage : `&scamlink activer|désactiver|info|ajouter <domaine>`"); return; }
  const guildId = message.guild.id;
  if (sub === "activer") { setScamlinkConfig(guildId, { enabled: true }); await message.reply("✅ Anti-scam **activé**."); return; }
  if (sub === "désactiver") { setScamlinkConfig(guildId, { enabled: false }); await message.reply("✅ Anti-scam **désactivé**."); return; }
  if (sub === "ajouter") {
    const domain = args[1]?.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    if (!domain) { await message.reply("❌ Domaine manquant."); return; }
    const cfg = getScamlinkConfig(guildId);
    setScamlinkConfig(guildId, { customDomains: [...new Set([...cfg.customDomains, domain])] });
    await message.reply(`✅ **${domain}** ajouté.`); return;
  }
  if (sub === "info") {
    const cfg = getScamlinkConfig(guildId);
    await message.reply(`Anti-scam : ${cfg.enabled ? "✅" : "❌"} | Action : **${cfg.action}** | Domaines perso : ${cfg.customDomains.length}`); return;
  }
  await message.reply("Sous-commandes : `activer`, `désactiver`, `ajouter`, `retirer`, `info`.");
}

// ── Listener MessageCreate ────────────────────────────────────────────────────
export function registerScamLinkDetection(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || !message.guildId) return;
    const member = message.member as GuildMember | null;
    if (!member) return;
    if (member.permissions.has("ManageMessages")) return;

    const cfg = getScamlinkConfig(message.guildId);
    if (!cfg.enabled) return;

    const matches = [...message.content.matchAll(LINK_REGEX)];
    if (matches.length === 0) return;

    let detected = false;
    for (const m of matches) {
      const domain = (m[1] ?? m[2] ?? "").toLowerCase();
      if (isScamDomain(domain, message.guildId)) { detected = true; break; }
    }
    if (!detected) return;

    const reason = "Lien de scam détecté (nitro/steam fake)";

    try {
      await message.delete().catch(() => null);

      if (cfg.action === "warn") {
        addWarning(message.guildId, member.id, { reason, moderator: "Anti-Scam", moderatorId: client.user!.id, timestamp: new Date() });
        await sendSanctionDM(member.user, "automod-warn", reason, message.guild);
      } else if (cfg.action === "timeout") {
        if (member.moderatable) {
          await member.timeout(cfg.timeoutMinutes * 60_000, reason);
          await sendSanctionDM(member.user, "automod-timeout", reason, message.guild, `Durée : ${cfg.timeoutMinutes}min`);
        }
      } else if (cfg.action === "ban") {
        if (member.bannable) {
          await sendSanctionDM(member.user, "ban", reason, message.guild);
          await member.ban({ reason });
        }
      }

      await sendLog(client, logEmbed(0xef4444, "🚨 Lien de scam détecté", [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Action", value: cfg.action, inline: true },
        { name: "Salon", value: `<#${message.channelId}>`, inline: true },
        { name: "Message (extrait)", value: message.content.slice(0, 200) },
      ], { tag: "Anti-Scam", id: "0" }), { guildId: message.guildId, logType: cfg.action === "ban" ? "ban" : "general" });
    } catch (err) {
      logger.error({ err }, "[scamlink] Erreur lors du traitement");
    }
  });
}
