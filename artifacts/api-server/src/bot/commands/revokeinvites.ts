import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { getConfig } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("revokeinvites")
  .setDescription("Révoque toutes les invitations actives du serveur (sauf celles protégées)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function revokeAll(guild: NonNullable<ChatInputCommandInteraction["guild"]>): Promise<{ revoked: number; skipped: number }> {
  const invites = await guild.invites.fetch();
  const whitelist = getConfig(guild.id).whitelistedInviteCodes;
  let revoked = 0;
  let skipped = 0;
  await Promise.all(invites.map(async (inv) => {
    if (whitelist.includes(inv.code)) { skipped++; return; }
    await inv.delete("Révocation massive par modération").catch(() => null);
    revoked++;
  }));
  return { revoked, skipped };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  await interaction.deferReply();
  const { revoked, skipped } = await revokeAll(interaction.guild);

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔗 Invitations révoquées")
    .addFields(
      { name: "Révoquées", value: String(revoked), inline: true },
      { name: "Protégées (ignorées)", value: String(skipped), inline: true },
      { name: "Modérateur", value: interaction.user.tag, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  return sendLog(
    interaction.client,
    logEmbed(0xef4444, "🔗 Invitations révoquées", [
      { name: "Révoquées", value: String(revoked), inline: true },
      { name: "Protégées (ignorées)", value: String(skipped), inline: true },
    ], { tag: interaction.user.tag, id: interaction.user.id }),
    { guildId: interaction.guildId ?? undefined }
  );
}

export const prefixName = "revokeinvites";
export const prefixAliases = ["delinvites", "clearinvites"];

export async function executeMessage(message: Message) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Permission insuffisante (ManageGuild requise)."); return;
  }

  const { revoked, skipped } = await revokeAll(message.guild);

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔗 Invitations révoquées")
    .addFields(
      { name: "Révoquées", value: String(revoked), inline: true },
      { name: "Protégées (ignorées)", value: String(skipped), inline: true },
      { name: "Modérateur", value: message.author.tag, inline: true }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });

  await sendLog(
    message.client,
    logEmbed(0xef4444, "🔗 Invitations révoquées", [
      { name: "Révoquées", value: String(revoked), inline: true },
      { name: "Protégées (ignorées)", value: String(skipped), inline: true },
      { name: "Via", value: "Commande préfixe", inline: true },
    ], { tag: message.author.tag, id: message.author.id }),
    { guildId: message.guildId ?? undefined }
  );
}
