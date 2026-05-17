import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLogDM, LOG_DM_USER_ID } from "../dm-notify.js";

async function sendShutdownDM(client: import("discord.js").Client): Promise<void> {
  const uptimeMin = Math.floor(process.uptime() / 60);
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const wsPing = client.ws.ping;

  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔴 Redémarrage manuel — Bot déconnecté")
    .addFields(
      { name: "Uptime",    value: `**${uptimeMin} min**`, inline: true },
      { name: "Mémoire",   value: `**${heapMB} MB** heap`, inline: true },
      { name: "Ping WS",   value: wsPing >= 0 ? `**${wsPing} ms**` : "N/A", inline: true },
    )
    .setTimestamp()
  );
}

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
      .setColor(0xf59e0b)
      .setTitle("🔄 Redémarrage en cours...")
      .setDescription("Le bot va se déconnecter et redémarrer automatiquement.")
      .setTimestamp()],
  });

  // Envoie le DM de shutdown puis quitte proprement (exit 0 → boucle dev relance le process)
  setTimeout(async () => {
    await sendShutdownDM(interaction.client);
    process.exit(0);
  }, 800);

  return;
}

export const prefixName = "restart";

export async function executeMessage(message: Message, _args: string[]) {
  if (message.author.id !== LOG_DM_USER_ID) {
    await message.reply("❌ Cette commande est réservée au propriétaire du bot.");
    return;
  }

  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🔄 Redémarrage en cours...")
      .setDescription("Le bot va se déconnecter et redémarrer automatiquement.")
      .setTimestamp()],
  });

  setTimeout(async () => {
    await sendShutdownDM(message.client);
    process.exit(0);
  }, 800);
}
