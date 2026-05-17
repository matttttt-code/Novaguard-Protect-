import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  Message,
  WebhookClient,
  ChannelType,
} from "discord.js";
import { getConfig } from "../guild-config-store.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getOrFetchWebhook(channel: TextChannel, name: string) {
  const webhooks = await channel.guild.fetchWebhooks().catch(() => null);
  return webhooks?.find(w => w.channelId === channel.id && w.name.toLowerCase() === name.toLowerCase()) ?? null;
}

async function getWebhookByName(channel: TextChannel, name: string) {
  const webhooks = await channel.guild.fetchWebhooks().catch(() => null);
  return webhooks?.find(w => w.name.toLowerCase() === name.toLowerCase()) ?? null;
}

async function listTestWebhooks(guildId: string, channel: TextChannel) {
  const webhooks = await channel.guild.fetchWebhooks().catch(() => null);
  if (!webhooks) return [];
  return [...webhooks.values()].filter(w => w.name.startsWith("[TestBot] "));
}

// ─── Slash ─────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("creetestbot")
  .setDescription("Crée et gère des bots de test (webhooks) pour tester les commandes")
  .addSubcommand(s => s
    .setName("créer")
    .setDescription("Crée un bot de test dans ce salon")
    .addStringOption(o => o.setName("nom").setDescription("Nom du bot de test").setRequired(true))
  )
  .addSubcommand(s => s
    .setName("message")
    .setDescription("Envoie un message en tant que bot de test")
    .addStringOption(o => o.setName("nom").setDescription("Nom du bot de test").setRequired(true))
    .addStringOption(o => o.setName("texte").setDescription("Message à envoyer").setRequired(true))
  )
  .addSubcommand(s => s
    .setName("spam")
    .setDescription("Envoie un burst de messages pour tester la détection de spam (visuel)")
    .addStringOption(o => o.setName("nom").setDescription("Nom du bot de test").setRequired(true))
    .addIntegerOption(o => o.setName("nombre").setDescription("Nombre de messages (défaut : 6)").setMinValue(2).setMaxValue(10))
  )
  .addSubcommand(s => s
    .setName("insulte")
    .setDescription("Envoie un message d'insulte pour tester la détection (visuel)")
    .addStringOption(o => o.setName("nom").setDescription("Nom du bot de test").setRequired(true))
  )
  .addSubcommand(s => s
    .setName("lien")
    .setDescription("Envoie un lien non autorisé pour tester la détection (visuel)")
    .addStringOption(o => o.setName("nom").setDescription("Nom du bot de test").setRequired(true))
  )
  .addSubcommand(s => s
    .setName("liste")
    .setDescription("Affiche tous les bots de test créés sur ce serveur")
  )
  .addSubcommand(s => s
    .setName("supprimer")
    .setDescription("Supprime un bot de test")
    .addStringOption(o => o.setName("nom").setDescription("Nom du bot de test à supprimer").setRequired(true))
  )
  .setDefaultMemberPermissions(0n);

export const prefixName = "creetestbot";
export const prefixAliases = ["ctb", "testbot"];

// ─── Core logic ────────────────────────────────────────────────────────────

