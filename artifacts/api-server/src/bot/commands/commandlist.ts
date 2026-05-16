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
    .setDescription("Toutes les commandes disponibles — slash `/` et préfixe `&`")
    .addFields(
      {
        name: "🛡️ Modération",
        value: [
          "`/kick` — Expulse un membre",
          "`/ban` — Bannit un membre",
          "`/unban` — Débannit par ID",
          "`/timeout` — Timeout (1min → 28j)",
          "`/untimeout` — Retire le timeout",
          "`/warn` — Avertit un membre",
          "`/warnings voir|effacer` — Gère les avertissements",
          "`/clear` — Supprime des messages (1-100)",
        ].join("\n"),
      },
      {
        name: "⚙️ Gestion du serveur",
        value: [
          "`/slowmode` — Définit le slowmode d'un salon",
          "`/lock` — Verrouille un salon",
          "`/unlock` — Déverrouille un salon",
          "`/role ajouter|retirer` — Gère les rôles d'un membre",
          "`/nickname` — Change ou réinitialise un surnom",
        ].join("\n"),
      },
      {
        name: "ℹ️ Informations",
        value: [
          "`/userinfo` — Infos d'un membre",
          "`/serverinfo` — Infos du serveur",
          "`/sanctioninfo` · `&sanctioninfo` (`&si`) — Sanctions d'un membre",
          "`/infome` · `&infome` (`&im`, `&whoami`) — Infos complètes d'un membre",
          "`/getid membre|role|salon` · `&getid` (`&id`) — ID d'un membre, rôle ou salon",
          "`/info` · `&info` (`&botinfo`, `&bot`) — Infos du bot",
        ].join("\n"),
      },
      {
        name: "🤖 Auto-modération",
        value: [
          "👢 **5 messages en 5s** → Expulsion automatique",
          "🔇 **+5 emojis** dans un message → Timeout 10min",
          "🔇 **Lien détecté** → Timeout 10min",
          "🔇 **100% majuscules** (+8 lettres) → Timeout 10min",
          "*Les modérateurs et gestionnaires sont exemptés*",
        ].join("\n"),
      },
      {
        name: "📋 Utilitaires",
        value: [
          "`/commandlist` · `&commandlist` (`&cmds`, `&help`) — Cette liste",
        ].join("\n"),
      }
    )
    .setFooter({ text: "Les DMs de sanction et logs sont activés pour toutes les actions" })
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
