import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  GuildMember,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { sendBlockedActionDM } from "../dm-notify.js";

const CONFIRM_TIMEOUT_MS = 30_000;

export const data = new SlashCommandBuilder()
  .setName("massban")
  .setDescription("Bannit plusieurs utilisateurs par leurs IDs (séparés par des espaces ou virgules)")
  .addStringOption((o) => o.setName("ids").setDescription("IDs des utilisateurs à bannir (séparés par espaces ou virgules)").setRequired(true))
  .addStringOption((o) => o.setName("raison").setDescription("Raison commune du bannissement"))
  .addIntegerOption((o) => o.setName("supprimer_messages").setDescription("Supprimer les messages des X derniers jours (0-7)").setMinValue(0).setMaxValue(7))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const rawIds = interaction.options.getString("ids", true);
  const reason = interaction.options.getString("raison") ?? "Massban — aucune raison fournie";
  const deleteMessageSeconds = (interaction.options.getInteger("supprimer_messages") ?? 0) * 86400;

  const ids = [...new Set(rawIds.split(/[\s,]+/).map(s => s.replace(/[<@!>]/g, "").trim()).filter(s => /^\d+$/.test(s)))];

  if (ids.length === 0) return interaction.reply({ content: "❌ Aucun ID valide fourni.", ephemeral: true });
  if (ids.length > 50) return interaction.reply({ content: "❌ Maximum 50 IDs par massban.", ephemeral: true });
  if (ids.includes(interaction.user.id)) return interaction.reply({ content: "❌ Vous ne pouvez pas vous inclure dans un massban.", ephemeral: true });

  // ── Embed de confirmation ─────────────────────────────────────────────────
  const preview = ids.length <= 10
    ? ids.map((id) => `\`${id}\``).join("\n")
    : ids.slice(0, 10).map((id) => `\`${id}\``).join("\n") + `\n*…et ${ids.length - 10} autre(s)*`;

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("⚠️ Confirmation requise — Massban")
    .setDescription("Vous êtes sur le point de bannir **plusieurs membres** en une seule action. Cette opération est **irréversible**.\n\nVérifiez la liste ci-dessous avant de confirmer.")
    .addFields(
      { name: "Nombre d'IDs", value: `**${ids.length}**`, inline: true },
      { name: "Suppression messages", value: deleteMessageSeconds > 0 ? `${deleteMessageSeconds / 86400} jour(s)` : "Aucune", inline: true },
      { name: "Raison", value: reason },
      { name: "IDs ciblés", value: preview },
    )
    .setFooter({ text: `Cette confirmation expire dans ${CONFIRM_TIMEOUT_MS / 1000}s · Seul le modérateur peut répondre` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("massban_confirm")
      .setLabel("✅ Confirmer le massban")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("massban_cancel")
      .setLabel("❌ Annuler")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });

  // ── Attente de la confirmation ────────────────────────────────────────────
  let confirmed = false;
  try {
    const btn = await interaction.fetchReply();
    const collector = btn.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: CONFIRM_TIMEOUT_MS,
      max: 1,
    });

    await new Promise<void>((resolve) => {
      collector.on("collect", async (i) => {
        confirmed = i.customId === "massban_confirm";
        await i.deferUpdate();
        resolve();
      });
      collector.on("end", (_collected, reason) => {
        if (reason === "time") resolve();
      });
    });
  } catch {
    return interaction.editReply({ content: "❌ Impossible de collecter la réponse.", components: [], embeds: [] });
  }

  if (!confirmed) {
    const cancelEmbed = new EmbedBuilder().setColor(0x6b7280).setTitle("🚫 Massban annulé").setDescription("L'opération a été annulée ou a expiré. Aucun membre n'a été banni.").setTimestamp();
    return interaction.editReply({ embeds: [cancelEmbed], components: [] });
  }

  // ── Exécution ─────────────────────────────────────────────────────────────
  const progressEmbed = new EmbedBuilder().setColor(0xf59e0b).setTitle("⏳ Massban en cours…").setDescription(`Traitement de **${ids.length}** IDs…`);
  await interaction.editReply({ embeds: [progressEmbed], components: [] });

  const moderator = interaction.member as GuildMember | null;
  const results = { success: 0, skipped: 0, failed: 0, skippedTags: [] as string[] };

  for (const id of ids) {
    try {
      const member = await interaction.guild.members.fetch(id).catch(() => null);
      if (member) {
        if (moderator && member.roles.highest.position >= moderator.roles.highest.position) {
          results.skipped++;
          results.skippedTags.push(`${member.user.tag} (rôle trop élevé)`);
          await sendBlockedActionDM(interaction.client, {
            command: "/massban", guildName: interaction.guild.name, guildId: interaction.guildId!,
            moderatorTag: interaction.user.tag, moderatorId: interaction.user.id,
            targetTag: member.user.tag, targetId: member.id,
            blockReason: "Rôle de la cible supérieur ou égal à celui du modérateur",
          });
          continue;
        }
        if (!member.bannable) {
          results.skipped++;
          results.skippedTags.push(`${member.user.tag} (non bannable)`);
          continue;
        }
      }
      await interaction.guild.members.ban(id, { reason: `[MASSBAN] ${reason}`, deleteMessageSeconds });
      results.success++;
    } catch {
      results.failed++;
    }
  }

  const color = results.success > 0 ? 0xef4444 : 0xf59e0b;
  const resultEmbed = new EmbedBuilder().setColor(color).setTitle("🔨 Massban terminé")
    .addFields(
      { name: "IDs traités", value: String(ids.length), inline: true },
      { name: "✅ Bannis", value: String(results.success), inline: true },
      { name: "⏭️ Ignorés", value: String(results.skipped), inline: true },
      { name: "❌ Échecs", value: String(results.failed), inline: true },
      { name: "Raison", value: reason },
      ...(results.skippedTags.length ? [{ name: "Ignorés (détail)", value: results.skippedTags.slice(0, 10).join("\n") }] : []),
    ).setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
  return sendLog(interaction.client, logEmbed(0xef4444, "🔨 Massban", [
    { name: "IDs", value: String(ids.length), inline: true },
    { name: "Bannis", value: String(results.success), inline: true },
    { name: "Raison", value: reason },
  ], { tag: interaction.user.tag, id: interaction.user.id }),
  { guildId: interaction.guildId!, logType: "ban", commandChannelId: interaction.channelId! });
}

