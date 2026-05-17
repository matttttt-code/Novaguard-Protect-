import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { sendBlockedActionDM } from "../dm-notify.js";

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

  await interaction.deferReply();

  const moderator = interaction.member as import("discord.js").GuildMember | null;
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
  const embed = new EmbedBuilder().setColor(color).setTitle("🔨 Massban")
    .addFields(
      { name: "IDs traités", value: String(ids.length), inline: true },
      { name: "Bannis", value: String(results.success), inline: true },
      { name: "Ignorés", value: String(results.skipped), inline: true },
      { name: "Échecs", value: String(results.failed), inline: true },
      { name: "Raison", value: reason },
      ...(results.skippedTags.length ? [{ name: "Ignorés (détail)", value: results.skippedTags.slice(0, 10).join("\n") }] : []),
    ).setTimestamp();

  await interaction.editReply({ embeds: [embed] });
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
  if (ids.length === 0) { await message.reply("Usage : `&massban <id1> <id2> ... [raison]`"); return; }

  const reasonArgs = args.filter(s => !/^\d+$/.test(s.replace(/[<@!>]/g, "")));
  const reason = reasonArgs.join(" ") || "Massban — aucune raison fournie";

  await message.reply(`⏳ Massban en cours pour **${ids.length}** IDs…`);

  let success = 0, failed = 0;
  for (const id of ids.slice(0, 50)) {
    try {
      await message.guild.members.ban(id, { reason: `[MASSBAN] ${reason}` });
      success++;
    } catch { failed++; }
  }

  await message.reply(`✅ Massban terminé : **${success}** bannis, **${failed}** échecs.`);
  await sendLog(message.client, logEmbed(0xef4444, "🔨 Massban", [
    { name: "IDs", value: String(ids.length), inline: true },
    { name: "Bannis", value: String(success), inline: true },
    { name: "Raison", value: reason },
    { name: "Via", value: "Commande préfixe", inline: true },
  ], { tag: message.author.tag, id: message.author.id }),
  { guildId: message.guild.id, logType: "ban" });
}
