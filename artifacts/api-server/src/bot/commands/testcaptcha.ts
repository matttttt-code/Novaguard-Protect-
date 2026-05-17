import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  GuildMember,
  Message,
} from "discord.js";
import { getConfig } from "../guild-config-store.js";
import { generateChallenge, setCaptcha, hasCaptcha, deleteCaptcha } from "../captcha-store.js";
import { captchaTimeouts } from "../captcha-timeout-store.js";

export const data = new SlashCommandBuilder()
  .setName("testcaptcha")
  .setDescription("Teste le système de captcha (aperçu ou simulation complète sans kick)")
  .addBooleanOption((o) =>
    o.setName("apercu").setDescription("Aperçu visuel uniquement (embed éphémère, aucun défi réel)").setRequired(false)
  )
  .addUserOption((o) =>
    o.setName("membre").setDescription("Membre cible pour la simulation (défaut : vous-même)").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function buildCaptchaEmbed(code: string, member: GuildMember, isTest: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(isTest ? 0xf59e0b : 0x5865f2)
    .setTitle(isTest ? "🧪 [TEST] Vérification anti-bot" : "🛡️ Vérification anti-bot")
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      (isTest ? "**(MODE TEST — aucune action réelle)**\n\n" : "") +
      `Bienvenue <@${member.id}> ! Pour accéder au serveur, tape le code suivant dans ce salon :\n\n` +
      `\`\`\`\n${code}\n\`\`\`\n` +
      `> ⏱️ **5 minutes** pour répondre · **3 tentatives** maximum\n` +
      `> Le code est insensible à la casse.`
    )
    .setFooter({ text: `${member.guild.name} • Vérification requise${isTest ? " • TEST" : ""}`, iconURL: member.guild.iconURL() ?? undefined })
    .setTimestamp();
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.guildId) {
    return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });
  }

  const isPreview = interaction.options.getBoolean("apercu") ?? false;
  const targetUser = interaction.options.getUser("membre") ?? interaction.user;
  const guildId = interaction.guildId;

  const gMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!gMember) {
    return interaction.reply({ content: "❌ Membre introuvable sur ce serveur.", ephemeral: true });
  }

  // ── MODE APERÇU ──
  if (isPreview) {
    const { code } = generateChallenge();
    const embed = buildCaptchaEmbed(code, gMember, false)
      .setTitle("👁️ Aperçu — Vérification anti-bot")
      .setColor(0x6366f1);
    return interaction.reply({
      content: "Voici à quoi ressemble le captcha pour les nouveaux membres :",
      embeds: [embed],
      ephemeral: true,
    });
  }

  // ── MODE SIMULATION ──
  const cfg = getConfig(guildId);
  if (!cfg.captchaChannelId) {
    return interaction.reply({
      content: "❌ Aucun salon captcha configuré. Utilise `/setcaptcha` d'abord.",
      ephemeral: true,
    });
  }

  if (hasCaptcha(targetUser.id)) {
    return interaction.reply({
      content: `❌ <@${targetUser.id}> a déjà un captcha en cours. Attends qu'il se termine ou expire.`,
      ephemeral: true,
    });
  }

  let captchaCh: TextChannel | null = null;
  try {
    const ch = await interaction.client.channels.fetch(cfg.captchaChannelId);
    if (ch?.isTextBased()) captchaCh = ch as TextChannel;
  } catch { /* ignore */ }

  if (!captchaCh) {
    return interaction.reply({ content: "❌ Impossible d'accéder au salon captcha configuré.", ephemeral: true });
  }

  const { code } = generateChallenge();
  const embed = buildCaptchaEmbed(code, gMember, true);

  const sent = await captchaCh.send({ content: `<@${targetUser.id}>`, embeds: [embed] });

  setCaptcha(targetUser.id, {
    code,
    guildId,
    attempts: 3,
    challengeMessageId: sent.id,
    isTest: true,
  });

  // Timeout 5 min — nettoyage sans kick
  const timeoutId = setTimeout(async () => {
    if (!hasCaptcha(targetUser.id)) return;
    deleteCaptcha(targetUser.id);
    captchaTimeouts.delete(targetUser.id);
    await sent.edit({
      content: null,
      embeds: [new EmbedBuilder()
        .setColor(0x6b7280)
        .setTitle("🧪 [TEST] Temps écoulé")
        .setDescription(`<@${targetUser.id}> n'a pas répondu dans les 5 minutes. (Mode test — aucune expulsion)`)
        .setTimestamp()],
    }).catch(() => null);
    setTimeout(() => sent.delete().catch(() => null), 10_000);
  }, 5 * 60 * 1000);

  captchaTimeouts.set(targetUser.id, timeoutId);

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🧪 Simulation captcha démarrée")
      .setDescription(
        `Un défi captcha de test a été envoyé dans <#${cfg.captchaChannelId}> pour <@${targetUser.id}>.\n\n` +
        `**Code :** \`${code}\`\n\n` +
        `> ⚠️ Aucun rôle ne sera modifié et aucun kick ne sera effectué.\n` +
        `> Le captcha expirera dans **5 minutes** si non résolu.`
      )
      .setTimestamp()],
    ephemeral: true,
  });
}

