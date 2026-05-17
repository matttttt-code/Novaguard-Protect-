import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLogDM, LOG_DM_USER_ID } from "../dm-notify.js";

const PING_ALERT_MS = 999;

export const data = new SlashCommandBuilder()
  .setName("errortest")
  .setDescription("Envoie tous les types de messages d'alerte DM au développeur (test uniquement)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function delay(): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
}

async function sendAll(client: Parameters<typeof sendLogDM>[0], triggeredBy: string): Promise<void> {
  const guild = client.guilds.cache.first();

  // 1. Démarrage simulé
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("🟢 [TEST] Bot démarré")
    .setThumbnail(client.user?.displayAvatarURL() ?? null)
    .addFields(
      { name: "Tag", value: client.user?.tag ?? "Inconnu", inline: true },
      { name: "Serveurs", value: String(client.guilds.cache.size), inline: true },
      { name: "Membres total", value: String(client.guilds.cache.reduce((a, g) => a + (g.memberCount ?? 0), 0)), inline: true },
      { name: "Ping WebSocket", value: `${client.ws.ping}ms`, inline: true },
      { name: "Déclenché par", value: triggeredBy, inline: true },
    )
    .setFooter({ text: "Ceci est un message de test — aucun redémarrage réel." })
    .setTimestamp());
  await delay();

  // 2. Erreur de commande simulée
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ [TEST] Erreur de commande")
    .addFields(
      { name: "Commande", value: "`/errortest`", inline: true },
      { name: "Serveur", value: guild?.name ?? "Inconnu", inline: true },
      { name: "Utilisateur", value: `\`${triggeredBy}\``, inline: true },
      { name: "Erreur", value: "```TypeError: Cannot read properties of undefined (reading 'id')```" },
      { name: "Stack (extrait)", value: "```at Object.execute (errortest.ts:42:5)\nat Client.<anonymous> (index.ts:122:7)```" },
    )
    .setFooter({ text: "Ceci est un message de test — aucune vraie erreur." })
    .setTimestamp());
  await delay();

  // 3. Ping élevé simulé
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("⚠️ [TEST] Ping élevé")
    .addFields(
      { name: "Ping WebSocket", value: `**${PING_ALERT_MS}ms**`, inline: true },
      { name: "Seuil", value: "> 100ms", inline: true },
      { name: "Heure", value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true },
    )
    .setFooter({ text: "Ceci est un message de test — cooldown 5 min en production." })
    .setTimestamp());
  await delay();

  // 4. Promesse rejetée non gérée simulée
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("💥 [TEST] Promesse rejetée non gérée")
    .addFields({ name: "Détail", value: "```ReferenceError: Cannot access 'channel' before initialization\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)```" })
    .setFooter({ text: "Ceci est un message de test — cooldown 2 min en production." })
    .setTimestamp());
  await delay();

  // 5. Arrêt simulé
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔴 [TEST] Bot arrêté")
    .setDescription("Signal `SIGTERM` reçu — le bot s'arrête maintenant.")
    .addFields(
      { name: "Uptime", value: `${Math.floor(process.uptime() / 60)} min`, inline: true },
      { name: "Note", value: "Ceci est un message de test — le bot continue de fonctionner.", inline: false },
    )
    .setTimestamp());
  await delay();

  // 6. Captcha admin — Déclenché
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("🔑 [TEST] Captcha admin — Vérification déclenchée")
    .addFields(
      { name: "Membre", value: `${triggeredBy} (\`000000000000000000\`)`, inline: true },
      { name: "Serveur", value: guild?.name ?? "Inconnu", inline: true },
      { name: "Rôle", value: "`Administrateur`", inline: true },
      { name: "Délai", value: "5 min · auto-rétablissement si pas de réponse", inline: false },
    )
    .setFooter({ text: "Ceci est un message de test." })
    .setTimestamp());
  await delay();

  // 7. Captcha admin — Réussi
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ [TEST] Captcha admin — Vérification réussie")
    .addFields(
      { name: "Membre", value: `${triggeredBy} (\`000000000000000000\`)`, inline: true },
      { name: "Serveur", value: guild?.name ?? "Inconnu", inline: true },
      { name: "Résultat", value: "Captcha validé — rôle Administrateur rétabli", inline: false },
    )
    .setFooter({ text: "Ceci est un message de test." })
    .setTimestamp());
  await delay();

  // 8. Captcha admin — Échec
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ [TEST] Captcha admin — Vérification échouée")
    .addFields(
      { name: "Membre", value: `${triggeredBy} (\`000000000000000000\`)`, inline: true },
      { name: "Serveur", value: guild?.name ?? "Inconnu", inline: true },
      { name: "Résultat", value: "Trop de tentatives incorrectes — rôle non accordé", inline: false },
    )
    .setFooter({ text: "Ceci est un message de test." })
    .setTimestamp());
  await delay();

  // 9. Captcha admin — Auto-rétabli (timeout)
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("⏱️ [TEST] Captcha admin — Auto-rétabli (délai expiré)")
    .addFields(
      { name: "Membre", value: `${triggeredBy} (\`000000000000000000\`)`, inline: true },
      { name: "Serveur", value: guild?.name ?? "Inconnu", inline: true },
      { name: "Résultat", value: "Aucune réponse dans les 5 min — rôle rétabli automatiquement", inline: false },
    )
    .setFooter({ text: "Ceci est un message de test." })
    .setTimestamp());
  await delay();

  // 10. DM sécurité — Résultat envoi groupé
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📨 [TEST] DM sécurité — Envoi groupé terminé")
    .addFields(
      { name: "Serveur", value: guild?.name ?? "Inconnu", inline: true },
      { name: "Envoyés", value: "**42**", inline: true },
      { name: "Échecs (DMs fermés)", value: "**7**", inline: true },
      { name: "Déclenché par", value: triggeredBy, inline: false },
    )
    .setFooter({ text: "Ceci est un message de test." })
    .setTimestamp());
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.user.id !== LOG_DM_USER_ID && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "❌ Commande réservée à l'administrateur.", ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle("🧪 Test des alertes DM lancé")
      .setDescription(
        "10 messages vont être envoyés en DM dans l'ordre :\n" +
        "1. 🟢 Démarrage\n2. ❌ Erreur de commande\n3. ⚠️ Ping élevé\n4. 💥 Promesse rejetée\n5. 🔴 Arrêt\n" +
        "6. 🔑 Captcha admin déclenché\n7. ✅ Captcha admin réussi\n8. ❌ Captcha admin échoué\n9. ⏱️ Captcha admin auto-rétabli\n10. 📨 DM sécurité groupé"
      )
      .setTimestamp()],
    ephemeral: true,
  });

  await sendAll(interaction.client, interaction.user.tag);
}

export const prefixName = "errortest";
export const prefixAliases = ["testalerte", "testalert"];

export async function executeMessage(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Commande réservée à l'administrateur."); return;
  }

  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle("🧪 Test des alertes DM lancé")
      .setDescription("10 messages d'alerte vont être envoyés en DM.")
      .setTimestamp()],
  });

  await sendAll(message.client, message.author.tag);
}
