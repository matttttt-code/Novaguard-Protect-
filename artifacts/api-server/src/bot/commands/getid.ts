import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  Role,
  GuildChannel,
  EmbedBuilder,
  Message,
  ChannelType,
} from "discord.js";

function buildIdEmbed(
  label: string,
  name: string,
  id: string,
  extra?: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🆔 Identifiant Discord")
    .addFields(
      { name: "Type", value: label, inline: true },
      { name: "Nom", value: name, inline: true },
      { name: "ID", value: `\`${id}\``, inline: false },
      ...(extra ? [{ name: "Mention", value: extra, inline: true }] : [])
    )
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("getid")
  .setDescription("Récupère l'ID d'un membre, rôle ou salon")
  .addSubcommand((sub) =>
    sub
      .setName("membre")
      .setDescription("ID d'un membre")
      .addUserOption((o) =>
        o.setName("cible").setDescription("Le membre").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("role")
      .setDescription("ID d'un rôle")
      .addRoleOption((o) =>
        o.setName("cible").setDescription("Le rôle").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("salon")
      .setDescription("ID d'un salon")
      .addChannelOption((o) =>
        o.setName("cible").setDescription("Le salon").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "membre") {
    const member = interaction.options.getMember("cible") as GuildMember | null;
    const user = interaction.options.getUser("cible");
    if (!user) return interaction.reply({ content: "Introuvable.", ephemeral: true });
    const embed = buildIdEmbed("👤 Membre", user.tag, user.id, `<@${user.id}>`);
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "role") {
    const role = interaction.options.getRole("cible") as Role | null;
    if (!role) return interaction.reply({ content: "Introuvable.", ephemeral: true });
    const embed = buildIdEmbed("🎭 Rôle", role.name, role.id, `<@&${role.id}>`);
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "salon") {
    const channel = interaction.options.getChannel("cible") as GuildChannel | null;
    if (!channel) return interaction.reply({ content: "Introuvable.", ephemeral: true });
    const isText = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
    const embed = buildIdEmbed(
      "📢 Salon",
      channel.name,
      channel.id,
      isText ? `<#${channel.id}>` : undefined
    );
    return interaction.reply({ embeds: [embed] });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "getid";
export const prefixAliases = ["id"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;

  const mention = args[0];
  if (!mention) {
    await message.reply("Usage : `&getid @membre`, `&getid @rôle`, `&getid #salon`");
    return;
  }

  const userId = mention.match(/^<@!?(\d+)>$/)?.[1];
  const roleId = mention.match(/^<@&(\d+)>$/)?.[1];
  const channelId = mention.match(/^<#(\d+)>$/)?.[1];

  if (userId) {
    try {
      const member = await message.guild.members.fetch(userId);
      const embed = buildIdEmbed("👤 Membre", member.user.tag, userId, `<@${userId}>`);
      await message.reply({ embeds: [embed] });
    } catch {
      await message.reply("❌ Membre introuvable.");
    }
    return;
  }

  if (roleId) {
    const role = message.guild.roles.cache.get(roleId);
    if (!role) { await message.reply("❌ Rôle introuvable."); return; }
    const embed = buildIdEmbed("🎭 Rôle", role.name, roleId, `<@&${roleId}>`);
    await message.reply({ embeds: [embed] });
    return;
  }

  if (channelId) {
    const channel = message.guild.channels.cache.get(channelId) as GuildChannel | undefined;
    if (!channel) { await message.reply("❌ Salon introuvable."); return; }
    const embed = buildIdEmbed("📢 Salon", channel.name, channelId, `<#${channelId}>`);
    await message.reply({ embeds: [embed] });
    return;
  }

  await message.reply("❌ Mention invalide. Utilise `&getid @membre`, `&getid @rôle` ou `&getid #salon`.");
}
