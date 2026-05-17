import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  Guild,
} from "discord.js";
import {
  getConfig,
  GuildConfig,
  DEFAULT_WELCOME_MSG,
  DEFAULT_LEAVE_MSG,
} from "../guild-config-store.js";

const DASHBOARD_DOMAIN = process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "";
const DASHBOARD_URL = DASHBOARD_DOMAIN ? `https://${DASHBOARD_DOMAIN}/dashboard` : null;

export function buildDashboardEmbed(config: GuildConfig, guild: Guild): EmbedBuilder {
  const bool = (v: boolean, on = "✅ Activé", off = "❌ Désactivé") => (v ? on : off);
  const chan = (id: string | null) => (id ? `<#${id}>` : "*Non défini*");
  const role = (id: string | null) => (id ? `<@&${id}>` : "*Non défini*");
  const truncate = (s: string, n = 50) => (s.length > n ? s.slice(0, n) + "…" : s);

  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🛠️ Dashboard — " + guild.name)
    .setThumbnail(guild.iconURL() ?? null)
    .addFields(
      {
        name: "👋 Messages d'arrivée",
        value:
          `**Statut :** ${bool(config.welcomeEnabled)}\n` +
          `**Salon :** ${chan(config.welcomeChannelId)}\n` +
          `**Message :** \`${truncate(config.welcomeMessage)}\``,
        inline: true,
      },
      {
        name: "🚪 Messages de départ",
        value:
          `**Statut :** ${bool(config.leaveEnabled)}\n` +
          `**Salon :** ${chan(config.leaveChannelId)}\n` +
          `**Message :** \`${truncate(config.leaveMessage)}\``,
        inline: true,
      },
      { name: "\u200B", value: "\u200B", inline: false },
      {
        name: "🤖 Captcha anti-bot",
        value:
          `**Statut :** ${bool(config.captchaEnabled)}\n` +
          `**Salon vérif. :** ${chan(config.captchaChannelId)}\n` +
          `**Rôle non-vérifié :** ${role(config.captchaUnverifiedRoleId)}\n` +
          `**Rôle vérifié :** ${role(config.captchaVerifiedRoleId)}`,
        inline: true,
      },
      {
        name: "🛡️ Sécurité",
        value:
          `**Join Lock :** ${bool(config.joinLock, "🔒 Actif — arrivées bloquées", "🔓 Inactif")}\n` +
          `**Mode Raid :** ${bool(config.raidMode, "🚨 Actif — nouveaux membres expulsés", "✅ Inactif")}\n` +
          `**DM Sanctions :** ${bool(config.sanctionDmEnabled, "📨 ON", "🔕 OFF")}`,
        inline: true,
      },
      { name: "\u200B", value: "\u200B", inline: false },
      {
        name: "📋 Logs & Salons",
        value:
          `**Logs principal :** ${chan(config.logChannelId)}\n` +
          `**Logs bans :** ${chan(config.banLogChannelId)}\n` +
          `**Logs généraux :** ${chan(config.generalLogChannelId)}\n` +
          `**Logs invitations :** ${chan(config.inviteLogChannelId)}`,
        inline: true,
      },
      {
        name: "🎫 Tickets",
        value:
          `**Rôle staff :** ${config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : "*Non défini*"}\n` +
          `**Catégorie :** ${config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : "*Non définie*"}\n` +
          `**Transcripts :** ${chan(config.transcriptChannelId)}`,
        inline: true,
      },
    )
    .setFooter({
      text: `Config persistante par serveur · ${guild.memberCount} membres · Utilisez les boutons`,
      iconURL: guild.iconURL() ?? undefined,
    })
    .setTimestamp();
}

export function buildDashboardRows(config: GuildConfig): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("dash_welcome_toggle")
      .setLabel(config.welcomeEnabled ? "✅ Arrivée ON" : "❌ Arrivée OFF")
      .setStyle(config.welcomeEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("dash_welcome_channel")
      .setLabel("📍 Salon arrivée")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_welcome_msg")
      .setLabel("📝 Message arrivée")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_reset_welcome_msg")
      .setLabel("🔄 Reset arrivée")
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("dash_leave_toggle")
      .setLabel(config.leaveEnabled ? "✅ Départ ON" : "❌ Départ OFF")
      .setStyle(config.leaveEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("dash_leave_channel")
      .setLabel("📍 Salon départ")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_leave_msg")
      .setLabel("📝 Message départ")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_reset_leave_msg")
      .setLabel("🔄 Reset départ")
      .setStyle(ButtonStyle.Danger),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("dash_captcha_toggle")
      .setLabel(config.captchaEnabled ? "🤖 Captcha ON" : "🤖 Captcha OFF")
      .setStyle(config.captchaEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("dash_captcha_channel")
      .setLabel("📍 Salon vérif.")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_captcha_unverified_role")
      .setLabel("🔴 Rôle non-vérifié")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_captcha_verified_role")
      .setLabel("🟢 Rôle vérifié")
      .setStyle(ButtonStyle.Primary),
  );

  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("dash_raid_toggle")
      .setLabel(config.raidMode ? "🚨 Raid ON" : "🛡️ Raid OFF")
      .setStyle(config.raidMode ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("dash_joinlock_toggle")
      .setLabel(config.joinLock ? "🔒 JoinLock ON" : "🔓 JoinLock OFF")
      .setStyle(config.joinLock ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("dash_sanction_dm_toggle")
      .setLabel(config.sanctionDmEnabled ? "📨 DM Sanctions ON" : "🔕 DM Sanctions OFF")
      .setStyle(config.sanctionDmEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel("🌐 Dashboard Web")
      .setStyle(ButtonStyle.Link)
      .setURL(DASHBOARD_URL ?? "https://discord.com")
      .setDisabled(!DASHBOARD_URL),
  );

  const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("dash_log_channel")
      .setLabel("📋 Logs principal")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_banlog_channel")
      .setLabel("🔨 Logs bans")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_genlog_channel")
      .setLabel("🗂️ Logs généraux")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dash_invitelog_channel")
      .setLabel("📨 Logs invitations")
      .setStyle(ButtonStyle.Primary),
  );

  return [row1, row2, row3, row4, row5];
}

export const data = new SlashCommandBuilder()
  .setName("dashboard")
  .setDescription("Panneau de configuration interactif du bot (Admin uniquement)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const config = getConfig(interaction.guild.id);
  const embed = buildDashboardEmbed(config, interaction.guild);
  const rows = buildDashboardRows(config);

  return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
}

export const prefixName = "dashboard";
export const prefixAliases = ["config", "panel"];

export async function executeMessage(message: Message) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Seuls les administrateurs peuvent accéder au dashboard.");
    return;
  }

  const config = getConfig(message.guild.id);
  const embed = buildDashboardEmbed(config, message.guild);
  const rows = buildDashboardRows(config);

  await message.reply({ embeds: [embed], components: rows });
}
