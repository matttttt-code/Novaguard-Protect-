import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildVerificationLevel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { setRaidMode, isRaidMode, setRaidMode2, isRaidMode2, getConfig } from "../guild-config-store.js";
import { sendLogDM, LOG_DM_USER_ID, requestAdminDMApproval } from "../dm-notify.js";
import { addPendingRaid2, getPendingRaid2, removePendingRaid2 } from "../raid2-pending-store.js";

async function enableRaidMode(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: ChatInputCommandInteraction["client"],
  moderatorTag: string,
  moderatorId: string
): Promise<EmbedBuilder> {
  setRaidMode(guild.id, true);

  const whitelist = getConfig(guild.id).whitelistedInviteCodes;
  const allInvites = await guild.invites.fetch();
  const toDelete = allInvites.filter(inv => !whitelist.includes(inv.code));
  const deletedInvites = toDelete.size;
  await Promise.all(toDelete.map(inv => inv.delete("Mode Raid activé").catch(() => null)));

  await guild.setVerificationLevel(GuildVerificationLevel.High, "Mode Raid activé").catch(() => null);

  await sendLog(
    client,
    logEmbed(0xef4444, "🚨 Mode Raid ACTIVÉ", [
      { name: "Invitations révoquées", value: String(deletedInvites), inline: true },
      { name: "Invitations protégées", value: String(whitelist.length), inline: true },
      { name: "Vérification", value: "Élevée (téléphone requis)", inline: true },
      { name: "⚠️ Action", value: "Les invitations non-protégées ont été supprimées. Les nouveaux membres sont bloqués." },
    ], { tag: moderatorTag, id: moderatorId }),
    { guildId: guild.id, pingEveryone: true }
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
    .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
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
    .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
    .setTimestamp();
}

export async function requestRaidMode2(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: ChatInputCommandInteraction["client"],
  requesterId: string,
  requesterTag: string
): Promise<EmbedBuilder> {
  if (isRaidMode2(guild.id)) {
    return new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("⚠️ Anti-Raid Niveau 2 déjà actif")
      .setDescription("Le niveau 2 est déjà actif sur ce serveur. Utilisez `désactiver-niveau2` pour le désactiver.")
      .setTimestamp();
  }

  addPendingRaid2({
    guildId: guild.id,
    guildName: guild.name,
    requesterId,
    requesterTag,
    timestamp: Date.now(),
  });

  const dmEmbed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🛡️ Approbation requise — Anti-Raid Niveau 2")
    .setDescription(`**${requesterTag}** demande l'activation de l'**Anti-Raid Niveau 2** sur **${guild.name}**.\n\n⚠️ Quand actif, **tout nouveau salon ou rôle créé sera automatiquement supprimé** jusqu'à désactivation.`)
    .addFields(
      { name: "Serveur", value: `${guild.name} (\`${guild.id}\`)`, inline: true },
      { name: "Demandeur", value: `${requesterTag} (\`${requesterId}\`)`, inline: true },
      { name: "Effet", value: "• Suppression auto de tout salon créé\n• Suppression auto de tout rôle créé\n• Log dans le serveur avec @everyone" },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`raid2_approve:${guild.id}`)
      .setLabel("✅ Approuver")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`raid2_deny:${guild.id}`)
      .setLabel("❌ Refuser")
      .setStyle(ButtonStyle.Danger),
  );

  const owner = await client.users.fetch(LOG_DM_USER_ID).catch(() => null);
  await owner?.send({ embeds: [dmEmbed], components: [row] }).catch(() => null);

  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("⏳ Demande envoyée — Anti-Raid Niveau 2")
    .setDescription("Une demande d'approbation a été envoyée au propriétaire du bot en DM.\nLe niveau 2 sera activé dès validation.")
    .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
    .setTimestamp();
}

async function disableRaidMode2(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: ChatInputCommandInteraction["client"],
  moderatorTag: string,
  moderatorId: string
): Promise<EmbedBuilder> {
  if (!isRaidMode2(guild.id)) {
    return new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("⚠️ Anti-Raid Niveau 2 non actif")
      .setDescription("Le niveau 2 n'est pas actif sur ce serveur.")
      .setTimestamp();
  }
  setRaidMode2(guild.id, false);

  await sendLog(
    client,
    logEmbed(0x22c55e, "✅ Anti-Raid Niveau 2 DÉSACTIVÉ", [
      { name: "Info", value: "Les nouveaux salons et rôles ne seront plus supprimés automatiquement.", inline: false },
    ], { tag: moderatorTag, id: moderatorId }),
    { guildId: guild.id }
  );

  await sendLogDM(client, new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Anti-Raid Niveau 2 désactivé")
    .addFields(
      { name: "Serveur", value: `${guild.name} (\`${guild.id}\`)`, inline: true },
      { name: "Désactivé par", value: `${moderatorTag} (\`${moderatorId}\`)`, inline: true },
    )
    .setTimestamp()
  );

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Anti-Raid Niveau 2 DÉSACTIVÉ")
    .setDescription("Les nouveaux salons et rôles ne seront plus supprimés automatiquement.")
    .setFooter({ text: "🔒 Notification réservée aux administrateurs du serveur" })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("raidmode")
  .setDescription("Gère le mode anti-raid du serveur (niveau 1 et niveau 2)")
  .addStringOption((o) =>
    o.setName("action").setDescription("Action à effectuer").setRequired(true)
      .addChoices(
        { name: "✅ Activer (Niveau 1)", value: "activer" },
        { name: "❌ Désactiver (Niveau 1)", value: "désactiver" },
        { name: "🔴 Activer Niveau 2 (approbation owner requise)", value: "niveau2-activer" },
        { name: "⬇️ Désactiver Niveau 2", value: "niveau2-désactiver" },
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const action = interaction.options.getString("action", true);
  await interaction.deferReply();

  if (action === "niveau2-activer") {
    const embed = await requestRaidMode2(interaction.guild, interaction.client, interaction.user.id, interaction.user.tag);
    return interaction.editReply({ embeds: [embed] });
  }
  if (action === "niveau2-désactiver") {
    const embed = await disableRaidMode2(interaction.guild, interaction.client, interaction.user.tag, interaction.user.id);
    return interaction.editReply({ embeds: [embed] });
  }

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
  const isLevel2Enable = ["niveau2", "niveau2-activer", "n2", "2"].includes(action ?? "") && args[1]?.toLowerCase() !== "off";
  const isLevel2Disable = action === "niveau2-désactiver" || action === "niveau2-desactiver" || (["niveau2", "n2", "2"].includes(action ?? "") && ["off", "désactiver", "desactiver"].includes(args[1]?.toLowerCase() ?? ""));

  if (isLevel2Enable && !isLevel2Disable) {
    const embed = await requestRaidMode2(message.guild, message.client, message.author.id, message.author.tag);
    await message.reply({ embeds: [embed] }); return;
  }
  if (isLevel2Disable) {
    const embed = await disableRaidMode2(message.guild, message.client, message.author.tag, message.author.id);
    await message.reply({ embeds: [embed] }); return;
  }

  if (!isEnable && !isDisable) {
    await message.reply("Usage : `&raidmode activer|désactiver` ou `&raidmode niveau2 activer|désactiver`"); return;
  }

  const embed = isEnable
    ? await enableRaidMode(message.guild, message.client, message.author.tag, message.author.id)
    : await disableRaidMode(message.guild, message.client, message.author.tag, message.author.id);

  await message.reply({ embeds: [embed] });
}

export { getPendingRaid2, removePendingRaid2 };
