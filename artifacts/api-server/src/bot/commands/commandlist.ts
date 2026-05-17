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
          "`/lockserver lock|unlock [raison]` · `&lockserver lock|unlock` — Verrouille/déverrouille **tous** les salons (urgence)",
          "`/nuke [#salon] [raison]` · `&nuke [#salon]` — Recrée un salon (supprime l'historique)",
          "`/role ajouter|retirer` · `&role ajouter|retirer @membre @rôle` — Gère les rôles",
          "`/nickname` · `&nickname @membre [surnom]` (`&nick`) — Change le surnom",
          "`/revokeinvites` · `&revokeinvites` — Révoque toutes les invitations",
          "`/raidmode activer|désactiver` · `&raidmode on|off` — Mode anti-raid",
          "`/joinlock activer|désactiver` · `&joinlock on|off` (`&join`) — Bloque toutes les arrivées",
        ].join("\n"),
      },
      {
        name: "⛔ Liste noire (Blacklist)",
        value: [
          "`/blacklist @membre|<id> raison` · `&blacklist @membre|<id> raison` (`&bl`) — Blacklist définitif par mention ou ID",
          "`/blacklistinfo` · `&blacklistinfo` (`&bli`) — Voir la liste noire",
          "🤖 **AntiDC** — Ban automatique si un membre blacklisté tente de rejoindre",
        ].join("\n"),
      },
      {
        name: "📋 Configuration",
        value: [
          "`/dashboard` · `&dashboard` (`&config`, `&panel`) — Panneau interactif : messages d'arrivée/départ, statuts sécurité (Admin)",
          "`/setlog #salon` · `&setlog #salon` — Définit le salon de logs principal",
          "`/setbanlog <id_salon>` · `&setbanlog <id>` — Salon de logs bans (autre serveur supporté)",
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
          "🔘 **Bouton** — Les membres cliquent sur 🎫 dans le panel pour créer leur ticket privé",
          "🔢 Les tickets sont numérotés automatiquement : `🎫-username-42`",
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
    .setFooter({ text: "DMs de sanction • Logs salon + DM • Case IDs pour les warns • 1 ticket par utilisateur • Config persistante par serveur" })
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
