import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  Message,
  Client,
  Guild,
} from "discord.js";
import { getConfig } from "../guild-config-store.js";
import { getSecurityLevel } from "../guild-config-store.js";

function buildSecurityDM(guild: Guild): EmbedBuilder {
  const level = getSecurityLevel(guild.id);
  const cfg = getConfig(guild.id);

  const levelLabels: Record<1 | 2 | 3, string> = {
    1: "🟢 Niveau 1 — Standard",
    2: "🟡 Niveau 2 — Renforcé",
    3: "🔴 Niveau 3 — Maximum",
  };

  const levelDescriptions: Record<1 | 2 | 3, string> = {
    1: "Modération automatique standard : anti-insulte, anti-spam, anti-webhook.",
    2: "Niveau 1 + surveillance renforcée des nouveaux comptes (< 3 jours).",
    3: "Niveau maximum : gel des salons vocaux, vérification très haute, surveillance totale.",
  };

  const tips = [
    "Ne clique jamais sur des liens suspects envoyés en DM.",
    "Ne partage jamais tes informations personnelles ou ton token Discord.",
    "Si tu reçois un DM suspect d'un membre du serveur, signale-le au staff.",
    "Active l'authentification à deux facteurs (2FA) sur ton compte Discord.",
    "Ne rejoins pas d'autres serveurs via des liens non vérifiés.",
  ];

  return new EmbedBuilder()
    .setColor(level === 3 ? 0xef4444 : level === 2 ? 0xf59e0b : 0x22c55e)
    .setTitle(`🔒 Information de sécurité — ${guild.name}`)
    .setThumbnail(guild.iconURL() ?? null)
    .setDescription(
      `Voici un rappel des mesures de sécurité en vigueur sur **${guild.name}**.\n\n` +
      `**Niveau de sécurité actif :** ${levelLabels[level]}\n` +
      `${levelDescriptions[level]}`
    )
    .addFields(
      {
        name: "✅ Conseils de sécurité",
        value: tips.map(t => `• ${t}`).join("\n"),
      },
      {
        name: "📋 Règles du serveur",
        value: cfg.logChannelId
          ? "Consulte le règlement du serveur dans les salons d'information."
          : "Consulte les règles du serveur avant de participer.",
      },
    )
    .setFooter({ text: `${guild.name} • Message officiel du staff`, iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();
}

export async function sendToAllMembersSecureDM(
  client: Client,
  guildId: string,
): Promise<{ sent: number; failed: number }> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { sent: 0, failed: 0 };
  const embed = buildSecurityDM(guild);
  const members = await guild.members.fetch();
  let sent = 0;
  let failed = 0;
  await Promise.all(
    members
      .filter(m => !m.user.bot)
      .map(m =>
        m.user.send({ embeds: [embed] })
          .then(() => { sent++; })
          .catch(() => { failed++; }),
      ),
  );
  return { sent, failed };
}

export const data = new SlashCommandBuilder()
  .setName("sendsecuredm")
  .setDescription("Envoie un DM d'information de sécurité à un membre ou à tous les membres.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((s) =>
    s.setName("membre")
      .setDescription("Envoie un DM de sécurité à un membre spécifique.")
      .addUserOption((o) =>
        o.setName("cible").setDescription("Le membre à qui envoyer le DM.").setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName("everyone")
      .setDescription("Envoie un DM de sécurité à tous les membres du serveur."),
  );

export const prefixName = "sendsecuredm";
export const prefixAliases = ["securedm", "ssdm"];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;
  const sub = interaction.options.getSubcommand();

  if (sub === "membre") {
    const target = interaction.options.getUser("cible", true);
    const embed = buildSecurityDM(guild);
    try {
      await target.send({ embeds: [embed] });
      await interaction.reply({
        content: `✅ DM de sécurité envoyé à **${target.tag}**.`,
        flags: 64,
      });
    } catch {
      await interaction.reply({
        content: `❌ Impossible d'envoyer le DM à **${target.tag}** (DMs désactivés).`,
        flags: 64,
      });
    }
    return;
  }

  if (sub === "everyone") {
    await interaction.reply({
      content: "⏳ Envoi en cours… cela peut prendre plusieurs minutes selon la taille du serveur.",
      flags: 64,
    });
    const { sent, failed } = await sendToAllMembersSecureDM(interaction.client, guild.id);
    await interaction.editReply({
      content:
        `✅ DM de sécurité envoyé à **${sent}** membre(s).` +
        (failed > 0 ? `\n❌ Échec pour **${failed}** membre(s) (DMs désactivés).` : ""),
    });
  }
}

export async function executeMessage(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Réservé aux administrateurs.");
    return;
  }

  const sub = args[0]?.toLowerCase();

  if (!sub || sub === "everyone") {
    const reply = await message.reply("⏳ Envoi en cours… cela peut prendre plusieurs minutes selon la taille du serveur.");
    const { sent, failed } = await sendToAllMembersSecureDM(message.client, message.guild.id);
    await reply.edit(
      `✅ DM de sécurité envoyé à **${sent}** membre(s).` +
      (failed > 0 ? `\n❌ Échec pour **${failed}** membre(s) (DMs désactivés).` : ""),
    );
    return;
  }

  const targetId = args[0]?.replace(/[<@!>]/g, "");
  if (targetId) {
    try {
      const target = await message.client.users.fetch(targetId);
      const embed = buildSecurityDM(message.guild);
      await target.send({ embeds: [embed] });
      await message.reply(`✅ DM de sécurité envoyé à **${target.tag}**.`);
    } catch {
      await message.reply("❌ Impossible d'envoyer le DM (utilisateur introuvable ou DMs désactivés).");
    }
  }
}