export const prefixName = "massban";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("❌ Permission insuffisante."); return;
  }

  const ids = [...new Set(args.map(s => s.replace(/[<@!>]/g, "").trim()).filter(s => /^\d+$/.test(s)))];
  if (ids.length === 0) { await message.reply("Usage : `&massban <id1> <id2> ...` — max 50 IDs."); return; }
  if (ids.length > 50) { await message.reply("❌ Maximum 50 IDs par massban."); return; }

  const reasonArgs = args.filter(s => !/^\d+$/.test(s.replace(/[<@!>]/g, "")));
  const reason = reasonArgs.join(" ") || "Massban — aucune raison fournie";

  const preview = ids.length <= 10
    ? ids.map((id) => `\`${id}\``).join("\n")
    : ids.slice(0, 10).map((id) => `\`${id}\``).join("\n") + `\n*…et ${ids.length - 10} autre(s)*`;

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("⚠️ Confirmation requise — Massban")
    .setDescription("Vous êtes sur le point de bannir **plusieurs membres**. Cette opération est **irréversible**.")
    .addFields(
      { name: "Nombre d'IDs", value: `**${ids.length}**`, inline: true },
      { name: "Raison", value: reason },
      { name: "IDs ciblés", value: preview },
    )
    .setFooter({ text: `Expire dans ${CONFIRM_TIMEOUT_MS / 1000}s · Seul ${message.author.tag} peut répondre` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("massban_confirm_prefix")
      .setLabel("✅ Confirmer le massban")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("massban_cancel_prefix")
      .setLabel("❌ Annuler")
      .setStyle(ButtonStyle.Secondary),
  );

  const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });

  let confirmed = false;
  try {
    const interaction = await confirmMsg.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === message.author.id,
      time: CONFIRM_TIMEOUT_MS,
    });
    confirmed = interaction.customId === "massban_confirm_prefix";
    await interaction.deferUpdate();
  } catch {
    // timeout
  }

  if (!confirmed) {
    const cancelEmbed = new EmbedBuilder().setColor(0x6b7280).setTitle("🚫 Massban annulé").setDescription("Aucun membre n'a été banni.").setTimestamp();
    await confirmMsg.edit({ embeds: [cancelEmbed], components: [] });
    return;
  }

  const progressEmbed = new EmbedBuilder().setColor(0xf59e0b).setTitle("⏳ Massban en cours…").setDescription(`Traitement de **${ids.length}** IDs…`);
  await confirmMsg.edit({ embeds: [progressEmbed], components: [] });

  let success = 0, failed = 0;
  for (const id of ids.slice(0, 50)) {
    try {
      await message.guild.members.ban(id, { reason: `[MASSBAN] ${reason}` });
      success++;
    } catch { failed++; }
  }

  const resultEmbed = new EmbedBuilder().setColor(0xef4444).setTitle("🔨 Massban terminé")
    .addFields(
      { name: "✅ Bannis", value: String(success), inline: true },
      { name: "❌ Échecs", value: String(failed), inline: true },
      { name: "Raison", value: reason },
    ).setTimestamp();

  await confirmMsg.edit({ embeds: [resultEmbed], components: [] });
  await sendLog(message.client, logEmbed(0xef4444, "🔨 Massban", [
    { name: "IDs", value: String(ids.length), inline: true },
    { name: "Bannis", value: String(success), inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }),
  { guildId: message.guild.id, logType: "ban" });
}
