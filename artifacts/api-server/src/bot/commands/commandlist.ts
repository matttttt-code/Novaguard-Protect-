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
        ].join("\n"),
      },
      {
        name: "⛔ Blacklist & sanctions",
        value: [
          "`/blacklist @m|<id> raison` · `&blacklist` (`&bl`) — **Blacklist globale** (tous serveurs)",
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
          "`/ticket fermer [raison]` — Ferme et archive",
          "`/ticket ajouter|retirer @m` — Ajoute/retire du ticket",
          "`/ticket reset` — Réinitialise registre (Admin)",
          "`/transcript` · `&transcript` (`&trs`) — Génère transcript .txt",
          "🔘 **Bouton 🎫** — Ouvre un salon ticket privé",
        ].join("\n"),
      },
      {
        name: "🤖 Captcha & Invitations",
        value: [
          "**Captcha** — Config via `/dashboard` → 🤖 Captcha",
          "📍 Challenge dans le salon ou DM · ✅ réponse → rôle vérifié · ❌ 3 erreurs/5min → expulsion",
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
          "`/antiinsult activer|désactiver|ajouter|retirer|liste|charger-defaults` · `&antiinsult`",
          "`/antiwebhook activer|désactiver|statut` · `&antiwebhook`",
          "`/whitelistinvite ajouter|retirer|liste` · `&whitelistinvite` (`&wlinv`)",
          "**N1** Automod standard · **N2** +comptes <3j suspects, anti-insulte 1h",
          "**N3** Maximum (double validation owner+admin) · anti-insulte 24h · anti-webhook auto",
        ].join("\n"),
      },
      {
        name: "🤖 Auto-modération",
        value: [
          "👢 **Spam** (5 msg/5s) → Expulsion + slowmode 5s",
          "🔇 **Emojis** (+5) / **Lien** / **MAJUSCULES** (+8, 100%) → Timeout 24h",
          "🤬 **Insulte** → Warn/Timeout 1h-24h (selon niveau sécurité)",
          "🔗 **Webhook** non autorisé → Suppression + alerte DM owner",
          "*Modérateurs (ManageMessages) exemptés*",
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
          "`/restart` · `&restart` — **Redémarre le bot** (propriétaire uniquement)",
          "`/testcaptcha [simulation|apercu] [@m]` · `&testcaptcha` (`&testcap`)",
          "`/errortest` · `&errortest` (`&testalerte`) — Teste les alertes DM",
          "`/testinviteembed` · `&testinviteembed` (`&tinv`) — Aperçu logs invitations",
        ].join("\n"),
      },
    )
    .setFooter({ text: "55 commandes slash · 55 préfixes · Sécurité N1-N3 · Blacklist globale · Config persistante" })
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
