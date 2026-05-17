import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildMember,
  Client,
} from "discord.js";
import { getAutokickConfig, setAutokickConfig } from "../autokick-store.js";
import { getWarnings } from "../warnings-store.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM } from "../dm-notify.js";

export const data = new SlashCommandBuilder()
  .setName("autokick")
  .setDescription("Configurer l'action automatique après X avertissements")
  .addSubcommand((sub) =>
    sub.setName("activer").setDescription("Activer l'action automatique")
  )
  .addSubcommand((sub) =>
    sub.setName("désactiver").setDescription("Désactiver l'action automatique")
  )
  .addSubcommand((sub) =>
    sub.setName("config")
      .setDescription("Configurer le seuil et l'action")
      .addIntegerOption((o) => o.setName("seuil").setDescription("Nombre d'avertissements avant action (défaut: 3)").setMinValue(1).setMaxValue(20))
      .addStringOption((o) => o.setName("action").setDescription("Action à effectuer").addChoices(
        { name: "Kick (expulsion)", value: "kick" },
        { name: "Ban (bannissement)", value: "ban" },
        { name: "Timeout", value: "timeout" },
      ))
      .addIntegerOption((o) => o.setName("timeout_heures").setDescription("Durée du timeout en heures (si action = timeout)").setMinValue(1).setMaxValue(672))
  )
  .addSubcommand((sub) =>
    sub.setName("info").setDescription("Voir la configuration actuelle")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const cfg = getAutokickConfig(interaction.guildId);

  if (sub === "activer") {
    setAutokickConfig(interaction.guildId, { enabled: true });
    return interaction.reply({ content: `✅ Action automatique **activée** (seuil : **${cfg.warnThreshold}** warns → **${cfg.action}**).`, ephemeral: true });
  }
  if (sub === "désactiver") {
    setAutokickConfig(interaction.guildId, { enabled: false });
    return interaction.reply({ content: "✅ Action automatique **désactivée**.", ephemeral: true });
  }
  if (sub === "config") {
    const patch: Parameters<typeof setAutokickConfig>[1] = {};
    const seuil = interaction.options.getInteger("seuil");
    const action = interaction.options.getString("action") as "kick" | "ban" | "timeout" | null;
    const timeoutH = interaction.options.getInteger("timeout_heures");
    if (seuil) patch.warnThreshold = seuil;
    if (action) patch.action = action;
    if (timeoutH) patch.timeoutHours = timeoutH;
    const updated = setAutokickConfig(interaction.guildId, patch);
    const actionLabels = { kick: "Expulsion", ban: "Bannissement", timeout: `Timeout ${updated.timeoutHours}h` };
    return interaction.reply({ content: `✅ Config mise à jour : **${updated.warnThreshold}** warns → **${actionLabels[updated.action]}**.`, ephemeral: true });
  }
  if (sub === "info") {
    const c = getAutokickConfig(interaction.guildId);
    const actionLabels = { kick: "Expulsion", ban: "Bannissement", timeout: `Timeout ${c.timeoutHours}h` };
    const embed = new EmbedBuilder().setColor(0xf97316).setTitle("⚡ Configuration Auto-Action")
      .addFields(
        { name: "Statut", value: c.enabled ? "✅ Activé" : "❌ Désactivé", inline: true },
        { name: "Seuil", value: `**${c.warnThreshold}** avertissements`, inline: true },
        { name: "Action", value: actionLabels[c.action], inline: true },
      ).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "autokick";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Permission insuffisante."); return;
  }
  const sub = args[0]?.toLowerCase();
  if (!sub) { await message.reply("Usage : `&autokick activer|désactiver|info|config`"); return; }
  const guildId = message.guild.id;
  if (sub === "activer") { setAutokickConfig(guildId, { enabled: true }); await message.reply("✅ Auto-action **activée**."); return; }
  if (sub === "désactiver") { setAutokickConfig(guildId, { enabled: false }); await message.reply("✅ Auto-action **désactivée**."); return; }
  if (sub === "info") {
    const c = getAutokickConfig(guildId);
    await message.reply(`Auto-action : ${c.enabled ? "✅" : "❌"} | Seuil : ${c.warnThreshold} warns | Action : ${c.action}`); return;
  }
  await message.reply("Sous-commandes : `activer`, `désactiver`, `info`, `config`.");
}

// ── Hook appelé après chaque warn ────────────────────────────────────────────
export async function checkAutoAction(
  client: Client,
  guildId: string,
  member: GuildMember,
  moderatorTag: string,
): Promise<void> {
  const cfg = getAutokickConfig(guildId);
  if (!cfg.enabled) return;

  const total = getWarnings(guildId, member.id).length;
  if (total < cfg.warnThreshold) return;

  const reason = `Auto-action — ${total} avertissements atteints (seuil : ${cfg.warnThreshold})`;

  try {
    if (cfg.action === "kick") {
      if (!member.kickable) return;
      await sendSanctionDM(member.user, "automod-kick", reason, member.guild);
      await member.kick(reason);
      await sendLog(client, logEmbed(0xef4444, "⚡ Auto-Kick — Seuil d'avertissements atteint", [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Warns", value: String(total), inline: true },
        { name: "Seuil", value: String(cfg.warnThreshold), inline: true },
        { name: "Déclencheur", value: moderatorTag, inline: true },
      ], { tag: "Auto-Mod", id: "0" }), { guildId });

    } else if (cfg.action === "ban") {
      if (!member.bannable) return;
      await sendSanctionDM(member.user, "ban", reason, member.guild);
      await member.ban({ reason });
      await sendLog(client, logEmbed(0xef4444, "⚡ Auto-Ban — Seuil d'avertissements atteint", [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Warns", value: String(total), inline: true },
        { name: "Seuil", value: String(cfg.warnThreshold), inline: true },
      ], { tag: "Auto-Mod", id: "0" }), { guildId, logType: "ban" });

    } else if (cfg.action === "timeout") {
      if (!member.moderatable) return;
      const ms = cfg.timeoutHours * 3_600_000;
      await member.timeout(ms, reason);
      await sendSanctionDM(member.user, "automod-timeout", reason, member.guild, `Durée : ${cfg.timeoutHours}h`);
      await sendLog(client, logEmbed(0xf97316, "⚡ Auto-Timeout — Seuil d'avertissements atteint", [
        { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: "Warns", value: String(total), inline: true },
        { name: "Durée", value: `${cfg.timeoutHours}h`, inline: true },
      ], { tag: "Auto-Mod", id: "0" }), { guildId });
    }
  } catch { /* membre parti entre-temps */ }
}
