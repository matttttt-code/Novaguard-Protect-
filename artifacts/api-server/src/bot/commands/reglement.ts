import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Message,
  TextChannel,
  ChannelType,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("reglement")
  .setDescription("Envoie le règlement dans un salon et ajoute une réaction :verification1:")
  .addChannelOption((o) =>
    o
      .setName("salon")
      .setDescription("Le salon où envoyer le règlement")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("texte")
      .setDescription("Le contenu du règlement")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel("salon", true) as TextChannel;
  const texte = interaction.options.getString("texte", true);

  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setDescription(texte)
    .setTimestamp();

  let sent;
  try {
    sent = await channel.send({ embeds: [embed] });
  } catch {
    await interaction.editReply({ content: `❌ Impossible d'envoyer le message dans <#${channel.id}>. Vérifie les permissions du bot.` });
    return;
  }

  const emoji = interaction.guild.emojis.cache.find((e) => e.name === "verification1");
  try {
    await sent.react(emoji ?? "✅");
  } catch {
    // emoji introuvable ou permissions manquantes — on continue sans erreur
  }

  await interaction.editReply({ content: `✅ Règlement envoyé dans <#${channel.id}>.` });
}

export const prefixName = "reglement";
export const prefixAliases = ["rules"];

export async function executeMessage(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;

  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Tu n'as pas la permission d'utiliser cette commande.");
    return;
  }

  const channelArg = args[0];
  const texte = args.slice(1).join(" ");

  if (!channelArg || !texte) {
    await message.reply("❌ Usage : `&reglement #salon Le texte du règlement ici`");
    return;
  }

  const channelId = channelArg.replace(/[<#>]/g, "");
  let channel: TextChannel;
  try {
    const fetched = await message.guild.channels.fetch(channelId);
    if (!fetched || fetched.type !== ChannelType.GuildText) {
      await message.reply("❌ Salon introuvable ou invalide.");
      return;
    }
    channel = fetched as TextChannel;
  } catch {
    await message.reply("❌ Salon introuvable.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setDescription(texte)
    .setTimestamp();

  let sent;
  try {
    sent = await channel.send({ embeds: [embed] });
  } catch {
    await message.reply(`❌ Impossible d'envoyer le message dans <#${channel.id}>. Vérifie les permissions du bot.`);
    return;
  }

  const emoji = message.guild.emojis.cache.find((e) => e.name === "verification1");
  try {
    await sent.react(emoji ?? "✅");
  } catch {
    // emoji introuvable ou permissions manquantes
  }

  await message.reply(`✅ Règlement envoyé dans <#${channel.id}>.`);
}
