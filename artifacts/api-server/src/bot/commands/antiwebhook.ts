import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Message,
} from "discord.js";
import { setAntiWebhookEnabled, getConfig } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("antiwebhook")
  .setDescription("Active ou désactive la suppression automatique des messages de webhooks non autorisés")
  .addSubcommand((s) => s.setName("activer").setDescription("Active l'anti-webhook"))
  .addSubcommand((s) => s.setName("désactiver").setDescription("Désactive l'anti-webhook"))
  .addSubcommand((s) => s.setName("statut").setDescription("Affiche le statut actuel"))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === "activer") {
    setAntiWebhookEnabled(guildId, true);
    return interaction.reply({ content: "✅ Anti-webhook **activé** — les messages de webhooks non officiels seront automatiquement supprimés et signalés.", ephemeral: true });
  }

  if (sub === "désactiver") {
    setAntiWebhookEnabled(guildId, false);
    return interaction.reply({ content: "❌ Anti-webhook **désactivé**.", ephemeral: true });
  }

  if (sub === "statut") {
    const enabled = getConfig(guildId).antiWebhookEnabled;
    return interaction.reply({ content: `ℹ️ Anti-webhook : ${enabled ? "✅ Actif" : "❌ Inactif"}`, ephemeral: true });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "antiwebhook";
export const prefixAliases = ["awh", "webhookguard"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;

  if (sub === "activer") {
    setAntiWebhookEnabled(guildId, true);
    await message.reply("✅ Anti-webhook **activé**."); return;
  }
  if (sub === "désactiver" || sub === "desactiver") {
    setAntiWebhookEnabled(guildId, false);
    await message.reply("❌ Anti-webhook **désactivé**."); return;
  }
  const enabled = getConfig(guildId).antiWebhookEnabled;
  await message.reply(`ℹ️ Anti-webhook : ${enabled ? "✅ Actif" : "❌ Inactif"}`);
}
