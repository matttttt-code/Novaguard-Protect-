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
          "`/warnings voir|effacer|retirer` · `&warnings @membre [caseId]` — Gère les avertissements",
          "`/clear` · `&clear [nombre]` (`&purge`) — Supprime des messages (1-100)",
        ].join("\n"),
      },
      {
        name: "⚙️ Gestion du serveur",
        value: [
          "`/slowmode` · `&slowmode secondes [#salon]` (`&sm`) — Slowmode d'un salon",
          "`/lock` · `&lock [#salon] [raison]` — Verrouille un salon + ajoute 🔒 au nom",
          "`/unlock` · `&unlock [#salon] [raison]` — Déverrouille + retire le 🔒",
          "`/lockserver lock|unlock` · `&lockserver lock|unlock` — Verrouille/déverrouille **tous** les salons",
          "`/nuke [#salon]` · `&nuke [#salon]` — Recrée un salon (supprime l'historique)",
          "`/role ajouter|retirer` · `&role ajouter|retirer @membre @rôle` — Gère les rôles",
          "`/nickname @membre [surnom]` · `&nickname` (`&nick`) — Change le surnom",
          "`/revokeinvites` · `&revokeinvites` — Révoque toutes les invitations",
          "`/raidmode activer|désactiver` · `&raidmode on|off` — Mode anti-raid",
          "`/joinlock activer|désactiver` · `&joinlock on|off` — Bloque toutes les arrivées",
        ].join("\n"),
      },
      {
        name: "⛔ Blacklist globale",
        value: [
          "`/blacklist @membre|<id> raison` · `&blacklist` (`&bl`) — **Global** : banni sur **tous** les serveurs du bot",
          "`/blacklistinfo` · `&blacklistinfo` (`&bli`) — Voir la liste noire",
          "🌐 **AntiDC global** — Ban auto si blacklisté rejoint n'importe quel serveur du bot",
        ].join("\n"),
      },
      {
        name: "📋 Configuration",
        value: [
          "`/dashboard` · `&dashboard` (`&config`) — Panneau interactif : arrivée/départ, captcha, DM sanctions, logs",
          "`/setlog #salon` · `&setlog #salon` — Salon de logs principal",
          "`/setbanlog <id_salon>` · `&setbanlog <id>` — Salon de logs bans (autre serveur supporté)",
          "`/settranscript #salon` · `&settranscript` — Salon de réception des transcripts de tickets",
          "`/ticketconfig role @role` · `&ticketconfig role` — Rôle staff des tickets",
          "`/ticketconfig categorie` · `&ticketconfig categorie <id>` — Catégorie des tickets",
          "`/ticketconfig voir` · `&ticketconfig voir` — Voir la config des tickets",
        ].join("\n"),
      },
      {
        name: "🎫 Tickets",
        value: [
          "`/ticketpanel` · `&ticketpanel` — Envoie le panel de tickets dans ce salon (Admin)",
          "`/ticket claim` — Prend en charge le ticket (staff)",
          "`/ticket fermer [raison]` — Ferme le ticket actuel",
          "`/ticket ajouter|retirer @membre` — Ajoute/retire un membre du ticket",
          "`/ticket reset` — Réinitialise le registre interne (Admin)",
          "`/transcript` · `&transcript` (`&trs`) — Génère un transcript .txt du ticket (staff)",
          "🔘 **Bouton** — Clic sur 🎫 dans le panel pour ouvrir un ticket privé",
        ].join("\n"),
      },
      {
        name: "🤖 Captcha anti-bot",
        value: [
          "**Activé via `/dashboard` → bouton 🤖 Captcha**",
          "📍 **Salon de vérification** — le challenge s'affiche dans le salon configuré (style RaidProtect)",
          "📨 **Fallback DM** — si aucun salon configuré, le challenge est envoyé en DM",
          "✅ Réponse correcte → accès accordé, rôle vérifié attribué, message de bienvenue",
          "❌ 3 mauvaises réponses ou 5 min sans réponse → expulsion automatique",
          "🔴 **Rôle non-vérifié** — bloque tous les salons sauf #vérification",
          "🟢 **Rôle vérifié** — attribué après succès",
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
          "👢 **5 messages en 5s** → Expulsion + slowmode 5s (1h)",
          "🔇 **+5 emojis** → Timeout 24h",
          "🔇 **Lien détecté** → Timeout 24h",
          "🔇 **100% majuscules** (+8 lettres) → Timeout 24h",
          "⚠️ **Compte < 24h** à l'arrivée → Ping @everyone dans les logs",
          "🌐 **Blacklisté global** → Ban auto + ping @everyone",
          "📨 **DM sanctions** — ON/OFF configurable via `/dashboard`",
          "*Les modérateurs sont exemptés*",
        ].join("\n"),
      },
      {
        name: "📩 Utilitaires",
        value: [
          "`/support` · `&support` — Questionnaire d'aide en DM (transmis au staff)",
          "`/reglement #salon texte` · `&reglement` — Envoie le règlement + réaction :verification1:",
          "`/commandlist` · `&commandlist` (`&help`, `&cmds`) — Cette liste",
        ].join("\n"),
      }
    )
    .setFooter({ text: "Captcha salon/DM • Blacklist global cross-serveurs • DM sanctions ON/OFF • Transcripts .txt • Config persistante" })
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
