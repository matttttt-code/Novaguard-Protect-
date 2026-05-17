import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  Message,
} from "discord.js";
import { setInviteLogChannel } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("setinvitelog")
  .setDescription("Définit le salon pour les logs d'invitations (qui a invité qui)")
  .addChannelOption((o) =>
    o.setName("salon")
      .setDescription("Salon de logs d'invitations")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const ch = interaction.options.getChannel("salon");

  if (!ch) {
    setInviteLogChannel(interaction.guildId, null);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x6b7280)
        .setTitle("🔕 Logs d'invitations désactivés")
        .setDescription("Aucun salon n'est plus défini pour les logs d'invitations.")
        .setTimestamp()],
      ephemeral: true,
    });
    return;
  }

  setInviteLogChannel(interaction.guildId, ch.id);
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Logs d'invitations configurés")
      .setDescription(`Les arrivées avec détection d'invitation seront loguées dans <#${ch.id}>.`)
      .setTimestamp()],
    ephemeral: true,
  });
}

export const prefixName = "setinvitelog";
export const prefixAliases = ["setinvlog"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Commande réservée aux administrateurs."); return;
  }

  if (!args[0] || args[0] === "off") {
    setInviteLogChannel(message.guild.id, null);
    await message.reply("🔕 Logs d'invitations désactivés.");
    return;
  }

  const channelId = args[0]!.replace(/[<#>]/g, "");
  const ch = message.guild.channels.cache.get(channelId);
  if (!ch) { await message.reply("❌ Salon introuvable."); return; }

  setInviteLogChannel(message.guild.id, ch.id);
  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Logs d'invitations configurés")
      .setDescription(`Les logs d'invitations seront envoyés dans <#${ch.id}>.`)
      .setTimestamp()],
  });
}
