import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";

const UNICODE_EMOJIS = [
  "😀","😂","🤣","😍","🥰","😎","🤩","🥳","🫡","🤔","😏","😴","🥱","😤","🤯","🥶","🔥",
  "✨","💫","🌟","⭐","🎉","🎊","🎈","🎁","🎀","🎶","🎵","🎸","🎹","🎤","🎧","🏆","🥇",
  "💎","👑","🦋","🌸","🌺","🌼","🌻","🍀","🌈","❄️","🌊","🦄","🐉","🦊","🐺","🐼","🦁",
  "🍕","🍔","🍜","🍣","🍩","🍪","🎂","🍫","🧁","🍦","🧃","🍵","☕","🍷","🥤","🧋",
  "🚀","🛸","🌙","🌍","💻","📱","🎮","🕹️","🎯","🎲","🎴","🃏","♟️","🧩","🏄","🏋️",
  "💪","🙏","👏","🤝","✌️","🤞","👋","🫶","❤️","🧡","💛","💚","💙","💜","🖤","🤍",
  "😈","👻","🤖","👾","🎃","🦸","🧙","🧜","🧝","🧞","🦹","🥷","🎭","🫠","🥸","🤡",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildEmojiPool(client: ChatInputCommandInteraction["client"]): string[] {
  const customEmojis: string[] = [];

  for (const guild of client.guilds.cache.values()) {
    for (const emoji of guild.emojis.cache.values()) {
      if (!emoji.available) continue;
      const fmt = emoji.animated
        ? `<a:${emoji.name}:${emoji.id}>`
        : `<:${emoji.name}:${emoji.id}>`;
      customEmojis.push(fmt);
    }
  }

  return [...customEmojis, ...UNICODE_EMOJIS];
}

export const data = new SlashCommandBuilder()
  .setName("randomemoji")
  .setDescription("Envoie un emoji aléatoire parmi tous ceux disponibles (serveur + unicode)");

export async function execute(interaction: ChatInputCommandInteraction) {
  const pool = buildEmojiPool(interaction.client);
  const emoji = pickRandom(pool);

  const embed = new EmbedBuilder()
    .setColor(0xa855f7)
    .setDescription(`# ${emoji}`)
    .setFooter({ text: `Pioché parmi ${pool.length} emojis disponibles` });

  await interaction.reply({ embeds: [embed] });
}

export const prefixName = "randomemoji";
export const prefixAliases = ["remoji", "randemoji"];

export async function executeMessage(message: Message) {
  const pool = buildEmojiPool(message.client);
  const emoji = pickRandom(pool);

  const embed = new EmbedBuilder()
    .setColor(0xa855f7)
    .setDescription(`# ${emoji}`)
    .setFooter({ text: `Pioché parmi ${pool.length} emojis disponibles` });

  await message.reply({ embeds: [embed] });
}
