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

export function buildDashboardEmbed(config: GuildConfig, guild: Guild): EmbedBuilder {
  const bool = (v: boolean) => (v ? "✅ Activé" : "❌ Désactivé");
  const chan = (id: string | null) => (id ? `<#${id}>` : "Non défini");
  const role = (id: string | null) => (id ? `<@&${id}>` : "Non défini");
  const truncate = (s: string, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s);

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
        inline: false,
      },
      {
        name: "🚪 Messages de départ",
        value:
          `**Statut :** ${bool(config.leaveEnabled)}\n` +
          `**Salon :** ${chan(config.leaveChannelId)}\n` +
          `**Message :** \`${truncate(config.leaveMessage)}\``,
        inline: false,
      },
      {
        name: "🤖 Captcha anti-bot",
        value:
          `**Statut :** ${bool(config.captchaEnabled)}\n` +
          `**Rôle non-vérifié :** ${role(config.captchaUnverifiedRoleId)}\n` +
          `**Rôle vérifié :** ${role(config.captchaVerifiedRoleId)}\n` +
          `*Math challenge en DM — 3 tentatives, 5 min*`,
        inline: false,
      },
      {
        name: "🛡️ Sécurité",
        value:
          `**Join Lock :** ${bool(config.joinLock)}\n` +
          `**Mode Raid :** ${bool(config.raidMode)}\n` +
          `**Salon de logs :** ${chan(config.logChannelId)}\n` +
          `**Salon ban-logs :** ${chan(config.banLogChannelId)}`,
        inline: false,
      },
      {
        name: "🎫 Tickets",
        value:
          `**Rôle staff :** ${config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : "Non défini"}\n` +
          `**Catégorie :** ${config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : "Non définie"}\n` +
          `**Transcripts :** ${chan(config.transcriptChannelId)}`,
        inline: false,
      },
      {
        name: "💡 Variables disponibles pour les messages",
        value: "`{user}` = mention · `{username}` = nom · `{server}` = serveur · `{count}` = nb membres",
        inline: false,
      }
    )
    .setFooter({ text: "Utilisez les boutons ci-dessous pour configurer le bot." })
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
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("dash_captcha_toggle")
      .setLabel(config.captchaEnabled ? "🤖 Captcha ON" : "🤖 Captcha OFF")
      .setStyle(config.captchaEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
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
      .setCustomId("dash_reset_welcome_msg")
      .setLabel("🔄 Reset msg arrivée")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("dash_reset_leave_msg")
      .setLabel("🔄 Reset msg départ")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2, row3, row4];
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
