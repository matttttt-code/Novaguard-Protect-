import { Client, EmbedBuilder } from "discord.js";
import { sendLogDM } from "./dm-notify.js";
import { logger } from "../lib/logger.js";

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

export async function sendStartupAlert(client: Client): Promise<void> {
  const guilds = client.guilds.cache.size;
  const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("🟢 Bot démarré")
    .setThumbnail(client.user?.displayAvatarURL() ?? null)
    .addFields(
      { name: "Tag", value: client.user?.tag ?? "Inconnu", inline: true },
      { name: "Serveurs", value: String(guilds), inline: true },
      { name: "Membres total", value: String(totalMembers), inline: true },
      { name: "Ping WebSocket", value: `${client.ws.ping >= 0 ? client.ws.ping + "ms" : "en attente…"}`, inline: true },
    )
    .setFooter({ text: "Toutes les commandes slash ont été enregistrées." })
    .setTimestamp());
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
      await sendLogDM(client, new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("🔴 Bot arrêté")
        .setDescription(`Signal \`${signal}\` reçu — le bot s'arrête maintenant.`)
        .addFields(
          { name: "Uptime", value: `${Math.floor(process.uptime() / 60)} min`, inline: true },
        )
        .setTimestamp());
    } catch { /* ignore */ }
    process.exit(0);
  };

  process.once("SIGTERM", () => { void shutdownHandler("SIGTERM"); });
  process.once("SIGINT",  () => { void shutdownHandler("SIGINT"); });
}
