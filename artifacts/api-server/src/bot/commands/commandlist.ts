import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";

function buildCommandListEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📋 Liste des commandes")
    .setDescription("Toutes les commandes — slash `/` et préfixe `&`")
    .addFields(
      {
        name: "🛡️ Modération",
        value: [
          "`/kick` · `&kick @membre` — Expulse un membre",
          "`/ban` · `&ban @membre|<id>` — Bannit (fonctionne hors serveur par ID)",
          "`/softban` · `&softban @membre|<id>` (`&sb`) — Ban + déban immédiat (supprime les messages)",
          "`/unban` · `&unban <userId>` — Débannit (approbation admin si blacklisté)",
          "`/timeout` · `&timeout @membre durée` (`&mute`) — Timeout (1m→28j)",
          "`/untimeout` · `&untimeout @membre` (`&unmute`) — Retire le timeout",
          "`/warn` · `&warn @membre raison` — Avertissement avec Case ID",
          "`/warnings voir|effacer|retirer` · `&warnings voir|effacer|retirer @membre [caseId]` — Gère les avertissements",
          "`/clear` · `&clear [nombre]` (`&purge`) — Supprime des messages (1-100)",
        ].join("\n"),
      },
      {
        name: "⚙️ Gestion du serveur",
        value: [
          "`/slowmode` · `&slowmode secondes [#salon]` (`&sm`) — Slowmode d'un salon",
          "`/lock` · `&lock [#salon] [raison]` — Verrouille un salon + ajoute 🔒 au nom",
          "`/unlock` · `&unlock [#salon] [raison]` — Déverrouille un salon + retire le 🔒",
          "`/lockserver lock|unlock [raison]` · `&lockserver lock|unlock` — Verrouille/déverrouille **tous** les salons",
          "`/nuke [#salon] [raison]` · `&nuke [#salon]` — Recrée un salon (supprime l'historique)",
          "`/role ajouter|retirer` · `&role ajouter|retirer @membre @rôle` — Gère les rôles",
          "`/nickname` · `&nickname @membre [surnom]` (`&nick`) — Change le surnom",
          "`/revokeinvites` · `&revokeinvites` — Révoque toutes les invitations",
          "`/raidmode activer|désactiver` · `&raidmode on|off` — Mode anti-raid",
          "`/joinlock activer|désactiver` · `&joinlock on|off` (`&join`) — Bloque toutes les arrivées",
        ].join("\n"),
      },
      {
        name: "⛔ Blacklist globale",
        value: [
          "`/blacklist @membre|<id> raison` · `&blacklist @membre|<id> raison` (`&bl`) — **Blacklist global** : banni sur **tous** les serveurs du bot",
          "`/blacklistinfo` · `&blacklistinfo` (`&bli`) — Voir la liste noire",
          "🤖 **AntiDC local** — Ban automatique si blacklisté localement tente de rejoindre",
          "🌐 **AntiDC global** — Ban automatique si blacklisté sur n'importe quel serveur du bot",
        ].join("\n"),
      },
      {
        name: "📋 Configuration",
        value: [
          "`/dashboard` · `&dashboard` (`&config`, `&panel`) — Panneau interactif : arrivée/départ, captcha, logs (Admin)",
          "`/setlog #salon` · `&setlog #salon` — Définit le salon de logs principal",
          "`/setbanlog <id_salon>` · `&setbanlog <id>` — Salon de logs bans (autre serveur supporté)",
          "`/settranscript #salon` · `&settranscript #salon` — Salon où les transcripts de tickets sont envoyés",
          "`/ticketconfig role @role` · `&ticketconfig role @role` — Rôle staff des tickets",
          "`/ticketconfig categorie` · `&ticketconfig categorie <id>` — Catégorie des tickets",
          "`/ticketconfig voir` · `&ticketconfig voir` — Voir la config des tickets",
        ].join("\n"),
      },
      {
        name: "🎫 Tickets",
        value: [
          "`/ticketpanel` · `&ticketpanel` — Envoie le panel de tickets dans ce salon (Admin)",
          "`/ticket claim` · `&ticket claim` — Prend en charge le ticket (staff)",
          "`/ticket reset` · `&ticket reset` — Réinitialise le registre interne des tickets (Admin)",
          "`/ticket fermer [raison]` · `&ticket fermer [raison]` — Ferme le ticket actuel",
          "`/ticket ajouter @membre` · `&ticket ajouter @membre` — Ajoute un membre au ticket",
          "`/ticket retirer @membre` · `&ticket retirer @membre` — Retire un membre du ticket",
          "`/transcript` · `&transcript` (`&trs`) — Génère un transcript .txt du ticket (staff)",
          "🔘 **Bouton** — Les membres cliquent sur 🎫 dans le panel pour créer leur ticket privé",
          "🔢 Les tickets sont numérotés automatiquement : `🎫-username-42`",
        ].join("\n"),
      },
      {
        name: "🤖 Captcha anti-bot",
        value: [
          "**Activé/désactivé via `/dashboard`**",
          "📨 Math challenge envoyé en DM à chaque nouveau membre",
          "⏱️ **5 minutes** pour répondre · **3 tentatives** maximum",
          "✅ Réponse correcte → accès accordé, rôle vérifié attribué",
          "❌ Trop d'erreurs ou délai dépassé → expulsion automatique",
          "📱 DMs fermés → accès accordé sans captcha (configurable via rôles)",
        ].join("\n"),
      },
      {
        name: "ℹ️ Informations",
        value: [
          "`/userinfo` · `&userinfo [@membre]` (`&ui`) — Infos d'un membre",
          "`/serverinfo` · `&serverinfo` (`&sv`) — Infos du serveur",
          "`/sanctioninfo` · `&sanctioninfo` (`&si`) — Sanctions d'un membre",
          "`/infome` · `&infome` (`&im`) — Mes infos complètes",
          "`/getid` · `&getid` (`&id`) — ID d'un membre, rôle ou salon",
          "`/info` · `&info` (`&botinfo`) — Infos du bot",
        ].join("\n"),
      },
      {
        name: "🤖 Auto-modération",
        value: [
          "👢 **5 messages en 5s** → Expulsion + slowmode 5s sur le salon (1 heure)",
          "🔇 **+5 emojis** dans un message → Timeout 24h",
          "🔇 **Lien détecté** → Timeout 24h",
          "🔇 **100% majuscules** (+8 lettres) → Timeout 24h",
          "⚠️ **Compte < 24h** à l'arrivée → Ping @everyone dans les logs",
          "🤖 **Blacklisté qui rejoint** → Ban automatique + ping @everyone",
          "*Les modérateurs sont exemptés*",
        ].join("\n"),
      },
      {
        name: "📩 Utilitaires",
        value: [
          "`/support` · `&support` — Questionnaire d'aide en DM (transmis au staff avec ping rôle)",
          "`/reglement #salon texte` · `&reglement #salon texte` — Envoie le règlement dans un salon + réaction :verification1:",
          "`/commandlist` · `&commandlist` (`&help`, `&cmds`) — Cette liste",
        ].join("\n"),
      }
    )
    .setFooter({ text: "Captcha configurable via Dashboard • Blacklist global cross-serveurs • Transcripts .txt • Config persistante par serveur" })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("commandlist")
  .setDescription("Affiche la liste de toutes les commandes disponibles");

export async function execute(interaction: ChatInputCommandInteraction) {
  return interaction.reply({ embeds: [buildCommandListEmbed()] });
}

export const prefixName = "commandlist";
export const prefixAliases = ["cmds", "help", "commandes"];

export async function executeMessage(message: Message) {
  await message.reply({ embeds: [buildCommandListEmbed()] });
}
