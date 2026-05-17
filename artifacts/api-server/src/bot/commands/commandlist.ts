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
          "`/ban` · `&ban @membre` — Bannit un membre",
          "`/softban` · `&softban @membre` (`&sb`) — Ban + déban immédiat (supprime les messages)",
          "`/unban` · `&unban <userId>` — Débannit (approbation admin si blacklisté)",
          "`/timeout` · `&timeout @membre durée` (`&mute`) — Timeout (1m→28j)",
          "`/untimeout` · `&untimeout @membre` (`&unmute`) — Retire le timeout",
          "`/warn` · `&warn @membre raison` — Avertissement avec Case ID",
          "`/warnings voir|effacer|retirer` · `&warnings voir|effacer|retirer @membre` — Gère les avertissements",
          "`/clear` · `&clear [nombre]` (`&purge`) — Supprime des messages (1-100)",
        ].join("\n"),
      },
      {
        name: "⚙️ Gestion du serveur",
        value: [
          "`/slowmode` · `&slowmode secondes [#salon]` (`&sm`) — Slowmode d'un salon",
          "`/lock` · `&lock [#salon] [raison]` — Verrouille un salon",
          "`/unlock` · `&unlock [#salon] [raison]` — Déverrouille un salon",
          "`/role ajouter|retirer` · `&role ajouter|retirer @membre @rôle` — Gère les rôles",
          "`/nickname` · `&nickname @membre [surnom]` (`&nick`) — Change le surnom",
          "`/revokeinvites` · `&revokeinvites` — Révoque toutes les invitations",
          "`/raidmode activer|désactiver` · `&raidmode on|off` — Mode anti-raid",
        ].join("\n"),
      },
      {
        name: "⛔ Liste noire (Blacklist)",
        value: [
          "`/blacklist` · `&blacklist @membre raison` (`&bl`) — Blacklist définitif (déban nécessite approbation admin)",
          "`/blacklistinfo` · `&blacklistinfo` (`&bli`) — Voir la liste noire",
          "`/setbanlog` · `&setbanlog #salon` — Définit le salon des logs bans/blacklist",
          "🤖 **AntiDC** — Ban automatique si un membre blacklisté tente de rejoindre",
        ].join("\n"),
      },
      {
        name: "📋 Configuration",
        value: [
          "`/setlog` · `&setlog #salon` — Définit le salon de logs principal",
          "`/setbanlog` · `&setbanlog #salon` — Définit le salon de logs bans",
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
          "👢 **5 messages en 5s** → Expulsion + slowmode 5s sur le salon (1 min)",
          "🔇 **+5 emojis** dans un message → Timeout 10min",
          "🔇 **Lien détecté** → Timeout 10min",
          "🔇 **100% majuscules** (+8 lettres) → Timeout 10min",
          "⚠️ **Compte < 24h** à l'arrivée → Ping @everyone dans les logs",
          "🤖 **Blacklisté qui rejoint** → Ban automatique + ping @everyone",
          "*Les modérateurs sont exemptés*",
        ].join("\n"),
      },
      {
        name: "📩 Utilitaires",
        value: [
          "`/support` · `&support` — Reçois un questionnaire d'aide en DM (transmis au staff)",
          "`/commandlist` · `&commandlist` (`&help`, `&cmds`) — Cette liste",
        ].join("\n"),
      }
    )
    .setFooter({ text: "DMs de sanction • Logs salon + DM • Case IDs pour les warns" })
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
