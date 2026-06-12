import { Client, Events, Message, EmbedBuilder, GuildMember } from "discord.js";
import { getConfig } from "./guild-config-store.js";
import {
  connect, disconnect, forceConnect, forceDisconnect,
  isConnected, getConnectedUsers, getMemberStats, getLeaderboard,
  addConnections, removeConnections, deleteUser, resetGuild, rewindConnections,
} from "./connection-store.js";
import { logger } from "../lib/logger.js";

const PREFIX = "!";
const COLORS = { success: 0x57f287, error: 0xed4245, info: 0x5865f2, warn: 0xfee75c };

function msToHuman(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${s}s`;
  if (mins > 0) return `${mins}m ${s}s`;
  return `${s}s`;
}

function hasTier2(member: GuildMember, tier2RoleId: string | null): boolean {
  if (!tier2RoleId) return false;
  return member.roles.cache.has(tier2RoleId);
}

function hasTier3(member: GuildMember, tier3RoleId: string | null): boolean {
  if (!tier3RoleId) return false;
  return member.roles.cache.has(tier3RoleId);
}

async function resolveUser(guild: import("discord.js").Guild, raw: string): Promise<GuildMember | null> {
  const cleaned = raw.replace(/[<@!>]/g, "").trim();
  if (!cleaned) return null;
  try {
    return await guild.members.fetch(cleaned).catch(async () => {
      const results = await guild.members.search({ query: raw, limit: 1 });
      return results.first() ?? null;
    });
  } catch { return null; }
}

function parseDate(raw: string): number | null {
  const match = raw.match(/^(\d{2})\/(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, dd, mm, hh, min] = match.map(Number);
  const now = new Date();
  const d = new Date(now.getFullYear(), mm! - 1, dd!, hh!, min!, 0, 0);
  return d.getTime();
}

export function registerConnectionHandler(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot || !message.guild || !message.member) return;

    const guildId = message.guild.id;
    const cfg = getConfig(guildId);

    if (!cfg.connectionSystemEnabled) return;

    if (cfg.connectionChannelId && message.channelId !== cfg.connectionChannelId) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();
    if (!cmd) return;

    const member = message.member;
    const t2 = hasTier2(member, cfg.connectionTier2RoleId);
    const t3 = hasTier3(member, cfg.connectionTier3RoleId);

    try {
      // ── Tier 1 ──────────────────────────────────────────────────────────────
      if (cmd === "c") {
        const ok = connect(guildId, message.author.id);
        if (!ok) {
          await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Tu es **déjà connecté(e)**. Utilise `!d` pour te déconnecter.")] });
          return;
        }
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle("✅ Connexion démarrée").setDescription(`<@${message.author.id}> est maintenant **connecté(e)** au service.\nUtilise \`!d\` pour terminer ta session.`).setTimestamp()] });
        return;
      }

      if (cmd === "d") {
        const result = disconnect(guildId, message.author.id);
        if (!result) {
          await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Tu n'es **pas connecté(e)**. Utilise `!c` pour démarrer une session.")] });
          return;
        }
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle("🔴 Déconnexion").setDescription(`<@${message.author.id}> s'est **déconnecté(e)**.\n⏱️ Durée de session : **${msToHuman(result.durationMs)}**`).setTimestamp()] });
        return;
      }

      if (cmd === "me") {
        const stats = getMemberStats(guildId, message.author.id);
        const embed = new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle(`📊 Vos statistiques — ${message.author.tag}`)
          .setThumbnail(message.author.displayAvatarURL())
          .addFields(
            { name: "🔗 Connexions totales", value: `**${stats.totalConnections}**`, inline: true },
            { name: "⏱️ Temps total", value: `**${msToHuman(stats.totalMs)}**`, inline: true },
            { name: "🟢 Statut", value: stats.isConnected ? `**Connecté(e)** depuis ${msToHuman(stats.currentSessionMs)}` : "**Déconnecté(e)**", inline: true },
          )
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      if (cmd === "online") {
        const connected = getConnectedUsers(guildId);
        const embed = new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle(`🟢 Utilisateurs connectés — ${connected.length}`)
          .setDescription(connected.length === 0
            ? "*Aucun utilisateur connecté en ce moment.*"
            : connected.map((id, i) => `**${i + 1}.** <@${id}>`).join("\n"))
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      if (cmd === "ping") {
        const sent = await message.reply("🏓 Pong...");
        const latency = sent.createdTimestamp - message.createdTimestamp;
        await sent.edit({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle("🏓 Pong!").addFields({ name: "Latence", value: `**${latency}ms**`, inline: true }, { name: "API", value: `**${Math.round(client.ws.ping)}ms**`, inline: true })] });
        return;
      }

      if (cmd === "info") {
        const totalGuilds = client.guilds.cache.size;
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle("🤖 Informations du bot").addFields({ name: "Serveurs", value: `${totalGuilds}`, inline: true }, { name: "Préfixe connexions", value: `\`!\``, inline: true }).setTimestamp()] });
        return;
      }

      if (cmd === "online" || cmd === "ping" || cmd === "info" || cmd === "badge" || cmd === "update") {
        return;
      }

      if (cmd === "suggestion") {
        const text = args.join(" ");
        if (!text) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!suggestion [texte]`")] }); return; }
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`✅ Suggestion envoyée : *${text.slice(0, 200)}*`)] });
        return;
      }

      // ── Tier 2 ──────────────────────────────────────────────────────────────
      if (cmd === "check") {
        if (!t2 && !t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 2** requis.")] }); return; }
        const target = args[0] ? await resolveUser(message.guild, args[0]) : null;
        if (!target) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!check [mention/pseudo/id]`")] }); return; }
        const stats = getMemberStats(guildId, target.id);
        await message.reply({ embeds: [new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle(`🔍 Infos — ${target.user.tag}`)
          .setThumbnail(target.user.displayAvatarURL())
          .addFields(
            { name: "🔗 Connexions", value: `**${stats.totalConnections}**`, inline: true },
            { name: "⏱️ Temps total", value: `**${msToHuman(stats.totalMs)}**`, inline: true },
            { name: "🟢 Statut", value: stats.isConnected ? `Connecté (depuis ${msToHuman(stats.currentSessionMs)})` : "Déconnecté", inline: true },
          )
          .setTimestamp()] });
        return;
      }

      if (cmd === "view") {
        if (!t2 && !t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 2** requis.")] }); return; }
        const lb = getLeaderboard(guildId, 20);
        const lines = lb.map((e, i) => `**${i + 1}.** <@${e.userId}> — **${e.totalConnections}** connexions · ${msToHuman(e.totalMs)}${e.isConnected ? " 🟢" : ""}`);
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle("🏆 Classement Connexions").setDescription(lines.length ? lines.join("\n") : "*Aucune donnée.*").setTimestamp()] });
        return;
      }

      // ── Tier 3 ──────────────────────────────────────────────────────────────
      if (cmd === "co") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        const target = args[0] ? await resolveUser(message.guild, args[0]) : null;
        if (!target) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!co [mention/pseudo/id]`")] }); return; }
        const ok = forceConnect(guildId, target.id);
        await message.reply({ embeds: [new EmbedBuilder().setColor(ok ? COLORS.success : COLORS.warn).setDescription(ok ? `✅ <@${target.id}> a été **connecté(e)** manuellement.` : `⚠️ <@${target.id}> est déjà connecté(e).`)] });
        return;
      }

      if (cmd === "deco") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        const target = args[0] ? await resolveUser(message.guild, args[0]) : null;
        if (!target) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!deco [mention/pseudo/id]`")] }); return; }
        const result = forceDisconnect(guildId, target.id);
        await message.reply({ embeds: [new EmbedBuilder().setColor(result ? COLORS.success : COLORS.warn).setDescription(result ? `✅ <@${target.id}> a été **déconnecté(e)** manuellement (durée : ${msToHuman(result.durationMs)}).` : `⚠️ <@${target.id}> n'était pas connecté(e).`)] });
        return;
      }

      if (cmd === "delete") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        const target = args[0] ? await resolveUser(message.guild, args[0]) : null;
        if (!target) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!delete [mention/pseudo/id]`")] }); return; }
        deleteUser(guildId, target.id);
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`🗑️ <@${target.id}> supprimé(e) de la base de données.`)] });
        return;
      }

      if (cmd === "reset") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        resetGuild(guildId);
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription("🔄 Toutes les données de connexion du serveur ont été **réinitialisées**.")] });
        return;
      }

      if (cmd === "add") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        const count = parseInt(args[0] ?? "");
        const target = args[1] ? await resolveUser(message.guild, args[1]) : null;
        if (isNaN(count) || count <= 0 || !target) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!add [nombre] [mention/pseudo/id]`")] }); return; }
        addConnections(guildId, target.id, count);
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`➕ **${count}** connexion(s) ajoutée(s) à <@${target.id}>.`)] });
        return;
      }

      if (cmd === "remove") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        const count = parseInt(args[0] ?? "");
        const target = args[1] ? await resolveUser(message.guild, args[1]) : null;
        if (isNaN(count) || count <= 0 || !target) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!remove [nombre] [mention/pseudo/id]`")] }); return; }
        removeConnections(guildId, target.id, count);
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`➖ **${count}** connexion(s) retirée(s) à <@${target.id}>.`)] });
        return;
      }

      if (cmd === "rewind") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        const fromMs = args[0] ? parseDate(args[0]) : null;
        const toMs = args[1] ? parseDate(args[1]) : null;
        if (!fromMs || !toMs) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!rewind [JJ/MM-HH:MM] [JJ/MM-HH:MM]`\nExemple : `!rewind 12/06-14:00 12/06-18:00`")] }); return; }
        const results = rewindConnections(guildId, fromMs, toMs);
        const fromDate = new Date(fromMs).toLocaleString("fr-FR");
        const toDate = new Date(toMs).toLocaleString("fr-FR");
        const lines = results.map((r) => `<@${r.userId}> — **${r.sessions.length}** session(s)`);
        await message.reply({ embeds: [new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle("⏪ Rewind Connexions")
          .setDescription(`Période : \`${fromDate}\` → \`${toDate}\`\n\n${lines.length ? lines.join("\n") : "*Aucune session trouvée sur cette période.*"}`)
          .setTimestamp()] });
        return;
      }

      if (cmd === "support") {
        if (!t3) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Rôle **Tier 3** requis.")] }); return; }
        const text = args.join(" ");
        if (!text) { await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setDescription("⚠️ Usage : `!support [texte]`")] }); return; }
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`✅ Signalement envoyé à l'équipe de développement : *${text.slice(0, 300)}*`)] });
        return;
      }

    } catch (err) {
      logger.error({ err, cmd }, "[connection-commands] Erreur");
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription("❌ Une erreur est survenue.")] }).catch(() => null);
    }
  });
}
