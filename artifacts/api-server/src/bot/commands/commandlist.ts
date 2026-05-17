import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";

function buildEmbeds(): EmbedBuilder[] {
  const base = { color: 0x6366f1 as const };

  const embed1 = new EmbedBuilder()
    .setColor(base.color)
    .setTitle("📋 Liste des commandes — 51 commandes (1/3)")
    .setDescription("Toutes les commandes disponibles en slash `/` et préfixe `&`")
    .addFields(
      {
        name: "🛡️ Modération",
        value: [
          "`/kick` · `&kick @membre [raison]` — Expulse un membre",
          "`/ban` · `&ban @membre|<id> [raison]` — Bannit (fonctionne par ID hors serveur)",
          "`/softban` · `&softban` (`&sb`) — Ban + déban immédiat (efface les messages)",
          "`/unban` · `&unban <userId> [raison]` — Débannit",
          "`/timeout` · `&timeout @membre durée [raison]` (`&mute`) — 1m · 5m · 10m · 30m · 1h · 6h · 12h · 1j · 7j · 28j",
          "`/untimeout` · `&untimeout @membre` (`&unmute`) — Retire le timeout",
          "`/voicemute` · `&voicemute @membre durée` (`&vmute`) — Coupe micro + casque (1m→1j, auto-rétablissement)",
          "`/warn` · `&warn @membre raison` — Avertissement avec Case ID",
          "`/warnings voir|effacer|retirer` · `&warnings @membre [caseId]` — Gère les avertissements",
          "`/clear` · `&clear [nombre]` (`&purge`) — Supprime 1-100 messages",
        ].join("\n"),
      },
      {
        name: "⚙️ Gestion du serveur",
        value: [
          "`/slowmode secondes [#salon]` · `&slowmode` (`&sm`) — Slowmode (0 = désactiver)",
          "`/lock [#salon] [raison]` · `&lock` — Verrouille un salon",
          "`/unlock [#salon]` · `&unlock` — Déverrouille",
          "`/lockserver lock|unlock` · `&lockserver` — Verrouille/déverrouille **tous** les salons",
          "`/nuke [#salon]` · `&nuke` — Recrée un salon identique (supprime l'historique)",
          "`/role ajouter|retirer @membre @rôle` · `&role` — Attribue ou retire un rôle",
          "`/nickname @membre [surnom]` · `&nickname` (`&nick`) — Change ou réinitialise le surnom",
          "`/revokeinvites` · `&revokeinvites` — Révoque toutes les invitations",
          "`/raidmode activer|désactiver` · `&raidmode on|off` — Mode anti-raid",
          "`/joinlock activer|désactiver` · `&joinlock on|off` — Bloque toutes les arrivées",
        ].join("\n"),
      },
      {
        name: "⛔ Blacklist & sanctions",
        value: [
          "`/blacklist @membre|<id> raison` · `&blacklist` (`&bl`) — **Blacklist globale** : banni sur tous les serveurs",
          "`/blacklistinfo` · `&blacklistinfo` (`&bli`) — Liste noire du serveur",
          "`/sanctioninfo @membre` · `&sanctioninfo` (`&si`) — Toutes les sanctions d'un membre",
          "`/blacklistinvite ajouter|retirer|liste` · `&bliv` (`&ibl`) — Empêche d'inviter sans expulser",
          "🌐 **AntiDC global** — Ban auto si un blacklisté rejoint n'importe quel serveur",
        ].join("\n"),
      },
      {
        name: "📋 Configuration",
        value: [
          "`/dashboard` · `&dashboard` (`&config`) — Panneau interactif complet",
          "`/setlog #salon` · `&setlog` — Salon de logs principal",
          "`/setbanlog <id>` · `&setbanlog` — Salon de logs bans",
          "`/setgenlog #salon` · `&setgenlog` — Logs généraux (vide = désactiver)",
          "`/setinvitelog #salon` · `&setinvitelog` (`&setinvlog`) — Logs invitations",
          "`/settranscript #salon` · `&settranscript` — Salon transcripts tickets",
          "`/ticketconfig role @role` · `&ticketconfig role @role` — Rôle staff tickets",
          "`/ticketconfig categorie <id>` · `&ticketconfig categorie` — Catégorie tickets",
          "`/ticketconfig voir` · `&ticketconfig voir` — Config tickets actuelle",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Page 1/3" })
    .setTimestamp();

  const embed2 = new EmbedBuilder()
    .setColor(base.color)
    .setTitle("📋 Liste des commandes (2/3)")
    .addFields(
      {
        name: "🎫 Tickets",
        value: [
          "`/ticketpanel` · `&ticketpanel` — Panel de création (Admin)",
          "`/ticket claim` · `&ticket claim` — Prend en charge (staff)",
          "`/ticket fermer [raison]` · `&ticket fermer` — Ferme et archive",
          "`/ticket ajouter @membre` · `&ticket ajouter` — Ajoute un membre",
          "`/ticket retirer @membre` · `&ticket retirer` — Retire un membre",
          "`/ticket reset` · `&ticket reset` — Réinitialise le registre (Admin)",
          "`/transcript` · `&transcript` (`&trs`) — Génère un transcript .txt",
          "🔘 **Bouton 🎫** — Ouvre un salon ticket privé",
        ].join("\n"),
      },
      {
        name: "🤖 Captcha anti-bot",
        value: [
          "**Configuration via `/dashboard` → 🤖 Captcha**",
          "📍 **Salon vérification** — challenge dans le salon configuré",
          "📨 **Fallback DM** — si aucun salon, challenge en DM",
          "✅ Bonne réponse → rôle vérifié + bienvenue + log",
          "❌ 3 erreurs ou 5 min → expulsion automatique",
        ].join("\n"),
      },
      {
        name: "📨 Suivi des invitations",
        value: [
          "`/setinvitelog #salon` · `&setinvitelog` — Active les logs d'invitations",
          "`/checkinvite [@membre]` · `&checkinvite` (`&ci`) — Stats d'invitations personnelles",
          "`/checkinvites` · `&checkinvites` (`&topinvites`) — Classement top 15 (Admin)",
          "→ Embed automatique à chaque arrivée : inviteur, code, âge du compte",
        ].join("\n"),
      },
      {
        name: "ℹ️ Informations",
        value: [
          "`/userinfo [@membre]` · `&userinfo` (`&ui`) — Infos complètes d'un membre",
          "`/serverinfo` · `&serverinfo` (`&sv`) — Infos du serveur",
          "`/serverstats` · `&serverstats` (`&stats`, `&ss`) — Statistiques détaillées",
          "`/infome` · `&infome` (`&im`) — Mes propres infos",
          "`/getid [@mention|#salon|@rôle]` · `&getid` (`&id`) — ID d'un élément",
          "`/info` · `&info` (`&botinfo`) — Infos du bot (version, uptime, ping)",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Page 2/3" })
    .setTimestamp();

  const embed3 = new EmbedBuilder()
    .setColor(base.color)
    .setTitle("📋 Liste des commandes (3/3)")
    .addFields(
      {
        name: "🤖 Auto-modération",
        value: [
          "👢 **Spam** (5 msg en 5s) → Expulsion + slowmode 5s auto",
          "🔇 **Emojis** (+5 dans un message) → Timeout 24h",
          "🔇 **Lien** détecté → Timeout 24h",
          "🔇 **MAJUSCULES** (+8 lettres, 100%) → Timeout 24h",
          "⚠️ **Compte < 24h** à l'arrivée → Log avec ping @everyone",
          "🌐 **Blacklisté global** → Ban auto + ping @everyone",
          "*Les modérateurs (ManageMessages) sont exemptés*",
        ].join("\n"),
      },
      {
        name: "🗂️ Logs généraux",
        value: [
          "`/setgenlog #salon` — Active/désactive les logs généraux",
          "📡 Vocal : rejoindre · quitter · changer de salon",
          "✏️ Messages : modifiés · supprimés · suppression massive",
          "📁 Salons : créés · supprimés · modifiés",
          "🎭 Rôles : créés · supprimés · modifiés · attribués/retirés",
          "🔨 Bans/débans · 🔗 Invitations créées/supprimées",
        ].join("\n"),
      },
      {
        name: "📩 Utilitaires",
        value: [
          "`/rolerequest` · `&rolerequest <rôle> <raison>` (`&rr`) — Demande de rôle via modal",
          "`/suggestion <texte>` · `&suggestion` (`&suggest`, `&idee`) — Suggestion au développeur",
          "`/support` · `&support` — Questionnaire d'aide DM → transmis au staff",
          "`/reglement #salon <texte>` · `&reglement` — Publie le règlement",
          "`/commandlist` · `&commandlist` (`&help`, `&cmds`) — Cette liste",
        ].join("\n"),
      },
      {
        name: "🔧 Admin & diagnostic",
        value: [
          "`/restart` · `&restart` — **Redémarre le bot** (propriétaire uniquement)",
          "`/testcaptcha [simulation|apercu] [@membre]` · `&testcaptcha` (`&testcap`)",
          "`/errortest` · `&errortest` (`&testalerte`) — Teste les 5 alertes DM (Admin)",
          "`/testinviteembed` · `&testinviteembed` (`&tinv`) — Aperçu des logs invitations (Admin)",
        ].join("\n"),
      },
    )
    .setFooter({ text: "51 commandes slash · 51 préfixes · Blacklist globale · Config persistante" })
    .setTimestamp();

  return [embed1, embed2, embed3];
}

export const data = new SlashCommandBuilder()
  .setName("commandlist")
  .setDescription("Affiche la liste de toutes les commandes disponibles");

export async function execute(interaction: ChatInputCommandInteraction) {
  return interaction.reply({ embeds: buildEmbeds() });
}

export const prefixName = "commandlist";
export const prefixAliases = ["cmds", "help", "commandes"];

export async function executeMessage(message: Message) {
  await message.reply({ embeds: buildEmbeds() });
}
