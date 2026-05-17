import { Client, EmbedBuilder } from "discord.js";
import { sendLogDM } from "./dm-notify.js";
import { logger } from "../lib/logger.js";
import { getConfig } from "./guild-config-store.js";

let pingAlertCooldown = false;
let unhandledRejectionCooldown = false;

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateErrorCode(): string {
  let code = "ERR-";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function truncate(s: string, max = 500): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function errorFields(err: unknown, errorCode: string) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack ?? "").slice(0, 700) : "";
  return [
    { name: "🔖 Code erreur", value: `\`${errorCode}\``, inline: true },
    { name: "Erreur", value: `\`\`\`${truncate(message)}\`\`\`` },
    ...(stack ? [{ name: "Stack (extrait)", value: `\`\`\`${stack}\`\`\`` }] : []),
  ];
}

export async function sendStartupAlert(client: Client, slashCount: number, prefixCount: number): Promise<void> {
  const guilds = client.guilds.cache.size;
  const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const rssMB  = (mem.rss  / 1024 / 1024).toFixed(1);
  const uptimeSec = Math.floor(process.uptime());
  const ping = client.ws.ping;

  // Statistiques par serveur
  let logConfigured = 0, raidEnabled = 0, captchaEnabled = 0, secureAbove1 = 0, antiInsultEnabled = 0;
  for (const g of client.guilds.cache.values()) {
    const cfg = getConfig(g.id);
    if (cfg.logChannelId) logConfigured++;
    if (cfg.raidMode) raidEnabled++;
    if (cfg.captchaEnabled) captchaEnabled++;
    if ((cfg.securityLevel ?? 0) >= 2) secureAbove1++;
    if (cfg.antiInsultEnabled) antiInsultEnabled++;
  }

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("🟢 Bot démarré")
    .setThumbnail(client.user?.displayAvatarURL() ?? null)
    .addFields(
      // ── Identité ──
      { name: "Tag", value: client.user?.tag ?? "Inconnu", inline: true },
      { name: "ID", value: `\`${client.user?.id ?? "?"}\``, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      // ── Présence ──
      { name: "Serveurs", value: `**${guilds}**`, inline: true },
      { name: "Membres total", value: `**${totalMembers.toLocaleString("fr-FR")}**`, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      // ── Performances ──
      { name: "Ping WebSocket", value: ping >= 0 ? `**${ping} ms**` : "en attente…", inline: true },
      { name: "Mémoire", value: `Heap : **${heapMB} MB** · RSS : **${rssMB} MB**`, inline: true },
      { name: "Node.js", value: `\`${process.version}\``, inline: true },
      // ── Commandes ──
      { name: "Commandes slash", value: `**${slashCount}**`, inline: true },
      { name: "Commandes préfixe", value: `**${prefixCount}**`, inline: true },
      { name: "Uptime process", value: uptimeSec < 60 ? `${uptimeSec}s` : `${Math.floor(uptimeSec / 60)} min`, inline: true },
      // ── Fonctionnalités actives ──
      { name: "📊 Fonctionnalités actives", value:
        `• Logs configurés : **${logConfigured}**/${guilds} serveurs\n` +
        `• Mode raid actif : **${raidEnabled}**/${guilds} serveurs\n` +
        `• Captcha actif : **${captchaEnabled}**/${guilds} serveurs\n` +
        `• Sécurité N2+ : **${secureAbove1}**/${guilds} serveurs\n` +
        `• Anti-insulte actif : **${antiInsultEnabled}**/${guilds} serveurs`,
      },
    )
    .setFooter({ text: `${slashCount} slash + ${prefixCount} préfixe enregistrées` })
    .setTimestamp();

  await sendLogDM(client, embed);
}

export async function sendCommandErrorAlert(
  client: Client,
  commandName: string,
  guildName: string | null,
  userId: string,
  err: unknown,
  errorCode: string,
): Promise<void> {
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ Erreur — Commande slash")
    .addFields(
      { name: "🔖 Code erreur", value: `\`${errorCode}\``, inline: true },
      { name: "Commande", value: `\`/${commandName}\``, inline: true },
      { name: "Serveur", value: guildName ?? "Inconnu", inline: true },
      { name: "Utilisateur", value: `\`${userId}\``, inline: true },
      ...errorFields(err, errorCode).slice(1),
    )
    .setTimestamp());
}

export async function sendPrefixErrorAlert(
  client: Client,
  commandName: string,
  guildName: string | null,
  userId: string,
  err: unknown,
  errorCode: string,
): Promise<void> {
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ Erreur — Commande préfixe")
    .addFields(
      { name: "🔖 Code erreur", value: `\`${errorCode}\``, inline: true },
      { name: "Commande", value: `\`&${commandName}\``, inline: true },
      { name: "Serveur", value: guildName ?? "Inconnu", inline: true },
      { name: "Utilisateur", value: `\`${userId}\``, inline: true },
      ...errorFields(err, errorCode).slice(1),
    )
    .setTimestamp());
}