async function handleCreer(
  guildId: string,
  channel: TextChannel,
  nomRaw: string,
  reply: (opts: { content?: string; embeds?: EmbedBuilder[]; ephemeral?: boolean }) => Promise<unknown>,
) {
  const nom = `[TestBot] ${nomRaw.slice(0, 70)}`;
  const existing = await getOrFetchWebhook(channel, nom);
  if (existing) {
    await reply({ content: `❌ Un bot de test nommé **${nomRaw}** existe déjà dans ce salon.`, ephemeral: true });
    return;
  }
  const webhook = await channel.createWebhook({
    name: nom,
    reason: `Bot de test créé via /creetestbot par un admin`,
  }).catch(() => null);
  if (!webhook) {
    await reply({ content: "❌ Impossible de créer le webhook (vérifier les permissions).", ephemeral: true });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🤖 Bot de test créé")
    .addFields(
      { name: "Nom", value: `**${nomRaw}**`, inline: true },
      { name: "Salon", value: `<#${channel.id}>`, inline: true },
      { name: "ID Webhook", value: `\`${webhook.id}\``, inline: true },
    )
    .addFields({
      name: "⚠️ Limites des bots de test",
      value: [
        "• Ils peuvent envoyer des messages, tester l'apparence du logging",
        "• L'**automod** ne les sanctionne pas (pas de GuildMember)",
        "• Pour tester ban/kick/warn, cible un vrai utilisateur",
      ].join("\n"),
    })
    .setFooter({ text: "Utilise /creetestbot message <nom> <texte> pour envoyer un message" })
    .setTimestamp();
  await reply({ embeds: [embed] });
}

async function handleMessage(
  channel: TextChannel,
  nomRaw: string,
  texte: string,
  reply: (opts: { content?: string; ephemeral?: boolean }) => Promise<unknown>,
) {
  const nom = `[TestBot] ${nomRaw.slice(0, 70)}`;
  const wh = await getWebhookByName(channel, nom);
  if (!wh || wh.channelId !== channel.id) {
    await reply({ content: `❌ Bot de test **${nomRaw}** introuvable dans ce salon. Crée-le d'abord avec \`/creetestbot créer\`.`, ephemeral: true });
    return;
  }
  const whClient = new WebhookClient({ id: wh.id, token: wh.token! });
  await whClient.send({ content: texte }).catch(() => null);
  await reply({ content: `✅ Message envoyé en tant que **${nomRaw}**.`, ephemeral: true });
}

async function handleSpam(
  channel: TextChannel,
  nomRaw: string,
  nombre: number,
  reply: (opts: { content?: string; ephemeral?: boolean }) => Promise<unknown>,
) {
  const nom = `[TestBot] ${nomRaw.slice(0, 70)}`;
  const wh = await getWebhookByName(channel, nom);
  if (!wh || wh.channelId !== channel.id) {
    await reply({ content: `❌ Bot de test **${nomRaw}** introuvable dans ce salon.`, ephemeral: true });
    return;
  }
  const whClient = new WebhookClient({ id: wh.id, token: wh.token! });
  await reply({ content: `⏳ Envoi de ${nombre} messages de spam (test visuel)…`, ephemeral: true });
  const spamMessages = [
    "Test spam message 1 !!!",
    "Test spam message 2 !!!",
    "Test spam message 3 !!!",
    "Test spam message 4 !!!",
    "Test spam message 5 !!!",
    "Test spam message 6 !!!",
    "Test spam message 7 !!!",
    "Test spam message 8 !!!",
    "Test spam message 9 !!!",
    "Test spam message 10 !!!",
  ];
  for (let i = 0; i < nombre; i++) {
    await whClient.send({ content: spamMessages[i] ?? `Test spam ${i + 1}` }).catch(() => null);
    await new Promise(r => setTimeout(r, 200));
  }
}

async function handleInsulte(
  guildId: string,
  channel: TextChannel,
  nomRaw: string,
  reply: (opts: { content?: string; ephemeral?: boolean }) => Promise<unknown>,
) {
  const nom = `[TestBot] ${nomRaw.slice(0, 70)}`;
  const wh = await getWebhookByName(channel, nom);
  if (!wh || wh.channelId !== channel.id) {
    await reply({ content: `❌ Bot de test **${nomRaw}** introuvable dans ce salon.`, ephemeral: true });
    return;
  }
  const cfg = getConfig(guildId);
  const mot = cfg.antiInsultWords[0] ?? "idiot";
  const whClient = new WebhookClient({ id: wh.id, token: wh.token! });
  await whClient.send({ content: `Test détection insulte : ${mot}` }).catch(() => null);
  await reply({ content: `✅ Message d'insulte de test envoyé (\`${mot}\`). Note : l'automod ne sanctionne pas les webhooks.`, ephemeral: true });
}

async function handleLien(
  channel: TextChannel,
  nomRaw: string,
  reply: (opts: { content?: string; ephemeral?: boolean }) => Promise<unknown>,
) {
  const nom = `[TestBot] ${nomRaw.slice(0, 70)}`;
  const wh = await getWebhookByName(channel, nom);
  if (!wh || wh.channelId !== channel.id) {
    await reply({ content: `❌ Bot de test **${nomRaw}** introuvable dans ce salon.`, ephemeral: true });
    return;
  }
  const whClient = new WebhookClient({ id: wh.id, token: wh.token! });
  await whClient.send({ content: "Test lien non autorisé : discord.gg/testlink123" }).catch(() => null);
  await reply({ content: "✅ Lien de test envoyé. Note : l'automod ne sanctionne pas les webhooks.", ephemeral: true });
}

async function handleListe(
  channel: TextChannel,
  reply: (opts: { content?: string; embeds?: EmbedBuilder[]; ephemeral?: boolean }) => Promise<unknown>,
) {
  const testBots = await listTestWebhooks(channel.id, channel);
  if (testBots.length === 0) {
    await reply({ content: "ℹ️ Aucun bot de test sur ce serveur. Crée-en un avec `/creetestbot créer <nom>`.", ephemeral: true });
    return;
  }
  const lines = testBots.map(w => {
    const nom = w.name.replace("[TestBot] ", "");
    return `• **${nom}** — <#${w.channelId}> · ID: \`${w.id}\``;
  });
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`🤖 Bots de test — ${testBots.length} créé(s)`)
    .setDescription(lines.join("\n"))
    .setTimestamp();
  await reply({ embeds: [embed], ephemeral: true });
}

