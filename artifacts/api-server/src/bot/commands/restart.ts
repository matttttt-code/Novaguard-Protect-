import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  Events,
  Client,
} from "discord.js";
import { sendLogDM, LOG_DM_USER_ID } from "../dm-notify.js";

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function doRestart(client: Client): Promise<void> {
  const uptimeMin = Math.floor(process.uptime() / 60);
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const wsPing = client.ws.ping;

  // 1. DM shutdown — envoyé avant toute déconnexion
  await sendLogDM(client, new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🔴 Redémarrage manuel — Bot déconnecté")
    .addFields(
      { name: "Uptime", value: `**${uptimeMin} min**`, inline: true },
      { name: "Mémoire", value: `**${heapMB} MB** heap`, inline: true },
      { name: "Ping WS", value: wsPing >= 0 ? `**${wsPing} ms**` : "N/A", inline: true },
    )
    .setTimestamp()
  );

  // 2. Inscrit un listener one-shot AVANT la déconnexion pour le DM "en ligne"
  client.once(Events.ClientReady, async (readyClient) => {
    await sendLogDM(readyClient, new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("🟢 Bot reconnecté (redémarrage manuel)")
      .addFields(
        { name: "Tag", value: readyClient.user.tag, inline: true },
        { name: "Serveurs", value: `**${readyClient.guilds.cache.size}**`, inline: true },
        { name: "Ping WS", value: readyClient.ws.ping >= 0 ? `**${readyClient.ws.ping} ms**` : "en attente…", inline: true },
      )
      .setTimestamp()
    ).catch(() => null);
  });

  // 3. Déconnexion puis reconnexion
  await client.destroy();
  // Pause de 3s pour que la déconnexion soit visible sur Discord
  await sleep(3000);
  const token = process.env["DISCORD_TOKEN"]!;
  await client.login(token);
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
      .setDescription("Déconnexion et reconnexion à Discord. DM envoyé à la fin.")
      .setTimestamp()],
  });

  setTimeout(() => void doRestart(interaction.client), 800);
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
      .setColor(0xf59e0b)
      .setTitle("🔄 Redémarrage en cours...")
      .setDescription("Déconnexion et reconnexion à Discord. DM envoyé à la fin.")
      .setTimestamp()],
  });

  setTimeout(() => void doRestart(message.client), 800);
}
