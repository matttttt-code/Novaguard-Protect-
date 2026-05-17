import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildVerificationLevel,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { setRaidMode, isRaidMode } from "../guild-config-store.js";

async function enableRaidMode(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: ChatInputCommandInteraction["client"],
  moderatorTag: string,
  moderatorId: string
): Promise<EmbedBuilder> {
  setRaidMode(guild.id, true);

  const invites = await guild.invites.fetch();
  const deletedInvites = invites.size;
  await Promise.all(invites.map((inv) => inv.delete("Mode Raid activé").catch(() => null)));

  await guild.setVerificationLevel(GuildVerificationLevel.High, "Mode Raid activé").catch(() => null);

  await sendLog(
    client,
    logEmbed(0xef4444, "🚨 Mode Raid ACTIVÉ", [
      { name: "Invitations révoquées", value: String(deletedInvites), inline: true },
      { name: "Vérification", value: "Élevée (téléphone requis)", inline: true },
      { name: "⚠️ Action", value: "Toutes les invitations ont été supprimées. Les nouveaux membres sont bloqués." },
    ], { tag: moderatorTag, id: moderatorId }),
    { guildId: guild.id, pingEveryone: false }
  );

  return new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🚨 Mode Raid ACTIVÉ")
    .setDescription("Le serveur est maintenant protégé contre les raids.")
    .addFields(
      { name: "Invitations révoquées", value: String(deletedInvites), inline: true },
      { name: "Vérification", value: "Élevée", inline: true },
      { name: "Pour désactiver", value: "`/raidmode désactiver` ou `&raidmode off`" }
    )
    .setTimestamp();
}

async function disableRaidMode(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: ChatInputCommandInteraction["client"],
  moderatorTag: string,
  moderatorId: string
): Promise<EmbedBuilder> {
  setRaidMode(guild.id, false);

  await guild.setVerificationLevel(GuildVerificationLevel.Low, "Mode Raid désactivé").catch(() => null);

  await sendLog(
    client,
    logEmbed(0x22c55e, "✅ Mode Raid DÉSACTIVÉ", [
      { name: "Vérification", value: "Remise à la normale (Faible)", inline: true },
    ], { tag: moderatorTag, id: moderatorId }),
    { guildId: guild.id }
  );

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Mode Raid DÉSACTIVÉ")
    .setDescription("Le serveur est de retour en mode normal.")
    .addFields(
      { name: "Vérification", value: "Faible (remise à la normale)", inline: true },
      { name: "Note", value: "Recréez vos invitations si nécessaire." }
    )
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("raidmode")
  .setDescription("Active ou désactive le mode anti-raid du serveur")
  .addStringOption((o) =>
    o.setName("action").setDescription("Activer ou désactiver").setRequired(true)
      .addChoices(
        { name: "✅ Activer", value: "activer" },
        { name: "❌ Désactiver", value: "désactiver" }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const action = interaction.options.getString("action", true);
  await interaction.deferReply();

  const embed =
    action === "activer"
      ? await enableRaidMode(interaction.guild, interaction.client, interaction.user.tag, interaction.user.id)
      : await disableRaidMode(interaction.guild, interaction.client, interaction.user.tag, interaction.user.id);

  return interaction.editReply({ embeds: [embed] });
}

export const prefixName = "raidmode";
export const prefixAliases = ["raid"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const action = args[0]?.toLowerCase();
  const isEnable = ["activer", "on", "enable"].includes(action ?? "");
  const isDisable = ["désactiver", "desactiver", "off", "disable"].includes(action ?? "");

  if (!isEnable && !isDisable) {
    await message.reply("Usage : `&raidmode activer` ou `&raidmode désactiver`"); return;
  }

  const embed = isEnable
    ? await enableRaidMode(message.guild, message.client, message.author.tag, message.author.id)
    : await disableRaidMode(message.guild, message.client, message.author.tag, message.author.id);

  await message.reply({ embeds: [embed] });
}