async function handleSupprimer(
  channel: TextChannel,
  nomRaw: string,
  reply: (opts: { content?: string; ephemeral?: boolean }) => Promise<unknown>,
) {
  const nom = `[TestBot] ${nomRaw.slice(0, 70)}`;
  const wh = await getWebhookByName(channel, nom);
  if (!wh) {
    await reply({ content: `❌ Bot de test **${nomRaw}** introuvable.`, ephemeral: true });
    return;
  }
  await wh.delete("Suppression via /creetestbot supprimer").catch(() => null);
  await reply({ content: `✅ Bot de test **${nomRaw}** supprimé.`, ephemeral: true });
}

// ─── Slash execute ─────────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.user.id !== "1209963350218248203") {
    await interaction.reply({ content: "❌ Commande réservée au développeur du bot.", ephemeral: true });
    return;
  }
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });
    return;
  }
  const channel = interaction.channel as TextChannel | null;
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un salon texte.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const reply = (opts: { content?: string; embeds?: EmbedBuilder[]; ephemeral?: boolean }) =>
    interaction.editReply({ content: opts.content, embeds: opts.embeds });

  const sub = interaction.options.getSubcommand();

  if (sub === "créer") {
    const nom = interaction.options.getString("nom", true);
    await handleCreer(interaction.guild.id, channel, nom, reply);
  } else if (sub === "message") {
    const nom = interaction.options.getString("nom", true);
    const texte = interaction.options.getString("texte", true);
    await handleMessage(channel, nom, texte, reply);
  } else if (sub === "spam") {
    const nom = interaction.options.getString("nom", true);
    const nombre = interaction.options.getInteger("nombre") ?? 6;
    await handleSpam(channel, nom, nombre, reply);
  } else if (sub === "insulte") {
    const nom = interaction.options.getString("nom", true);
    await handleInsulte(interaction.guild.id, channel, nom, reply);
  } else if (sub === "lien") {
    const nom = interaction.options.getString("nom", true);
    await handleLien(channel, nom, reply);
  } else if (sub === "liste") {
    await handleListe(channel, reply);
  } else if (sub === "supprimer") {
    const nom = interaction.options.getString("nom", true);
    await handleSupprimer(channel, nom, reply);
  }
}

// ─── Prefix execute ────────────────────────────────────────────────────────

export async function executeMessage(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (message.author.id !== "1209963350218248203") {
    await message.reply("❌ Commande réservée au développeur du bot.");
    return;
  }
  const channel = message.channel as TextChannel;
  if (channel.type !== ChannelType.GuildText) {
    await message.reply("❌ Utilise cette commande dans un salon texte.");
    return;
  }

  const sub = args[0]?.toLowerCase();
  const reply = async (opts: { content?: string; embeds?: EmbedBuilder[]; ephemeral?: boolean }) => {
    await message.reply({ content: opts.content, embeds: opts.embeds });
  };

  if (!sub) {
    await message.reply(
      "**Usage :** `&creetestbot créer <nom>` | `message <nom> <texte>` | `spam <nom> [n]` | `insulte <nom>` | `lien <nom>` | `liste` | `supprimer <nom>`"
    );
    return;
  }

  if (sub === "créer" || sub === "creer") {
    const nom = args.slice(1).join(" ");
    if (!nom) { await message.reply("❌ Précise un nom : `&ctb créer MonBot`"); return; }
    await handleCreer(message.guild.id, channel, nom, reply);
  } else if (sub === "message" || sub === "msg") {
    const nom = args[1];
    const texte = args.slice(2).join(" ");
    if (!nom || !texte) { await message.reply("❌ Usage : `&ctb message <nom> <texte>`"); return; }
    await handleMessage(channel, nom, texte, reply);
  } else if (sub === "spam") {
    const nom = args[1];
    const nombre = parseInt(args[2] ?? "6", 10);
    if (!nom) { await message.reply("❌ Usage : `&ctb spam <nom> [nombre]`"); return; }
    await handleSpam(channel, nom, isNaN(nombre) ? 6 : Math.min(Math.max(nombre, 2), 10), reply);
  } else if (sub === "insulte") {
    const nom = args.slice(1).join(" ");
    if (!nom) { await message.reply("❌ Usage : `&ctb insulte <nom>`"); return; }
    await handleInsulte(message.guild.id, channel, nom, reply);
  } else if (sub === "lien") {
    const nom = args.slice(1).join(" ");
    if (!nom) { await message.reply("❌ Usage : `&ctb lien <nom>`"); return; }
    await handleLien(channel, nom, reply);
  } else if (sub === "liste") {
    await handleListe(channel, reply);
  } else if (sub === "supprimer" || sub === "delete") {
    const nom = args.slice(1).join(" ");
    if (!nom) { await message.reply("❌ Usage : `&ctb supprimer <nom>`"); return; }
    await handleSupprimer(channel, nom, reply);
  } else {
    await message.reply("❌ Sous-commande inconnue. Utilise `&ctb` pour voir l'aide.");
  }
}
