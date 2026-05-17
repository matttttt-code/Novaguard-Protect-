import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  GuildMember,
} from "discord.js";
import {
  addInviteBlacklist,
  removeInviteBlacklist,
  isInviteBlacklisted,
  getInviteBlacklist,
} from "../invite-blacklist-store.js";
import { sendLog, logEmbed } from "../log.js";

// ──── Sous-commandes : ajouter, retirer, liste ────

export const data = new SlashCommandBuilder()
  .setName("blacklistinvite")
  .setDescription("Gère la blacklist d'invitations (empêche un membre d'inviter sans l'expulser)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s
      .setName("ajouter")
      .setDescription("Empêche un membre de créer des invitations")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre à restreindre").setRequired(true))
      .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("retirer")
      .setDescription("Retire la restriction d'invitation d'un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre à libérer").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("liste").setDescription("Affiche tous les membres restreints d'inviter sur ce serveur")
  );

// ──── Slash ────

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guild.id;

  if (sub === "ajouter") {
    const user = interaction.options.getUser("membre", true);
    const raison = interaction.options.getString("raison", true);

    if (user.id === interaction.user.id)
      return interaction.reply({ content: "❌ Vous ne pouvez pas vous restreindre vous-même.", ephemeral: true });

    if (isInviteBlacklisted(guildId, user.id))
      return interaction.reply({ content: "❌ Ce membre est déjà dans la blacklist d'invitations.", ephemeral: true });

    await interaction.deferReply();

    // Révoquer toutes les invitations existantes de ce membre
    let revoked = 0;
    try {
      const invites = await interaction.guild.invites.fetch();
      for (const [, inv] of invites) {
        if (inv.inviter?.id === user.id) {
          await inv.delete("Invite blacklist").catch(() => null);
          revoked++;
        }
      }
    } catch { /* pas la permission ManageGuild */ }

    addInviteBlacklist(guildId, {
      userId: user.id,
      userTag: user.tag,
      reason: raison,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      timestamp: new Date().toISOString(),
    });

    await sendLog(
      interaction.client,
      logEmbed(0xf97316, "🚫 Blacklist invitation ajouté", [
        { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
        { name: "Invitations révoquées", value: `${revoked}`, inline: true },
        { name: "Raison", value: raison },
      ], { tag: interaction.user.tag, id: interaction.user.id }),
      { guildId }
    );

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf97316)
          .setTitle("🚫 Blacklist invitation")
          .setDescription(`**${user.tag}** ne peut plus créer d'invitation sur ce serveur.\nIl reste présent mais ses invitations seront supprimées automatiquement.`)
          .addFields(
            { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
            { name: "Invitations révoquées", value: `**${revoked}**`, inline: true },
            { name: "Raison", value: raison },
          )
          .setTimestamp(),
      ],
    });
  }

  if (sub === "retirer") {
    const user = interaction.options.getUser("membre", true);
    if (!isInviteBlacklisted(guildId, user.id))
      return interaction.reply({ content: "❌ Ce membre n'est pas dans la blacklist d'invitations.", ephemeral: true });

    removeInviteBlacklist(guildId, user.id);

    await sendLog(
      interaction.client,
      logEmbed(0x22c55e, "✅ Blacklist invitation retiré", [
        { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      ], { tag: interaction.user.tag, id: interaction.user.id }),
      { guildId }
    );

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle("✅ Restriction levée")
          .setDescription(`**${user.tag}** peut de nouveau créer des invitations.`)
          .setTimestamp(),
      ],
    });
  }

  // liste
  const list = getInviteBlacklist(guildId);
  if (list.length === 0)
    return interaction.reply({ content: "✅ Aucun membre restreint d'inviter sur ce serveur.", ephemeral: true });

  const lines = list.map(
    (e, i) =>
      `**${i + 1}.** ${e.userTag} (\`${e.userId}\`)\n` +
      `  ↳ *${e.reason}* — par ${e.moderatorTag} — <t:${Math.floor(new Date(e.timestamp).getTime() / 1000)}:R>`
  );

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle(`🚫 Blacklist invitations — ${list.length} membre(s)`)
    .setDescription(lines.slice(0, 20).join("\n\n"))
    .setFooter({ text: list.length > 20 ? `Affichage limité à 20 / ${list.length}` : `${list.length} membre(s) restreint(s)` })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// ──── Préfixe ────