export const prefixName = "testcaptcha";
export const prefixAliases = ["testcap"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const isPreview = args.includes("--apercu") || args.includes("--preview");
  const guildId = message.guild.id;
  const cfg = getConfig(guildId);

  // Résoudre la cible
  const rawId = args.find((a) => !a.startsWith("--"))?.replace(/[<@!>]/g, "");
  const targetUser = rawId ? await message.guild.members.fetch(rawId).catch(() => null) : message.member;
  if (!targetUser) {
    await message.reply("❌ Membre introuvable."); return;
  }

  // ── MODE APERÇU ──
  if (isPreview) {
    const { code } = generateChallenge();
    const embed = buildCaptchaEmbed(code, targetUser as GuildMember, false)
      .setTitle("👁️ Aperçu — Vérification anti-bot")
      .setColor(0x6366f1);
    await message.reply({ content: "Aperçu du captcha :", embeds: [embed] });
    return;
  }

  // ── MODE SIMULATION ──
  if (!cfg.captchaChannelId) {
    await message.reply("❌ Aucun salon captcha configuré."); return;
  }
  if (hasCaptcha((targetUser as GuildMember).id)) {
    await message.reply(`❌ <@${(targetUser as GuildMember).id}> a déjà un captcha en cours.`); return;
  }

  let captchaCh: TextChannel | null = null;
  try {
    const ch = await message.client.channels.fetch(cfg.captchaChannelId);
    if (ch?.isTextBased()) captchaCh = ch as TextChannel;
  } catch { /* ignore */ }

  if (!captchaCh) { await message.reply("❌ Salon captcha inaccessible."); return; }

  const { code } = generateChallenge();
  const sent = await captchaCh.send({ content: `<@${(targetUser as GuildMember).id}>`, embeds: [buildCaptchaEmbed(code, targetUser as GuildMember, true)] });

  setCaptcha((targetUser as GuildMember).id, {
    code, guildId, attempts: 3, challengeMessageId: sent.id, isTest: true,
  });

  const timeoutId = setTimeout(async () => {
    if (!hasCaptcha((targetUser as GuildMember).id)) return;
    deleteCaptcha((targetUser as GuildMember).id);
    captchaTimeouts.delete((targetUser as GuildMember).id);
    await sent.edit({ content: null, embeds: [new EmbedBuilder().setColor(0x6b7280).setTitle("🧪 [TEST] Temps écoulé").setDescription(`<@${(targetUser as GuildMember).id}> n'a pas répondu. (Mode test — aucune expulsion)`).setTimestamp()] }).catch(() => null);
    setTimeout(() => sent.delete().catch(() => null), 10_000);
  }, 5 * 60 * 1000);

  captchaTimeouts.set((targetUser as GuildMember).id, timeoutId);

  await message.reply({
    embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle("🧪 Simulation captcha démarrée")
      .addFields(
        { name: "Cible", value: `<@${(targetUser as GuildMember).id}>`, inline: true },
        { name: "Code", value: `\`${code}\``, inline: true },
        { name: "Salon", value: `<#${cfg.captchaChannelId}>`, inline: true },
        { name: "Note", value: "Aucun rôle modifié · Aucun kick · Expire dans 5 min" },
      ).setTimestamp()],
  });
}
