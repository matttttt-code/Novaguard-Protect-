import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  Events,
  Client,
  TextChannel,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";
import { logger } from "../../lib/logger.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Store persistant ──────────────────────────────────────────────────────────
const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "antighostping.json");
let enabledGuilds = new Set<string>();

function saveToDisk(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify([...enabledGuilds], null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[antighostping] save failed"); }
}

function loadFromDisk(): void {
  try {
    if (!existsSync(FILE)) return;
    const arr = JSON.parse(readFileSync(FILE, "utf8")) as string[];
    enabledGuilds = new Set(arr);
  } catch (err) { logger.error({ err }, "[antighostping] load failed"); }
}

loadFromDisk();

export function isAntighostpingEnabled(guildId: string): boolean { return enabledGuilds.has(guildId); }
export function setAntighostping(guildId: string, enabled: boolean): void {
  if (enabled) enabledGuilds.add(guildId); else enabledGuilds.delete(guildId);
  saveToDisk();
}

// ── Détection ghost-ping ──────────────────────────────────────────────────────
const MENTION_REGEX = /<@!?(\d+)>|<@&(\d+)>|@everyone|@here/;

export function registerAntiGhostPing(client: Client): void {
  // Cache: messageId → { mentions, authorId, channelId, guildId, content }
  interface CachedMsg {
    mentions: string[];
    roleMentions: string[];
    hasEveryone: boolean;
    hasHere: boolean;
    authorId: string;
    authorTag: string;
    channelId: string;
    guildId: string;
    content: string;
  }
  const cache = new Map<string, CachedMsg>();

  client.on(Events.MessageCreate, (msg) => {
    if (!msg.guild || msg.author.bot) return;
    if (!enabledGuilds.has(msg.guild.id)) return;
    const hasMention =
      msg.mentions.users.size > 0 ||
      msg.mentions.roles.size > 0 ||
      msg.mentions.everyone;
    if (!hasMention) return;

    cache.set(msg.id, {
      mentions: msg.mentions.users.map((u) => u.id),
      roleMentions: msg.mentions.roles.map((r) => r.id),
      hasEveryone: msg.mentions.everyone,
      hasHere: msg.content.includes("@here"),
      authorId: msg.author.id,
      authorTag: msg.author.tag,
      channelId: msg.channelId,
      guildId: msg.guild.id,
      content: msg.content.slice(0, 500),
    });

    // Nettoyage du cache après 2 min
    setTimeout(() => cache.delete(msg.id), 2 * 60 * 1000);
  });

  client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guild) return;
    if (!enabledGuilds.has(msg.guild.id)) return;
    const cached = cache.get(msg.id);
    if (!cached) return;
    cache.delete(msg.id);

    const hasMentions = cached.mentions.length > 0 || cached.roleMentions.length > 0 || cached.hasEveryone || cached.hasHere;
    if (!hasMentions) return;

    const mentionList = [
      ...cached.mentions.map((id) => `<@${id}>`),
      ...cached.roleMentions.map((id) => `<@&${id}>`),
      ...(cached.hasEveryone ? ["@everyone"] : []),
      ...(cached.hasHere ? ["@here"] : []),
    ].join(", ");

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("👻 Ghost-ping détecté")
      .addFields(
        { name: "Auteur", value: `<@${cached.authorId}> (\`${cached.authorTag}\`)`, inline: true },
        { name: "Salon", value: `<#${cached.channelId}>`, inline: true },
        { name: "Mentions", value: mentionList },
        { name: "Contenu (tronqué)", value: `\`\`\`${cached.content || "(vide)"}\`\`\`` },
      )
      .setTimestamp();

    // Alerte dans le salon d'origine
    try {
      const channel = await client.channels.fetch(cached.channelId).catch(() => null) as TextChannel | null;
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] }).catch(() => null);
      }
    } catch { /* silent */ }

    // Log de modération
    await sendLog(client, logEmbed(0xf59e0b, "👻 Ghost-ping détecté", [
      { name: "Auteur", value: `${cached.authorTag} (\`${cached.authorId}\`)`, inline: true },
      { name: "Salon", value: `<#${cached.channelId}>`, inline: true },
      { name: "Mentions", value: mentionList },
    ], { tag: "Automod", id: "0" }), { guildId: cached.guildId });
  });
}

// ── Commande slash ────────────────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName("antighostping")
  .setDescription("Activer/désactiver la détection de ghost-pings")
  .addBooleanOption((o) => o.setName("actif").setDescription("Activer ou désactiver").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });
  const enabled = interaction.options.getBoolean("actif", true);
  setAntighostping(interaction.guildId, enabled);
  return interaction.reply({ content: enabled ? "✅ Détection des ghost-pings **activée**. Les suppressions de messages avec mentions seront signalées dans le salon et dans les logs." : "✅ Détection des ghost-pings **désactivée**.", ephemeral: true });
}

export const prefixName = "antighostping";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Permission insuffisante."); return;
  }
  const arg = args[0]?.toLowerCase();
  if (!arg || !["on", "off", "activer", "désactiver"].includes(arg)) {
    const current = enabledGuilds.has(message.guild.id);
    await message.reply(`Anti ghost-ping est actuellement **${current ? "activé" : "désactivé"}**. Usage : \`&antighostping on|off\``); return;
  }
  const enabled = arg === "on" || arg === "activer";
  setAntighostping(message.guild.id, enabled);
  await message.reply(enabled ? "✅ Détection des ghost-pings **activée**." : "✅ Détection des ghost-pings **désactivée**.");
}
