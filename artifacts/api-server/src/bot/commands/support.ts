import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  Client,
} from "discord.js";
import { addSupportRequest, hasSupportRequest } from "../pending-support-store.js";
import { sendLog, LOG_CHANNEL_ID } from "../log.js";
import { getConfig } from "../guild-config-store.js";

const QUESTIONNAIRE = `Bonjour ! Pour t'aider au mieux, réponds à ce message avec un seul message contenant les réponses suivantes :

**1.** Quel est ton problème ou ta demande ?
**2.** Depuis quand as-tu ce problème ?
**3.** As-tu déjà contacté un modérateur à ce sujet ?
**4.** Y a-t-il autre chose que tu souhaites nous signaler ?

> Réponds en un seul message — il sera transmis à l'équipe du staff.
> *(Expiration dans 10 minutes)*`;

async function sendQuestionnaire(
  userId: string,
  guildId: string,
  guildName: string,
  channelId: string,
  client: Message["client"]
): Promise<boolean> {
  try {
    const user = await client.users.fetch(userId);
    await user.send(QUESTIONNAIRE);
    addSupportRequest(userId, {
      guildId,
      guildName,
      channelId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return true;
  } catch {
    return false;
  }
}

export const data = new SlashCommandBuilder()
  .setName("support")
  .setDescription("Reçois un questionnaire d'aide en DM — transmis au staff");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  if (hasSupportRequest(interaction.user.id)) {
    return interaction.reply({ content: "⚠️ Tu as déjà une demande de support en attente. Réponds au message en DM.", ephemeral: true });
  }

  const config = getConfig(interaction.guildId!);
  const channelId = config.logChannelId ?? LOG_CHANNEL_ID;

  const sent = await sendQuestionnaire(interaction.user.id, interaction.guildId!, interaction.guild.name, channelId, interaction.client);

  if (!sent) {
    return interaction.reply({ content: "❌ Impossible de t'envoyer un DM. Vérifie que tes DMs sont ouverts.", ephemeral: true });
  }

  return interaction.reply({ content: "✅ Un questionnaire t'a été envoyé en DM ! Réponds-y pour contacter le staff.", ephemeral: true });
}

export const prefixName = "support";
export const prefixAliases = ["aide", "help2"];

export async function executeMessage(message: Message) {
  if (!message.guild) return;

  if (hasSupportRequest(message.author.id)) {
    await message.reply("⚠️ Tu as déjà une demande de support en attente. Réponds au message en DM."); return;
  }

  const config = getConfig(message.guild.id);
  const channelId = config.logChannelId ?? LOG_CHANNEL_ID;

  const sent = await sendQuestionnaire(message.author.id, message.guild.id, message.guild.name, channelId, message.client);

  if (!sent) {
    await message.reply("❌ Impossible de t'envoyer un DM. Vérifie que tes DMs sont ouverts."); return;
  }

  await message.reply("✅ Un questionnaire t'a été envoyé en DM ! Réponds-y pour contacter le staff.");
}

export async function handleSupportResponse(
  client: Client,
  userId: string,
  guildId: string,
  guildName: string,
  logChannelId: string,
  responseContent: string,
  username: string
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("📩 Réponse Support reçue")
    .setDescription(responseContent.slice(0, 1024))
    .addFields(
      { name: "Utilisateur", value: `${username} (\`${userId}\`)`, inline: true },
      { name: "Serveur", value: guildName, inline: true }
    )
    .setTimestamp();

  await sendLog(client, embed, { guildId });
}
