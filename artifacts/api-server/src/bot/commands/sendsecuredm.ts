import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  Message,
  Client,
  Guild,
} from "discord.js";
import { getConfig } from "../guild-config-store.js";
import { isRaidMode, isRaidMode2 } from "../guild-config-store.js";

function buildSecurityDM(guild: Guild): EmbedBuilder {
  const cfg = getConfig(guild.id);
  const lvlLabel = cfg.securityLevel === 3 ? "🔴 Maximum (N3)" : cfg.securityLevel === 2 ? "🟡 Élevé (N2)" : "🟢 Normal (N1)";
  const raidActive = isRaidMode(guild.id);
  const raidN2Active = isRaidMode2(guild.id);

  const protections: string[] = [];
  if (cfg.captchaEnabled) protections.push("🤖 **Captcha** à l'arrivée (vérification obligatoire)");
  if (cfg.antiInsultEnabled) protections.push("🤬 **Anti-insulte** actif — timeout 24h en cas d'insulte");
  if (cfg.antiWebhookEnabled) protections.push("🔗 **Anti-webhook** actif — suppressions auto");
  if (cfg.suspiciousCheckEnabled) protections.push("🕵️ **Détection comptes suspects** à l'arrivée");
  if (raidActive) protections.push("🚨 **Mode Raid N1** actif — tout nouveau membre est expulsé");
  if (raidN2Active) protections.push("🛡️ **Mode Raid N2** actif — nouveaux membres timeout 10min · spam 3msg/3s");
  if (protections.length === 0) protections.push("Aucune protection supplémentaire configurée");

  return new EmbedBuilder()
    .setColor(cfg.securityLevel === 3 ? 0xef4444 : cfg.securityLevel === 2 ? 0xf59e0b : 0x22c55e)
    .setTitle(`🔐 Informations de sécurité — ${guild.name}`)
    .setThumbnail(guild.iconURL() ?? null)
    .setDescription(
      `Ce message te parvient de la part des **modérateurs de ${guild.name}**.\n` +
      `Voici les mesures de sécurité en vigueur sur le serveur.`
    )
    .addFields(
      {
        name: "📊 Niveau de sécurité actuel",
        value: lvlLabel,
      },
      {
        name: "🛡️ Protections actives",
        value: protections.join("\n"),
      },
      {
        name: "⚠️ En cas de raid ou d'activité suspecte",
        value: [
          "• Ne clique sur **aucun lien** envoyé par des inconnus",
          "• Ne partage jamais ton token ou ton mot de passe",
          "• Signale tout comportement suspect à un modérateur",
          "• Si des rôles suspects t'ont été attribués, contacte un admin",
        ].join("\n"),
      },
      {
        name: "📋 Auto-modération",
        value: [
          "• **Spam** (5 msg/5s) → expulsion automatique",
          "• **Emojis** excessifs / liens non autorisés / caps → timeout 24h",
          "• **Insultes** → timeout 24h",
          "*Les modérateurs sont exemptés*",
        ].join("\n"),
      },
    )
    .setFooter({ text: `${guild.name} • Message de sécurité officiel` })
    .setTimestamp();
}

async function sendToMember(member: GuildMember, guild: Guild): Promise<"ok" | "fail"> {
  try {
    await member.user.send({ embeds: [buildSecurityDM(guild)] });
    return "ok";
  } catch {
    return "fail";
  }
}

export const data = new SlashCommandBuilder()
  .setName("sendsecuredm")
  .setDescription("Envoie un DM d'information de sécurité à un membre ou à tous les membres")
  .addSubcommand((s) =>
    s.setName("membre")
      .setDescription("Envoie le DM de sécurité à un membre précis")
      .addUserOption((o) => o.setName("cible").setDescription("Le membre à contacter").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("everyone")
      .setDescription("Envoie le DM de sécurité à tous les membres non-bots du serveur")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const prefixName = "sendsecuredm";
export const prefixAliases = ["securedm", "ssdm"];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (sub === "membre") {
    const target = interaction.options.getMember("cible") as GuildMember | null;
    if (!target) {
      await interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
      return;
    }
    if (target.user.bot) {
      await interaction.reply({ content: "❌ Impossible d'envoyer un DM à un bot.", ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const result = await sendToMember(target, guild);
    await interaction.editReply({
      content: result === "ok"
        ? `✅ DM de sécurité envoyé à **${target.user.tag}**.`
        : `❌ Impossible d'envoyer le DM à **${target.user.tag}** (DMs peut-être désactivés).`,
    });
    return;
  }

  if (sub === "everyone") {
    await interaction.deferReply({ ephemeral: true });
    let members;
    try {
      members = await guild.members.fetch();
    } catch {
      await interaction.editReply({ content: "❌ Impossible de récupérer la liste des membres." });
      return;
    }

    const humans = [...members.values()].filter(m => !m.user.bot);
    let sent = 0;
    let failed = 0;

    await interaction.editReply({ content: `⏳ Envoi en cours à **${humans.length}** membres…` });

    for (const member of humans) {
      const res = await sendToMember(member, guild);
      if (res === "ok") sent++; else failed++;
      // petite pause pour éviter le rate limit Discord
      await new Promise(r => setTimeout(r, 600));
    }

    await interaction.editReply({
      content: `✅ DM de sécurité envoyé à **${sent}** membre(s).\n${failed > 0 ? `❌ Échec pour **${failed}** membre(s) (DMs désactivés).` : ""}`,
    });
  }
}

export async function executeMessage(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis).");
    return;
  }

  const sub = args[0]?.toLowerCase();
  const guild = message.guild;

  if (!sub) {
    await message.reply("Usage : `&sendsecuredm membre @user` ou `&sendsecuredm everyone`");
    return;
  }

  if (sub === "membre" || sub === "member") {
    const mentioned = message.mentions.members?.first();
    if (!mentioned) {
      await message.reply("❌ Mentionne un membre : `&sendsecuredm membre @user`");
      return;
    }
    if (mentioned.user.bot) {
      await message.reply("❌ Impossible d'envoyer un DM à un bot.");
      return;
    }
    const result = await sendToMember(mentioned, guild);
    await message.reply(
      result === "ok"
        ? `✅ DM de sécurité envoyé à **${mentioned.user.tag}**.`
        : `❌ Impossible d'envoyer le DM à **${mentioned.user.tag}** (DMs peut-être désactivés).`
    );
    return;
  }

  if (sub === "everyone" || sub === "all") {
    let members;
    try {
      members = await guild.members.fetch();
    } catch {
      await message.reply("❌ Impossible de récupérer la liste des membres.");
      return;
    }

    const humans = [...members.values()].filter(m => !m.user.bot);
    const progressMsg = await message.reply(`⏳ Envoi en cours à **${humans.length}** membres…`);
    let sent = 0;
    let failed = 0;

    for (const member of humans) {
      const res = await sendToMember(member, guild);
      if (res === "ok") sent++; else failed++;
      await new Promise(r => setTimeout(r, 600));
    }

    await progressMsg.edit(
      `✅ DM de sécurité envoyé à **${sent}** membre(s).${failed > 0 ? `\n❌ Échec pour **${failed}** membre(s) (DMs désactivés).` : ""}`
    );
    return;
  }

  await message.reply("Usage : `&sendsecuredm membre @user` ou `&sendsecuredm everyone`");
}
