import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Client,
} from "discord.js";
import {
  getConfig,
  setSecurityLevel,
  setSuspiciousCheckEnabled,
} from "../guild-config-store.js";
import { addPendingLevel3 } from "../security-pending-store.js";
import { sendLogDM, LOG_DM_USER_ID } from "../dm-notify.js";

const LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "🟢 Niveau 1 — Normal",
  2: "🟡 Niveau 2 — Élevé",
  3: "🔴 Niveau 3 — Maximum",
};

const LEVEL_DESC: Record<1 | 2 | 3, string> = {
  1: "Automod standard (spam, émojis, liens, majuscules)",
  2: "Niveau 1 + anti-insulte (timeout 1h) + alerte comptes <3 jours",
  3: "Niveau 2 + anti-webhook auto + anti-insulte (timeout 24h) + alerte comptes <7j + approbation owner requise",
};

export function buildSecureEmbed(guildId: string, guildName: string): EmbedBuilder {
  const cfg = getConfig(guildId);
  const lvl = cfg.securityLevel;

  const on = "✅";
  const off = "❌";

  const secFields = [
    { name: "🔒 Niveau de sécurité", value: `${LEVEL_LABELS[lvl]}\n*${LEVEL_DESC[lvl]}*` },
    {
      name: "🤬 Anti-insulte",
      value: `${cfg.antiInsultEnabled ? on : off} ${cfg.antiInsultEnabled ? "Actif" : "Inactif"} — ${cfg.antiInsultWords.length} mot(s) filtré(s)`,
      inline: true,
    },
    {
      name: "🔗 Anti-webhook",
      value: `${cfg.antiWebhookEnabled ? on : off} ${cfg.antiWebhookEnabled ? "Actif" : "Inactif"}`,
      inline: true,
    },
    {
      name: "🕵️ Détection comptes suspects",
      value: `${cfg.suspiciousCheckEnabled ? on : off} ${cfg.suspiciousCheckEnabled ? "Actif" : "Inactif"}`,
      inline: true,
    },
    {
      name: "🛡️ Mode Raid",
      value: `${cfg.raidMode ? on : off} ${cfg.raidMode ? "Actif" : "Inactif"}`,
      inline: true,
    },
    {
      name: "🔒 Join Lock",
      value: `${cfg.joinLock ? on : off} ${cfg.joinLock ? "Actif" : "Inactif"}`,
      inline: true,
    },
    {
      name: "🤖 Captcha",
      value: `${cfg.captchaEnabled ? on : off} ${cfg.captchaEnabled ? "Actif" : "Inactif"}`,
      inline: true,
    },
    {
      name: "📋 Invitations protégées",
      value: cfg.whitelistedInviteCodes.length > 0
        ? `${cfg.whitelistedInviteCodes.length} code(s) : ${cfg.whitelistedInviteCodes.map(c => `\`${c}\``).join(", ")}`
        : "Aucune invitation protégée",
    },
    {
      name: "📢 Salon logs principal",
      value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "*Non configuré*",
      inline: true,
    },
    {
      name: "📢 Logs généraux",
      value: cfg.generalLogChannelId ? `<#${cfg.generalLogChannelId}>` : "*Non configuré*",
      inline: true,
    },
    {
      name: "📨 DM Sanctions",
      value: `${cfg.sanctionDmEnabled ? on : off} ${cfg.sanctionDmEnabled ? "Actifs" : "Désactivés"}`,
      inline: true,
    },
  ];

  return new EmbedBuilder()
    .setColor(lvl === 3 ? 0xef4444 : lvl === 2 ? 0xf59e0b : 0x22c55e)
    .setTitle(`🔐 Configuration Sécurité — ${guildName}`)
    .addFields(secFields)
    .setFooter({ text: "Utilisez /secure niveau, /antiinsult, /antiwebhook, /whitelistinvite pour modifier" })
    .setTimestamp();
}

