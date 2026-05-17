import { Client, EmbedBuilder } from "discord.js";
import { sendLogDM } from "./dm-notify.js";
import { logger } from "../lib/logger.js";

let pingAlertCooldown = false;
let unhandledRejectionCooldown = false;

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
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack ?? "").slice(0, 700) : "";
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ Erreur de commande")
    .addFields(
      { name: "Commande", value: `\`/${commandName}\``, inline: true },
      { name: "Serveur", value: guildName ?? "Inconnu", inline: true },
      { name: "Utilisateur", value: `\`${userId}\``, inline: true },
      { name: "Erreur", value: `\`\`\`${message.slice(0, 500)}\`\`\`` },
      ...(stack ? [{ name: "Stack (extrait)", value: `\`\`\`${stack}\`\`\`` }] : []),
    )
    .setTimestamp());
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
      // Cooldown 5 min pour éviter le spam
      setTimeout(() => { pingAlertCooldown = false; }, 5 * 60_000);
    }
  }, 30_000);
  // Ne pas bloquer la fin du process
  if (typeof pingInterval.unref === "function") pingInterval.unref();

  // ── Promesses rejetées non gérées ──
  process.on("unhandledRejection", async (reason) => {
    logger.error({ reason }, "Promesse rejetée non gérée");
    if (unhandledRejectionCooldown) return;
    unhandledRejectionCooldown = true;
    const msg = reason instanceof Error ? reason.message : String(reason);
    await sendLogDM(client, new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("💥 Promesse rejetée non gérée")
      .addFields({ name: "Détail", value: `\`\`\`${msg.slice(0, 800)}\`\`\`` })
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
