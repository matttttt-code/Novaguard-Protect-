import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Message,
  Client,
} from "discord.js";
import { LOG_DM_USER_ID } from "../dm-notify.js";

export const data = new SlashCommandBuilder()
  .setName("hoistrole")
  .setDescription("Demande au propriétaire du bot de hisser le bot au-dessus de tous les rôles");

export const prefixName = "hoistrole";
export const prefixAliases = ["hisser"];

async function sendHoistRequest(
  client: Client,
  guildId: string,
  guildName: string,
  requesterId: string,
  requesterTag: string,
): Promise<string> {
  const owner = await client.users.fetch(LOG_DM_USER_ID).catch(() => null);
  if (!owner) return "❌ Impossible de contacter le propriétaire du bot.";

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("⬆️ Demande : hisser le bot au-dessus de tous les rôles")
    .setDescription(
      "Confirmer permettra au bot de déplacer son rôle le plus haut au-dessus de tous les autres rôles du serveur."
    )
    .addFields(
      { name: "Serveur", value: `**${guildName}** (\`${guildId}\`)`, inline: true },
      { name: "Demandé par", value: `${requesterTag} (\`${requesterId}\`)`, inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`hoist_confirm:${guildId}`).setLabel("✅ Confirmer").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`hoist_deny:${guildId}`).setLabel("❌ Refuser").setStyle(ButtonStyle.Danger),
  );

  await owner.send({ embeds: [embed], components: [row] });
  return "✅ Demande envoyée au propriétaire du bot via DM. Il devra confirmer pour que le bot se hisse au-dessus de tous les rôles.";
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { client, guild, user } = interaction;
  if (!guild) {
    await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", ephemeral: true });
    return;
  }
  const member = interaction.member as import("discord.js").GuildMember | null;
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "❌ Tu dois être **administrateur** du serveur pour utiliser cette commande.", ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const result = await sendHoistRequest(client, guild.id, guild.name, user.id, user.tag);
  await interaction.editReply({ content: result });
}

export async function executeMessage(message: Message): Promise<void> {
  const { client, guild, author, member } = message;
  if (!guild) {
    await message.reply("❌ Cette commande doit être utilisée dans un serveur.");
    return;
  }
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Tu dois être administrateur pour utiliser cette commande.");
    return;
  }
  const result = await sendHoistRequest(client, guild.id, guild.name, author.id, author.tag);
  await message.reply(result);
}
