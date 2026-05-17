import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";

function buildCommandListEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📋 Liste des commandes — 47 commandes")
    .setDescription("Toutes les commandes disponibles en slash `/` et préfixe `&`")
    .addFields(
      {
        name: "🛡️ Modération",
        value: [
          "`/kick` · `&kick @membre [raison]` — Expulse un membre",
          "`/ban` · `&ban @membre|<id> [raison]` — Bannit (fonctionne hors serveur par ID)",
          "`/softban` · `&softban @membre|<id>` (`&sb`) — Ban + déban immédiat (efface les messages)",
          "`/unban` · `&unban <userId> [raison]` — Débannit (approbation admin si blacklisté)",
          "`/timeout` · `&timeout @membre durée [raison]` (`&mute`) — Timeout texte (1m · 5m · 10m · 1h · 6h · 12h · 1j · 7j · 28j)",
          "`/untimeout` · `&untimeout @membre` (`&unmute`) — Retire le timeout",
          "`/voicemute` · `&voicemute @membre durée [raison]` (`&vmute`) — Coupe micro + casque en vocal (1m→1j, auto-rétablissement)",
          "`/warn` · `&warn @membre raison` — Avertissement avec Case ID unique",
          "`/warnings voir|effacer|retirer` · `&warnings @membre [caseId]` — Gère les avertissements",
          "`/clear` · `&clear [nombre]` (`&purge`) — Supprime 1-100 messages (ignore les épinglés)",
        ].join("\n"),
      },
      {
        name: "⚙️ Gestion du serveur",
        value: [
          "`/slowmode` · `&slowmode secondes [#salon]` (`&sm`) — Slowmode (0 = désactiver)",
          "`/lock` · `&lock [#salon] [raison]` — Verrouille un salon + ajoute 🔒 au nom",
          "`/unlock` · `&unlock [#salon] [raison]` — Déverrouille + retire le 🔒",
          "`/lockserver lock|unlock` · `&lockserver lock|unlock` — Verrouille/déverrouille **tous** les salons texte",
          "`/nuke [#salon]` · `&nuke [#salon]` — Recrée un salon identique (supprime tout l'historique)",
          "`/role ajouter|retirer` · `&role ajouter|retirer @membre @rôle` — Attribue ou retire un rôle",
          "`/nickname @membre [surnom]` · `&nickname @membre [surnom]` (`&nick`) — Change ou réinitialise le surnom",
          "`/revokeinvites` · `&revokeinvites` — Révoque **toutes** les invitations du serveur",
          "`/raidmode activer|désactiver` · `&raidmode on|off` — Mode anti-raid (expulse tous les nouveaux arrivants)",
          "`/joinlock activer|désactiver` · `&joinlock on|off` — Bloque toutes les arrivées",
        ].join("\n"),
      },
      {
        name: "⛔ Blacklist & sanctions",
        value: [
          "`/blacklist @membre|<id> raison` · `&blacklist @membre raison` (`&bl`) — **Blacklist globale** : banni sur **tous** les serveurs du bot",
          "`/blacklistinfo` · `&blacklistinfo` (`&bli`) — Affiche la liste noire du serveur",
          "`/sanctioninfo @membre` · `&sanctioninfo @mention` (`&si`) — Toutes les sanctions d'un membre",
          "🌐 **AntiDC global** — Ban automatique si un blacklisté tente de rejoindre n'importe quel serveur du bot",
        ].join("\n"),
      },
      {
        name: "📋 Configuration",
        value: [
          "`/dashboard` · `&dashboard` (`&config`, `&panel`) — Panneau interactif complet (arrivée, départ, captcha, sécurité, logs)",
          "`/setlog #salon` · `&setlog #salon` — Salon de logs principal (sanctions, arrivées, etc.)",
          "`/setbanlog <id_salon>` · `&setbanlog <id>` — Salon de logs bans (peut être sur un autre serveur)",
          "`/setgenlog #salon` · `&setgenlog #salon` — Salon de logs généraux (vide = désactiver)",
          "`/setinvitelog #salon` · `&setinvitelog #salon` (`&setinvlog`) — Salon de logs des invitations",
          "`/settranscript #salon` · `&settranscript #salon` — Salon de réception des transcripts de tickets",
          "`/ticketconfig role @role` · `&ticketconfig role @role` — Rôle staff pour les tickets",
          "`/ticketconfig categorie <id>` · `&ticketconfig categorie <id>` — Catégorie des salons tickets",
          "`/ticketconfig voir` · `&ticketconfig voir` — Voir la config actuelle des tickets",
        ].join("\n"),
      },
      {
        name: "🎫 Tickets",
        value: [
          "`/ticketpanel` · `&ticketpanel` — Envoie le panel de création de tickets dans ce salon (Admin)",
          "`/ticket claim` · `&ticket claim` — Prend en charge le ticket actuel (staff)",
          "`/ticket fermer [raison]` · `&ticket fermer [raison]` — Ferme et archive le ticket",
          "`/ticket ajouter @membre` · `&ticket ajouter @membre` — Ajoute un membre au ticket",
          "`/ticket retirer @membre` · `&ticket retirer @membre` — Retire un membre du ticket",
          "`/ticket reset` · `&ticket reset` — Réinitialise le registre interne (Admin)",
          "`/transcript` · `&transcript` (`&trs`) — Génère un transcript .txt du ticket actuel",
          "🔘 **Bouton 🎫** — Cliquer sur le panel pour ouvrir un salon ticket privé",
        ].join("\n"),
      },
      {
        name: "🤖 Captcha anti-bot",
        value: [
          "**Configuration via `/dashboard` → bouton 🤖 Captcha**",
          "📍 **Salon vérification** — challenge dans le salon configuré (style RaidProtect)",
          "📨 **Fallback DM** — si aucun salon défini, le challenge est envoyé en DM",
          "✅ Bonne réponse → rôle vérifié, message de bienvenue, log",
          "❌ 3 erreurs ou 5 min → expulsion automatique",
          "🔴 **Rôle non-vérifié** — bloque tous les salons sauf #vérification",
          "🟢 **Rôle vérifié** — attribué après succès",
        ].join("\n"),
      },
      {
        name: "📨 Suivi des invitations",
        value: [
          "`/setinvitelog #salon` · `&setinvitelog #salon` (`&setinvlog`) — Active les logs d'invitations (Admin)",
          "  → Embed automatique à chaque arrivée : inviteur, code, âge du compte, stats de l'inviteur",
          "  → Aussi envoyé en DM au développeur du bot",
          "`/checkinvite [@membre]` · `&checkinvite [@mention]` (`&ci`) — Stats d'invitations personnelles",
          "  → ✅ Invités · ❌ Partis · 🟢 Actifs · par qui ce membre a été invité + code",
          "`/checkinvites` · `&checkinvites` (`&topinvites`) — Classement top 15 du serveur (Admin)",
        ].join("\n"),
      },
      {
        name: "ℹ️ Informations",
        value: [
          "`/userinfo [@membre]` · `&userinfo [@mention]` (`&ui`) — Infos complètes d'un membre",
          "`/serverinfo` · `&serverinfo` (`&sv`) — Infos du serveur (membres, boost, etc.)",
          "`/infome` · `&infome` (`&im`) — Mes propres infos",
          "`/getid [@mention | #salon | @rôle]` · `&getid` (`&id`) — ID d'un utilisateur, salon ou rôle",
          "`/info` · `&info` (`&botinfo`) — Infos du bot (version, uptime, ping, serveurs)",
        ].join("\n"),
      },
      {
        name: "🤖 Auto-modération",
        value: [
          "👢 **Spam** (5 messages en 5s) → Expulsion + slowmode 5s automatique (1h)",
          "🔇 **Emojis** (+5 dans un message) → Timeout 24h",
          "🔇 **Lien** détecté → Timeout 24h",
          "🔇 **MAJUSCULES** (+8 lettres, 100%) → Timeout 24h",
          "⚠️ **Compte < 24h** à l'arrivée → Log avec ping @everyone",
          "🌐 **Blacklisté global** → Ban auto + ping @everyone",
          "📨 **DM Sanctions** ON/OFF via `/dashboard` ou `/setlog`",
          "*Les modérateurs (ManageMessages) sont exemptés*",
        ].join("\n"),
      },
      {
        name: "🗂️ Logs généraux",
        value: [
          "`/setgenlog #salon` · `&setgenlog #salon` — Active/désactive les logs généraux",
          "📡 Vocal : rejoindre · quitter · changer de salon",
          "✏️ Messages : modifiés · supprimés · suppression massive",
          "📁 Salons : créés · supprimés · modifiés (avec exécuteur via audit log)",
          "🎭 Rôles : créés · supprimés · modifiés · attribués/retirés aux membres",
          "🔨 Bans/débans · 🔗 Invitations créées/supprimées",
          "👤 **IDs** dans chaque embed + footer pour copie rapide",
        ].join("\n"),
      },
      {
        name: "📩 Utilitaires",
        value: [
          "`/rolerequest` · `&rolerequest <rôle> <raison>` (`&rr`) — Demande de rôle via formulaire modal → log staff + ping `<@1505490829513457745>`",
          "`/suggestion <texte>` · `&suggestion <texte>` (`&suggest`, `&idee`) — Envoie une suggestion ou signalement de bug au développeur",
          "`/support` · `&support` — Questionnaire d'aide DM → transmis au staff avec boutons ticket/DM",
          "`/reglement #salon <texte>` · `&reglement` — Publie le règlement + réaction :verification1:",
          "`/commandlist` · `&commandlist` (`&help`, `&cmds`, `&commandes`) — Cette liste",
        ].join("\n"),
      },
      {
        name: "🧪 Tests & diagnostic",
        value: [
          "`/testcaptcha [simulation|apercu] [@membre]` · `&testcaptcha [--apercu] [@mention]` (`&testcap`)",
          "  → `simulation` : test complet dans le salon captcha (aucun kick réel)",
          "  → `apercu` : aperçu visuel éphémère de l'embed captcha",
          "`/errortest` · `&errortest` (`&testalerte`) — Envoie les 5 types d'alertes DM en simulation (Admin)",
          "  → 🟢 Démarrage · ❌ Erreur commande · ⚠️ Ping · 💥 Rejet non géré · 🔴 Arrêt",
        ].join("\n"),
      },
    )
    .setFooter({ text: "47 commandes slash · 47 préfixes · Config persistante par serveur · Blacklist globale cross-serveurs" })
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
