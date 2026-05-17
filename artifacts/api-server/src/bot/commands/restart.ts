import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";
import { LOG_DM_USER_ID } from "../dm-notify.js";

export const data = new SlashCommandBuilder()
  .setName("restart")
  .setDescription("Redémarre le bot (propriétaire uniquement)")
  .setDefaultMemberPermissions(0n);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.user.id !== LOG_DM_USER_ID) {
    return interaction.reply({ content: "❌ Cette commande est réservée au propriétaire du bot.", ephemeral: true });
  }

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("🔄 Redémarrage en cours...")
      .setDescription("Le bot va redémarrer dans quelques secondes.")
      .setTimestamp()],
  });

  setTimeout(() => process.exit(1), 1500);
  return;
}

export const prefixName = "restart";

export async function executeMessage(message: Message, _args: string[]) {
  if (!message.guild || !message.member) return;

  if (message.author.id !== LOG_DM_USER_ID) {
    await message.reply("❌ Cette commande est réservée au propriétaire du bot.");
    return;
  }

  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("🔄 Redémarrage en cours...")
      .setDescription("Le bot va redémarrer dans quelques secondes.")
      .setTimestamp()],
  });

  setTimeout(() => process.exit(1), 1500);
}
