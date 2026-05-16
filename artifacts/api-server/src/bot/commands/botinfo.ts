import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  Client,
} from "discord.js";

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}j ${h}h ${m}m ${sec}s`;
}

function buildBotInfoEmbed(client: Client): EmbedBuilder {
  const guilds = client.guilds.cache.size;
  const users = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const uptime = client.uptime ?? 0;
  const ping = client.ws.ping;

  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`🤖 Informations — ${client.user!.tag}`)
    .setThumbnail(client.user!.displayAvatarURL())
    .addFields(
      { name: "🆔 ID du bot", value: `\`${client.user!.id}\``, inline: true },
      { name: "📡 Latence", value: `${ping}ms`, inline: true },
      { name: "⏱️ Uptime", value: formatUptime(uptime), inline: true },
      { name: "🏠 Serveurs", value: String(guilds), inline: true },
      { name: "👥 Membres totaux", value: String(users), inline: true },
      { name: "📚 Librairie", value: "discord.js v14", inline: true },
      { name: "🟢 Node.js", value: process.version, inline: true },
      {
        name: "💾 Mémoire",
        value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        inline: true,
      }
    )
    .setFooter({ text: "Bot de modération" })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Affiche les informations du bot");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = buildBotInfoEmbed(interaction.client);
  return interaction.reply({ embeds: [embed] });
}

export const prefixName = "info";
export const prefixAliases = ["botinfo", "bot"];

export async function executeMessage(message: Message) {
  const embed = buildBotInfoEmbed(message.client);
  await message.reply({ embeds: [embed] });
}