export const prefixName = "blacklistinvite";
export const prefixAliases = ["bliv", "invitebl", "ibl"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Vous devez avoir la permission **Gérer le serveur** pour utiliser cette commande.");
    return;
  }

  const guildId = message.guild.id;
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === "liste") {
    const list = getInviteBlacklist(guildId);
    if (list.length === 0) { await message.reply("✅ Aucun membre restreint d'inviter."); return; }

    const lines = list.map(
      (e, i) =>
        `**${i + 1}.** ${e.userTag} (\`${e.userId}\`) — *${e.reason}* par ${e.moderatorTag}`
    );
    const embed = new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle(`🚫 Blacklist invitations — ${list.length} membre(s)`)
      .setDescription(lines.slice(0, 20).join("\n"))
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    return;
  }

  if (sub === "retirer") {
    const rawId = args[1]?.replace(/[<@!>]/g, "");
    if (!rawId || !/^\d+$/.test(rawId)) {
      await message.reply("Usage : `&bliv retirer @membre`"); return;
    }
    if (!isInviteBlacklisted(guildId, rawId)) {
      await message.reply("❌ Ce membre n'est pas dans la blacklist d'invitations."); return;
    }
    let tag = rawId;
    try { const u = await message.client.users.fetch(rawId); tag = u.tag; } catch { /* ignore */ }
    removeInviteBlacklist(guildId, rawId);
    await sendLog(
      message.client,
      logEmbed(0x22c55e, "✅ Blacklist invitation retiré", [
        { name: "Membre", value: `${tag} (\`${rawId}\`)`, inline: true },
      ], { tag: message.author.tag, id: message.author.id }),
      { guildId }
    );
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("✅ Restriction levée").setDescription(`**${tag}** peut de nouveau créer des invitations.`).setTimestamp()] });
    return;
  }

  if (sub === "ajouter") {
    const rawId = args[1]?.replace(/[<@!>]/g, "");
    if (!rawId || !/^\d+$/.test(rawId)) {
      await message.reply("Usage : `&bliv ajouter @membre raison`"); return;
    }
    if (rawId === message.author.id) { await message.reply("❌ Vous ne pouvez pas vous restreindre vous-même."); return; }
    if (isInviteBlacklisted(guildId, rawId)) { await message.reply("❌ Ce membre est déjà dans la blacklist d'invitations."); return; }

    const raison = args.slice(2).join(" ") || "Aucune raison fournie";

    let member: GuildMember | null = null;
    try { member = await message.guild.members.fetch(rawId); } catch { /* peut ne pas être sur le serveur */ }
    const user = member?.user ?? await message.client.users.fetch(rawId).catch(() => null);
    if (!user) { await message.reply("❌ Utilisateur introuvable."); return; }

    let revoked = 0;
    try {
      const invites = await message.guild.invites.fetch();
      for (const [, inv] of invites) {
        if (inv.inviter?.id === user.id) {
          await inv.delete("Invite blacklist").catch(() => null);
          revoked++;
        }
      }
    } catch { /* pas la permission */ }

    addInviteBlacklist(guildId, {
      userId: user.id,
      userTag: user.tag,
      reason: raison,
      moderatorTag: message.author.tag,
      moderatorId: message.author.id,
      timestamp: new Date().toISOString(),
    });

    await sendLog(
      message.client,
      logEmbed(0xf97316, "🚫 Blacklist invitation ajouté", [
        { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
        { name: "Invitations révoquées", value: `${revoked}`, inline: true },
        { name: "Raison", value: raison },
      ], { tag: message.author.tag, id: message.author.id }),
      { guildId }
    );

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf97316)
          .setTitle("🚫 Blacklist invitation")
          .setDescription(`**${user.tag}** ne peut plus créer d'invitation.\nSes futures invitations seront supprimées automatiquement.`)
          .addFields(
            { name: "Invitations révoquées", value: `**${revoked}**`, inline: true },
            { name: "Raison", value: raison },
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  await message.reply("Usage : `&bliv ajouter @membre raison` · `&bliv retirer @membre` · `&bliv liste`");
}