async function sendLevel3ApprovalDM(client: Client, guildId: string, guildName: string, requesterId: string, requesterTag: string, channelId: string): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`sec_approve:${guildId}`).setLabel("✅ Approuver niveau 3").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sec_deny:${guildId}`).setLabel("❌ Refuser").setStyle(ButtonStyle.Danger),
  );

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔴 Demande d'activation — Niveau 3 (Maximum)")
    .setDescription("Un administrateur demande l'activation du niveau de sécurité maximum.")
    .addFields(
      { name: "Serveur", value: `${guildName} (\`${guildId}\`)`, inline: true },
      { name: "Demandeur", value: `${requesterTag} (\`${requesterId}\`)`, inline: true },
      { name: "Effets", value: LEVEL_DESC[3] },
    )
    .setFooter({ text: "Cette demande expire dans 15 minutes." })
    .setTimestamp();

  addPendingLevel3({ guildId, guildName, requesterId, requesterTag, channelId, timestamp: Date.now() });

  const owner = await client.users.fetch(LOG_DM_USER_ID).catch(() => null);
  if (owner) await owner.send({ embeds: [embed], components: [row] }).catch(() => null);
}

export const data = new SlashCommandBuilder()
  .setName("secure")
  .setDescription("Configuration de sécurité du serveur")
  .addSubcommand((s) => s.setName("voir").setDescription("Affiche toute la configuration de sécurité"))
  .addSubcommand((s) =>
    s.setName("niveau")
      .setDescription("Définit le niveau de sécurité (3 = approbation owner requise)")
      .addIntegerOption((o) =>
        o.setName("valeur").setDescription("Niveau 1 (normal) · 2 (élevé) · 3 (maximum)").setRequired(true)
          .addChoices({ name: "1 — Normal", value: 1 }, { name: "2 — Élevé", value: 2 }, { name: "3 — Maximum", value: 3 })
      )
  )
  .addSubcommand((s) =>
    s.setName("suspicieux")
      .setDescription("Active/désactive la détection de comptes suspects à l'arrivée")
      .addStringOption((o) =>
        o.setName("action").setDescription("activer ou désactiver").setRequired(true)
          .addChoices({ name: "Activer", value: "on" }, { name: "Désactiver", value: "off" })
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === "voir") {
    return interaction.reply({ embeds: [buildSecureEmbed(guildId, interaction.guild.name)] });
  }

  if (sub === "niveau") {
    const val = interaction.options.getInteger("valeur", true) as 1 | 2 | 3;
    const current = getConfig(guildId).securityLevel;

    if (val === current) {
      return interaction.reply({ content: `ℹ️ Le serveur est déjà au niveau **${val}**.`, ephemeral: true });
    }

    if (val === 3) {
      await interaction.reply({
        content: "⏳ Demande d'activation du niveau 3 envoyée au propriétaire du bot. En attente d'approbation (15 min).",
        ephemeral: true,
      });
      await sendLevel3ApprovalDM(interaction.client, guildId, interaction.guild.name, interaction.user.id, interaction.user.tag, interaction.channelId);
      return;
    }

    setSecurityLevel(guildId, val);
    return interaction.reply({ embeds: [buildSecureEmbed(guildId, interaction.guild.name)] });
  }

  if (sub === "suspicieux") {
    const action = interaction.options.getString("action", true);
    setSuspiciousCheckEnabled(guildId, action === "on");
    return interaction.reply({ content: `${action === "on" ? "✅" : "❌"} Détection de comptes suspects **${action === "on" ? "activée" : "désactivée"}**.`, ephemeral: true });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "secure";
export const prefixAliases = ["secu", "security"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;

  if (!sub || sub === "voir") {
    await message.reply({ embeds: [buildSecureEmbed(guildId, message.guild.name)] }); return;
  }

  if (sub === "niveau") {
    const val = parseInt(args[1] ?? "") as 1 | 2 | 3;
    if (![1, 2, 3].includes(val)) { await message.reply("❌ Valeur invalide. Choisir 1, 2 ou 3."); return; }
    if (val === 3) {
      await message.reply("⏳ Demande d'activation du niveau 3 envoyée au propriétaire du bot. En attente d'approbation (15 min).");
      await sendLevel3ApprovalDM(message.client, guildId, message.guild.name, message.author.id, message.author.tag, message.channelId);
      return;
    }
    setSecurityLevel(guildId, val);
    await message.reply({ embeds: [buildSecureEmbed(guildId, message.guild.name)] }); return;
  }

  if (sub === "suspicieux") {
    const action = args[1]?.toLowerCase();
    if (action !== "on" && action !== "off") { await message.reply("Usage : `&secure suspicieux on|off`"); return; }
    setSuspiciousCheckEnabled(guildId, action === "on");
    await message.reply(`${action === "on" ? "✅" : "❌"} Détection de comptes suspects **${action === "on" ? "activée" : "désactivée"}**.`); return;
  }

  await message.reply("Sous-commandes : `voir`, `niveau <1|2|3>`, `suspicieux <on|off>`");
}