export async function sendButtonErrorAlert(
  client: Client,
  customId: string,
  guildName: string | null,
  userId: string,
  err: unknown,
  errorCode: string,
): Promise<void> {
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ Erreur — Interaction bouton")
    .addFields(
      { name: "🔖 Code erreur", value: `\`${errorCode}\``, inline: true },
      { name: "Custom ID", value: `\`${truncate(customId, 100)}\``, inline: true },
      { name: "Serveur", value: guildName ?? "Inconnu", inline: true },
      { name: "Utilisateur", value: `\`${userId}\``, inline: true },
      ...errorFields(err, errorCode).slice(1),
    )
    .setTimestamp());
}

export async function sendModalErrorAlert(
  client: Client,
  customId: string,
  guildName: string | null,
  userId: string,
  err: unknown,
  errorCode: string,
): Promise<void> {
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ Erreur — Soumission modal")
    .addFields(
      { name: "🔖 Code erreur", value: `\`${errorCode}\``, inline: true },
      { name: "Custom ID", value: `\`${truncate(customId, 100)}\``, inline: true },
      { name: "Serveur", value: guildName ?? "Inconnu", inline: true },
      { name: "Utilisateur", value: `\`${userId}\``, inline: true },
      ...errorFields(err, errorCode).slice(1),
    )
    .setTimestamp());
}

export async function sendClientErrorAlert(
  client: Client,
  err: unknown,
  errorCode: string,
): Promise<void> {
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle("🔴 Erreur client Discord")
    .addFields(...errorFields(err, errorCode))
    .setTimestamp()).catch(() => null);
}

export function registerBotAlerts(client: Client): void {
  // ── Surveillance du ping toutes les 30s ──
  const pingInterval = setInterval(async () => {
    const ping = client.ws.ping;
    if (ping > 100 && !pingAlertCooldown) {
      pingAlertCooldown = true;
      logger.warn({ ping }, "Ping WebSocket élevé");
      await sendLogDM(client, new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("⚠️ Ping élevé")
        .addFields(
          { name: "Ping WebSocket", value: `**${ping}ms**`, inline: true },
          { name: "Seuil", value: "> 100ms", inline: true },
          { name: "Heure", value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true },
        )
        .setFooter({ text: "Cooldown 5 minutes — les alertes suivantes seront ignorées." })
        .setTimestamp()
      ).catch(() => null);
      setTimeout(() => { pingAlertCooldown = false; }, 5 * 60_000);
    }
  }, 30_000);
  if (typeof pingInterval.unref === "function") pingInterval.unref();

  // ── Promesses rejetées non gérées ──
  process.on("unhandledRejection", async (reason) => {
    logger.error({ reason }, "Promesse rejetée non gérée");
    if (unhandledRejectionCooldown) return;
    unhandledRejectionCooldown = true;
    const errCode = generateErrorCode();
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack ?? "").slice(0, 700) : "";
    await sendLogDM(client, new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("💥 Promesse rejetée non gérée")
      .addFields(
        { name: "🔖 Code erreur", value: `\`${errCode}\``, inline: true },
        { name: "Détail", value: `\`\`\`${msg.slice(0, 600)}\`\`\`` },
        ...(stack ? [{ name: "Stack (extrait)", value: `\`\`\`${stack}\`\`\`` }] : []),
      )
      .setTimestamp()
    ).catch(() => null);
    setTimeout(() => { unhandledRejectionCooldown = false; }, 2 * 60_000);
  });

  // ── Arrêt propre (SIGTERM / SIGINT) ──
  const shutdownHandler = async (signal: string) => {
    logger.info({ signal }, "Signal reçu — arrêt du bot");
    try {
      const uptimeMin = Math.floor(process.uptime() / 60);
      const mem = process.memoryUsage();
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      await sendLogDM(client, new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("🔴 Bot arrêté")
        .setDescription(`Signal \`${signal}\` reçu — le bot s'arrête maintenant.`)
        .addFields(
          { name: "Uptime", value: `**${uptimeMin} min**`, inline: true },
          { name: "Mémoire", value: `**${heapMB} MB** heap`, inline: true },
          { name: "Ping WS", value: client.ws.ping >= 0 ? `**${client.ws.ping} ms**` : "N/A", inline: true },
        )
        .setTimestamp());
    } catch { /* ignore */ }
    process.exit(0);
  };

  process.once("SIGTERM", () => { void shutdownHandler("SIGTERM"); });
  process.once("SIGINT",  () => { void shutdownHandler("SIGINT"); });
}
