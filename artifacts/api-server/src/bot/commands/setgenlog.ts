import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  Message,
} from "discord.js";
import { setGeneralLogChannel } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("setgenlog")
  .setDescription("Définit le salon de logs généraux (vocal, messages, rôles, salons…)")
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Le salon de logs généraux").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const channel = interaction.options.getChannel("salon") as TextChannel | null;

  if (!channel) {
    setGeneralLogChannel(interaction.guildId, null);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x6b7280).setTitle("🗂️ Logs généraux désactivés")
        .setDescription("Le salon de logs généraux a été retiré.").setTimestamp()],
      ephemeral: true,
    });
  }

  if (!channel.isTextBased()) {
    return interaction.reply({ content: "❌ Ce salon n'est pas un salon texte.", ephemeral: true });
  }

  setGeneralLogChannel(interaction.guildId, channel.id);

  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("✅ Logs généraux configurés")
      .addFields(
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Événements", value: "Vocal · Messages · Salons · Rôles · Membres · Bans · Invitations", inline: false },
      ).setTimestamp()],
  });
}

export const prefixName = "setgenlog";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const rawId = args[0]?.replace(/[<#>]/g, "");
  if (!rawId) {
    setGeneralLogChannel(message.guild.id, null);
    await message.reply("✅ Logs généraux désactivés.");
    return;
  }

  const channel = message.guild.channels.cache.get(rawId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    await message.reply("❌ Salon introuvable ou invalide. Usage : `&setgenlog #salon` ou `&setgenlog` pour désactiver.");
    return;
  }

  setGeneralLogChannel(message.guild.id, channel.id);

  await message.reply({
    embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("✅ Logs généraux configurés")
      .addFields({ name: "Salon", value: `<#${channel.id}>`, inline: true }).setTimestamp()],
  });
}
