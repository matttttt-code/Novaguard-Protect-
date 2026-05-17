import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";

function buildEmbeds(): EmbedBuilder[] {
  const embed1 = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🔐 Niveaux de sécurité — Détails complets (1/3)")
    .setDescription("Chaque niveau **inclut tous les effets des niveaux inférieurs**.")
    .addFields(
      {
        name: "🟢 Niveau 1 — Normal (défaut)",
        value: [
          "Auto-modération standard active en permanence :",
          "• **Anti-spam** : 5 messages en 5s → expulsion + slowmode 5s",
          "• **Anti-émoji** : plus de 5 émojis par message → timeout 24h",
          "• **Anti-lien** : lien non autorisé → timeout 24h",
          "• **Anti-majuscules** : message 100 % en caps → timeout 24h",
          "• **Anti-insulte** ✅ actif → avertissement (liste configurable via `/antiinsult`)",
          "• **Anti-webhook** : si activé via `/antiwebhook` → suppression + alerte DM owner",
          "• Alerte DM owner si un membre reçoit un rôle **Administrateur**",
          "*Modérateurs (ManageMessages) exemptés de l'automod*",
        ].join("\n"),
      },
      {
        name: "🟡 Niveau 2 — Élevé",
        value: [
          "Tout le niveau 1, plus :",
          "• **Anti-insulte désactivé** à ce niveau (mesures plus strictes en N3)",
          "• Comptes de moins de **3 jours** : signalés comme suspects à l'arrivée + alerte DM owner",
          "• Détection de comptes suspects renforcée (`/secure suspicieux activer`)",
          "• Activation via `/secure niveau 2` (aucune validation supplémentaire requise)",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Page 1/3 — /secure voir pour l'état actuel" })
    .setTimestamp();

  const embed2 = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔐 Niveaux de sécurité — Détails complets (2/3)")
    .addFields(
      {
        name: "🔴 Niveau 3 — Maximum",
        value: [
          "Tout le niveau 2, plus :",
          "• **Double validation requise** : approbation owner du bot → confirmation admin du serveur",
          "• **À l'activation automatique** :",
          "  — DM envoyé à tous les membres **Administrateurs** du serveur",
          "  — Suppression de tous les **webhooks** existants",
          "  — Retrait de la permission **Connect** à @everyone sur tous les salons vocaux",
          "  — Vérification Discord → **Très haute** (numéro de téléphone requis)",
          "• **Passif continu** :",
          "  — Comptes < **7 jours** : timeout automatique **1 heure** à l'arrivée + DM owner",
          "  — Anti-webhook auto forcé",
          "  — Alerte DM owner pour tout compte suspect",
        ].join("\n"),
      },
      {
        name: "⚙️ Commandes de gestion des niveaux",
        value: [
          "`/secure voir` · `&secure voir` — État actuel complet",
          "`/secure niveau <1|2|3>` · `&secure niveau <1|2|3>` — Change le niveau",
          "`/secure suspicieux activer|désactiver` — Détection comptes suspects",
          "`/antiinsult activer|désactiver|ajouter|retirer|liste|charger-defaults`",
          "`/antiwebhook activer|désactiver|statut`",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Page 2/3 — Niveau 3 requiert approbation owner + admin" })
    .setTimestamp();

  const embed3 = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("🔐 Niveaux de sécurité — Détails complets (3/3)")
    .addFields(
      {
        name: "🚨 Anti-Raid Niveau 1 (Raid Mode)",
        value: [
          "Activation : `/raidmode activer` · `&raidmode activer`",
          "• Tout membre qui rejoint est **immédiatement expulsé**",
          "• Join Lock alternatif : `/joinlock activer` — bloque les arrivées sans expulser",
          "Désactivation : `/raidmode désactiver`",
        ].join("\n"),
      },
      {
        name: "🛡️ Anti-Raid Niveau 2 — Effets complets",
        value: [
          "Activation : `/raidmode niveau2-activer` → demande envoyée au **owner du bot** pour validation",
          "**À l'approbation, application automatique immédiate :**",
          "• Révocation de toutes les **invitations** actives du serveur",
          "• Suppression de tous les **webhooks** existants",
          "• Vérification Discord → **Haute** (numéro de téléphone requis)",
          "• Log @here dans le salon logs avec la liste de tous les effets",
          "**Passif continu tant que N2 actif :**",
          "• Tout nouveau **salon** créé → suppression auto + alerte DM owner (avec nom du créateur)",
          "• Tout nouveau **rôle** créé → suppression auto + alerte DM owner (avec nom du créateur)",
          "• Tout nouveau **membre** qui rejoint → timeout **10 minutes** auto",
          "• Anti-spam renforcé : **3 messages en 3s** = expulsion (au lieu de 5/5s)",
          "Désactivation : `/raidmode niveau2-désactiver`",
        ].join("\n"),
      },
      {
        name: "🔑 Résumé des seuils",
        value: [
          "| Niveau | Anti-insulte | Spam | Comptes suspects | Validation |",
          "|--------|-------------|------|-----------------|------------|",
          "| **N1** | Warn | 5/5s | Non | Aucune |",
          "| **N2** | Désactivé | 5/5s | <3j signalé | Aucune |",
          "| **N3** | Désactivé | 5/5s | <7j timeout 1h | Owner + Admin |",
          "| **Raid N2** | — | **3/3s** | Timeout 10min | Owner seul |",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Page 3/3 — /raidmode pour gérer l'anti-raid" })
    .setTimestamp();

  return [embed1, embed2, embed3];
}

export const data = new SlashCommandBuilder()
  .setName("secureinfo")
  .setDescription("Explications détaillées de tous les niveaux de sécurité du bot");

export const prefixName = "secureinfo";
export const prefixAliases = ["secinfo", "niveaux"];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const [e1, e2, e3] = buildEmbeds();
  await interaction.reply({ embeds: [e1] });
  await interaction.followUp({ embeds: [e2] });
  await interaction.followUp({ embeds: [e3] });
}

export async function executeMessage(message: Message): Promise<void> {
  const [e1, e2, e3] = buildEmbeds();
  const ch = message.channel as import("discord.js").TextChannel;
  await message.reply({ embeds: [e1] });
  await ch.send({ embeds: [e2] });
  await ch.send({ embeds: [e3] });
}
