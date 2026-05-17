import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  TextChannel,
} from "discord.js";
import { buildInviteEmbed } from "../invite-tracker.js";
import { getConfig } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("testinviteembed")
  .setDescription("Envoie un aperçu de l'embed de log d'invitations (Admin)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function sendTest(
  client: { channels: { fetch: (id: string) => Promise<unknown> } },
  guildId: string,
  guildName: string,
  userId: string,
  userTag: string,
  avatarUrl: string,
  memberCount: number,
  replyFn: (opts: { embeds: EmbedBuilder[]; content?: string }) => Promise<unknown>,
): Promise<void> {
  const createdTimestamp = Date.now() - 15 * 24 * 3600 * 1000; // Simule compte de 15 jours

  const embed = buildInviteEmbed({
    userId,
    userTag,
    avatarUrl,
    createdTimestamp,
    accountAgeDays: 15,
    accountAgeHours: 15 * 24,
    memberCount,
    guildName,
    inviterUser: { id: userId, tag: userTag, displayAvatarURL: () => avatarUrl } as never,
    inviterId: userId,
    usedCode: "AbCdEf",
    iStats: { invited: 12, left: 3 },
    noInviteReason: null,
  });

  const cfg = getConfig(guildId);

  if (cfg.inviteLogChannelId) {
    try {
      const ch = await client.channels.fetch(cfg.inviteLogChannelId);
      if (ch && (ch as TextChannel).isTextBased?.()) {
        await (ch as TextChannel).send({ embeds: [embed] });
        await replyFn({ content: `✅ Aperçu envoyé dans <#${cfg.inviteLogChannelId}>.`, embeds: [] });
        return;
      }
    } catch { /* ignore */ }
  }

  // Aucun salon configuré : envoyer ici directement
  await replyFn({ embeds: [embed] });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) { await interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true }); return; }

  await interaction.deferReply({ ephemeral: true });

  await sendTest(
    interaction.client,
    interaction.guild.id,
    interaction.guild.name,
    interaction.user.id,
    interaction.user.tag,
    interaction.user.displayAvatarURL({ size: 256 }),
    interaction.guild.memberCount,
    (opts) => interaction.editReply(opts),
  );
}

export const prefixName = "testinviteembed";
export const prefixAliases = ["testinvite", "tinv"];

export async function executeMessage(message: Message) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Commande réservée aux administrateurs."); return;
  }

  const cfg = getConfig(message.guild.id);
  const embed = buildInviteEmbed({
    userId: message.author.id,
    userTag: message.author.tag,
    avatarUrl: message.author.displayAvatarURL({ size: 256 }),
    createdTimestamp: Date.now() - 15 * 24 * 3600 * 1000,
    accountAgeDays: 15,
    accountAgeHours: 360,
    memberCount: message.guild.memberCount,
    guildName: message.guild.name,
    inviterUser: message.author as never,
    inviterId: message.author.id,
    usedCode: "AbCdEf",
    iStats: { invited: 12, left: 3 },
    noInviteReason: null,
  });

  if (cfg.inviteLogChannelId) {
    try {
      const ch = await message.client.channels.fetch(cfg.inviteLogChannelId);
      if (ch?.isTextBased()) {
        await (ch as TextChannel).send({ embeds: [embed] });
        await message.reply(`✅ Aperçu envoyé dans <#${cfg.inviteLogChannelId}>.`);
        return;
      }
    } catch { /* ignore */ }
  }

  await message.reply({ embeds: [embed] });
}
