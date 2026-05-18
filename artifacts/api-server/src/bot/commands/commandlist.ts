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
    .setTitle("📋 Liste des commandes (1/3)")
    .setDescription("Toutes les commandes disponibles en slash `/` et préfixe `&`")
    .addFields(
      {
        name: "🛡️ Modération",
        value: [
          "`/kick` · `&kick @m [raison]` — Expulse",
          "`/ban` · `&ban @m|<id> [raison]` — Bannit",
          "`/softban` · `&softban` (`&sb`) — Ban+déban (efface msgs)",
          "`/unban` · `&unban <id> [raison]` — Débannit",
          "`/timeout` · `&timeout @m durée [raison]` (`&mute`) — 1m·5m·10m·30m·1h·6h·12h·1j·7j·28j",
          "`/untimeout` · `&untimeout @m` (`&unmute`) — Retire timeout",
          "`/voicemute` · `&voicemute @m durée` (`&vmute`) — Coupe micro+casque (auto-rétablissement)",
          "`/warn` · `&warn @m raison` — Avertissement (Case ID)",
          "`/warnings voir|effacer|retirer` · `&warnings @m` — Gère les avertissements",
          "`/clear` · `&clear [n]` (`&purge`) — Supprime 1-100 messages",
          "`/tempban` · `&tempban @m durée raison` — Ban temporaire",
          "`/massban` · `&massban <ids...>` — Ban en masse",
          "`/note` · `&note @m texte` — Ajoute une note interne",
        ].join("\n"),
      },
      {
        name: "⚙️ Gestion du serveur",
        value: [
          "`/slowmode s [#salon]` · `&slowmode` (`&sm`) — Slowmode (0=off)",
          "`/lock [#salon]` · `&lock` — Verrouille · `/unlock` · `&unlock` — Déverrouille",
          "`/lockserver lock|unlock` · `&lockserver` — Tous les salons",
          "`/nuke [#salon]` · `&nuke` — Recrée salon (efface historique)",
          "`/role ajouter|retirer @m @rôle` · `&role` — Attribue/retire un rôle",
          "`/nickname @m [surnom]` · `&nickname` (`&nick`) — Change/réinitialise surnom",
          "`/revokeinvites` · `&revokeinvites` — Révoque toutes les invitations",
          "`/raidmode activer|désactiver|niveau2-activer|niveau2-désactiver` · `&raidmode` — Anti-raid N1/N2",
          "`/joinlock activer|désactiver` · `&joinlock` — Bloque les arrivées",
          "`/hoistrole` · `&hoistrole` (`&hisser`) — Hisse le bot au-dessus de tous les rôles",
        ].join("\n"),
      },
      {
        name: "⛔ Blacklist & sanctions",
        value: [
          "`/blacklist @m|<id> raison` · `&blacklist` (`&bl`) — **Blacklist globale** (tous serveurs + DB)",
          "`/blacklistinfo` · `&blacklistinfo` (`&bli`) — Liste noire du serveur",
          "`/sanctioninfo @m` · `&sanctioninfo` (`&si`) — Sanctions d'un membre",
          "`/blacklistinvite ajouter|retirer|liste` · `&bliv` — Empêche d'inviter",
          "🌐 **AntiDC global** — Ban auto si un blacklisté rejoint un serveur",
        ].join("\n"),
      },
      {
        name: "📋 Configuration",
        value: [
          "`/dashboard` · `&dashboard` (`&config`) — Panneau interactif",
          "`/setlog #s` · `/setbanlog <id>` · `/setgenlog #s` · `/setinvitelog #s`",
          "`/settranscript #s` · `&settranscript` — Salon transcripts",
          "`/ticketconfig role @r|categorie <id>|voir` · `&ticketconfig`",
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
          "`/ticketpanel` · `&ticketpanel` — Panel (Admin)",
          "`/ticket claim` — Prend en charge (staff)",
          "`/ticket fermer [raison]` — Ferme, sauvegarde transcript en DB",
          "`/ticket ajouter|retirer @m` — Ajoute/retire du ticket",
          "`/ticket reset` — Réinitialise registre (Admin)",
          "`/transcript` · `&transcript` (`&trs`) — Génère transcript .txt + sauvegarde DB",
          "🔘 **Bouton 🎫** — Ouvre un salon ticket privé",
        ].join("\n"),
      },
      {
        name: "🤖 Captcha & Invitations",
        value: [
          "**Captcha membres** — Config via `/dashboard` → 🤖 Captcha · ou **Panneau Owner** → Réglages Bot",
          "📍 Challenge dans le salon ou DM · ✅ réponse → rôle vérifié · ❌ 3 erreurs / 5 min → expulsion",
          "**Captcha admin** — Bouton 🔑 dans le log : retire le rôle admin, envoie un code DM · 10 min pour répondre · expire sans auto-rétablissement",
          "`/checkinvite [@m]` · `&checkinvite` (`&ci`) — Stats invitations",
          "`/checkinvites` · `&checkinvites` (`&topinvites`) — Top 15 (Admin)",
        ].join("\n"),
      },
      {
        name: "ℹ️ Informations",
        value: [
          "`/userinfo [@m]` · `&userinfo` (`&ui`) — Infos membre",
          "`/serverinfo` · `&serverinfo` (`&sv`) — Infos serveur",
          "`/serverstats` · `&serverstats` (`&stats`) — Statistiques détaillées",
          "`/infome` · `&infome` (`&im`) — Mes propres infos",
          "`/getid [@m|#s|@r]` · `&getid` (`&id`) — ID d'un élément",
          "`/info` · `&info` (`&botinfo`) — Infos bot (uptime, ping)",
        ].join("\n"),
      },
      {
        name: "📩 Utilitaires",
        value: [
          "`/rolerequest` · `&rolerequest <rôle> <raison>` (`&rr`) — Demande de rôle",
          "`/suggestion <texte>` · `&suggestion` (`&suggest`) — Suggestion au dev",
          "`/support` · `&support` — Questionnaire DM → staff",
          "`/reglement #s <texte>` · `&reglement` — Publie le règlement",
          "`/commandlist` · `&help` (`&cmds`) — Cette liste",
          "`/verify-dashboard` · `&verify-dashboard` (`&verifydash`, `&dashcode`) — Code de connexion Dashboard",
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
        name: "🔐 Sécurité avancée",
        value: [
          "`/secure voir|niveau <1|2|3>|suspicieux activer|désactiver` · `&secure`",
          "`/secureinfo` · `&secureinfo` (`&niveaux`) — **Explications détaillées** de chaque niveau",
          "`/sendsecuredm membre @m|everyone` · `&sendsecuredm` (`&ssdm`) — Envoie DM info sécurité à un membre ou tous",
          "`/antiinsult activer|désactiver|ajouter|retirer|liste|charger-defaults` · `&antiinsult`",
          "`/antiwebhook activer|désactiver|statut` · `&antiwebhook`",
          "`/whitelistinvite ajouter|retirer|liste` · `&whitelistinvite` (`&wlinv`)",
          "**N1** Automod standard (anti-insulte → warn) · **N2** +comptes <3j suspects",
          "**N3** Maximum — double validation owner+admin · DM admins · gel vocaux · vérif Très haute",
          "**Raid N2** — invitations révoquées · webhooks supprimés · timeout 10min nouveaux membres · spam 3/3s",
        ].join("\n"),
      },
      {
        name: "🤖 Auto-modération",
        value: [
          "👢 **Spam** : N1/N2/N3 → 5 msg/5s · Raid N2 → 3 msg/3s — Expulsion",
          "🔇 **Emojis** (+5) / **Lien** / **MAJUSCULES** (100%) → Timeout 24h",
          "🤬 **Insulte** → Timeout 24h (tous niveaux)",
          "🔗 **Webhook** non autorisé → Suppression + alerte DM owner",
          "`/antilink activer|désactiver` · `&antilink` — Supprime les liens",
          "`/antighostping activer|désactiver` · `&antighostping` — Détecte les ghost pings",
          "`/autokick activer|désactiver|délai` · `&autokick` — Expulse les non-vérifiés",
          "`/badname activer|désactiver` · `&badname` — Renomme les pseudos inappropriés",
          "`/antialt activer|désactiver|age` · `&antialt` — Filtre les comptes récents",
          "*Modérateurs (ManageMessages) exemptés de tout l'automod*",
        ].join("\n"),
      },
      {
        name: "🗂️ Logs généraux",
        value: [
          "`/setgenlog #salon` — Active/désactive les logs",
          "📡 Vocal · ✏️ Messages · 📁 Salons · 🎭 Rôles · 🔨 Bans · 🔗 Invitations",
          "🚨 Alerte DM owner : rôle admin attribué / rôle admin créé / anti-raid N2",
        ].join("\n"),
      },
      {
        name: "🔧 Admin & diagnostic",
        value: [
          "`/notify [@utilisateur|@rôle]` · `&notify` (`&notif`) — Notifie par ping + DM depuis un ticket",
          "`/testcaptcha [simulation|apercu] [@m]` · `&testcaptcha` (`&testcap`)",
          "`/errortest` · `&errortest` (`&testalerte`) — Teste les alertes DM",
          "`/testinviteembed` · `&testinviteembed` (`&tinv`) — Aperçu logs invitations",
          "`/purge` · `&purge [n] [@m]` — Supprime msgs filtrés (Admin)",
          "`/scamlink activer|désactiver` · `&scamlink` — Filtre les liens scam",
        ].join("\n"),
      },
      {
        name: "🌐 Dashboard Web",
        value: [
          "**Connexion** — `/verify-dashboard` ou `&verify-dashboard` → code 6 chiffres en DM (10 min)",
          "**Accès** — Administrateur du serveur ou propriétaire du bot",
          "**Panneau Owner** — Blacklist globale DB · Commandes désactivées · Transcripts · Réglages bot (captcha, bienvenue)",
        ].join("\n"),
      },
    )
    .setFooter({ text: "71 commandes slash · 72 préfixes · Sécurité N1-N3 · Blacklist DB · Transcripts DB · Dashboard Web" })
    .setTimestamp();

  return [embed1, embed2, embed3];
}

export const data = new SlashCommandBuilder()
  .setName("commandlist")
  .setDescription("Affiche la liste de toutes les commandes disponibles");

export async function execute(interaction: ChatInputCommandInteraction) {
  const [e1, e2, e3] = buildEmbeds();
  await interaction.reply({ embeds: [e1] });
  await interaction.followUp({ embeds: [e2] });
  await interaction.followUp({ embeds: [e3] });
}

export const prefixName = "commandlist";
export const prefixAliases = ["cmds", "help", "commandes"];

export async function executeMessage(message: Message) {
  const [e1, e2, e3] = buildEmbeds();
  const ch = message.channel as import("discord.js").TextChannel;
  await message.reply({ embeds: [e1] });
  await ch.send({ embeds: [e2] });
  await ch.send({ embeds: [e3] });
}
