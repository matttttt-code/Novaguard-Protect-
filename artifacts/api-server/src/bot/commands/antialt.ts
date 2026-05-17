import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildMember,
} from "discord.js";
import { getAntialtConfig, setAntialtConfig } from "../antialt-store.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM } from "../dm-notify.js";

export const data = new SlashCommandBuilder()
  .setName("antialt")
  .setDescription("Bloquer les comptes Discord trop récents (comptes alternatifs / faux comptes)")
  .addSubcommand((sub) => sub.setName("activer").setDescription("Activer la vérification d'âge de compte"))
  .addSubcommand((sub) => sub.setName("désactiver").setDescription("Désactiver la vérification d'âge de compte"))
  .addSubcommand((sub) =>
    sub.setName("config")
      .setDescription("Configurer le seuil et l'action")
      .addIntegerOption((o) => o.setName("jours").setDescription("Âge minimum du compte en jours").setRequired(true).setMinValue(1).setMaxValue(365))
      .addStringOption((o) => o.setName("action").setDescription("Action si trop récent").addChoices(
        { name: "Kick (expulsion)", value: "kick" },
        { name: "Ban (bannissement)", value: "ban" },
      ))
  )
  .addSubcommand((sub) => sub.setName("info").setDescription("Voir la configuration actuelle"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "activer") {
    const cfg = getAntialtConfig(guildId);
    setAntialtConfig(guildId, { enabled: true });
    return interaction.reply({ content: `✅ Anti-alt **activé** (seuil : **${cfg.minAgeDays}** jours → **${cfg.action}**).`, ephemeral: true });
  }
  if (sub === "désactiver") {
    setAntialtConfig(guildId, { enabled: false });
    return interaction.reply({ content: "✅ Anti-alt **désactivé**.", ephemeral: true });
  }
  if (sub === "config") {
    const jours = interaction.options.getInteger("jours", true);
    const action = interaction.options.getString("action") as "kick" | "ban" | null;
    const updated = setAntialtConfig(guildId, { minAgeDays: jours, ...(action ? { action } : {}) });
    return interaction.reply({ content: `✅ Config : compte de moins de **${updated.minAgeDays}** jours → **${updated.action}**.`, ephemeral: true });
  }
  if (sub === "info") {
    const cfg = getAntialtConfig(guildId);
    const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle("🛡️ Configuration Anti-Alt")
      .addFields(
        { name: "Statut", value: cfg.enabled ? "✅ Activé" : "❌ Désactivé", inline: true },
        { name: "Âge minimum", value: `**${cfg.minAgeDays}** jours`, inline: true },
        { name: "Action", value: cfg.action === "kick" ? "Expulsion" : "Bannissement", inline: true },
      ).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "antialt";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Permission insuffisante."); return;
  }
  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;
  if (!sub) { await message.reply("Usage : `&antialt activer|désactiver|info|config <jours>`"); return; }
  if (sub === "activer") { setAntialtConfig(guildId, { enabled: true }); await message.reply("✅ Anti-alt **activé**."); return; }
  if (sub === "désactiver") { setAntialtConfig(guildId, { enabled: false }); await message.reply("✅ Anti-alt **désactivé**."); return; }
  if (sub === "info") {
    const cfg = getAntialtConfig(guildId);
    await message.reply(`Anti-alt : ${cfg.enabled ? "✅" : "❌"} | Min : **${cfg.minAgeDays}j** | Action : **${cfg.action}**`); return;
  }
  if (sub === "config") {
    const jours = parseInt(args[1] ?? "", 10);
    if (isNaN(jours) || jours < 1) { await message.reply("❌ Nombre de jours invalide."); return; }
    const action = args[2] as "kick" | "ban" | undefined;
    setAntialtConfig(guildId, { minAgeDays: jours, ...(action && ["kick", "ban"].includes(action) ? { action } : {}) });
    await message.reply(`✅ Config mise à jour : **${jours}j** minimum.`); return;
  }
  await message.reply("Sous-commandes : `activer`, `désactiver`, `info`, `config <jours> [kick|ban]`.");
}

// ── Fonction utilitaire appelée au GuildMemberAdd ─────────────────────────────
export async function checkAntiAlt(member: GuildMember): Promise<boolean> {
  const cfg = getAntialtConfig(member.guild.id);
  if (!cfg.enabled) return false;

  const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
  if (ageDays >= cfg.minAgeDays) return false;

  const reason = `Anti-alt — compte créé il y a ${ageDays}j (minimum : ${cfg.minAgeDays}j)`;

  try {
    if (cfg.action === "ban") {
      await sendSanctionDM(member.user, "ban", reason, member.guild);
      await member.ban({ reason });
    } else {
      await sendSanctionDM(member.user, "automod-kick", reason, member.guild);
      await member.kick(reason);
    }

    await sendLog(member.client, logEmbed(0x8b5cf6, `🛡️ Anti-Alt — ${cfg.action === "ban" ? "Ban" : "Kick"} automatique`, [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Âge du compte", value: `${ageDays} jour(s)`, inline: true },
      { name: "Minimum requis", value: `${cfg.minAgeDays} jour(s)`, inline: true },
      { name: "Action", value: cfg.action === "ban" ? "Banni" : "Expulsé", inline: true },
    ], { tag: "Anti-Alt", id: "0" }), { guildId: member.guild.id, logType: cfg.action === "ban" ? "ban" : "general" });
  } catch { /* impossible de kick/ban */ }

  return true;
}
