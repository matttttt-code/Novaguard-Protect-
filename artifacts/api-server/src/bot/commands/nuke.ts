import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ChannelType,
  Message,
} from "discord.js";
import { sendLog, logEmbed } from "../log.js";

export const data = new SlashCommandBuilder()
  .setName("nuke")
  .setDescription("Recrée un salon pour supprimer tout son historique")
  .addChannelOption((o) =>
    o.setName("salon").setDescription("Salon à nuker (défaut : actuel)")
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du nuke")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) { await interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true }); return; }

  const target = (interaction.options.getChannel("salon") as TextChannel | null) ?? (interaction.channel as TextChannel);
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

  if (!target || target.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "❌ Ce salon n'est pas un salon textuel.", ephemeral: true }); return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const position = target.position;
    const parent = target.parentId;
    const topic = target.topic ?? undefined;
    const nsfw = target.nsfw;
    const permOverwrites = target.permissionOverwrites.cache.map((po) => ({
      id: po.id,
      allow: po.allow,
      deny: po.deny,
      type: po.type,
    }));

    const newChannel = await interaction.guild.channels.create({
      name: target.name,
      type: ChannelType.GuildText,
      parent: parent ?? undefined,
      topic,
      nsfw,
      permissionOverwrites: permOverwrites,
      position,
    }) as TextChannel;

    await target.delete(`Nuke par ${interaction.user.tag} — ${reason}`);

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("💥 Salon nuké")
      .setDescription("L'historique de ce salon a été effacé avec succès.")
      .addFields(
        { name: "Modérateur", value: interaction.user.tag, inline: true },
        { name: "Raison", value: reason, inline: true }
      )
      .setTimestamp();

    await newChannel.send({ embeds: [embed] });

    await sendLog(interaction.client, logEmbed(
      0xef4444, "💥 Salon nuké",
      [
        { name: "Salon", value: `#${target.name}`, inline: true },
        { name: "Raison", value: reason, inline: true },
      ],
      { tag: interaction.user.tag, id: interaction.user.id }
    ), { guildId: interaction.guild.id });

    await interaction.editReply({ content: `✅ Salon **${target.name}** nuké avec succès → <#${newChannel.id}>` });
  } catch (err) {
    await interaction.editReply({ content: "❌ Impossible de nuker ce salon. Vérifie les permissions du bot." });
  }
}

export const prefixName = "nuke";

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Seuls les administrateurs peuvent utiliser cette commande."); return;
  }

  let target = message.channel as TextChannel;
  let reasonStart = 0;

  if (args[0]?.startsWith("<#")) {
    const id = args[0].replace(/[<#>]/g, "");
    const found = message.guild.channels.cache.get(id) as TextChannel | undefined;
    if (found && found.type === ChannelType.GuildText) { target = found; reasonStart = 1; }
  }

  const reason = args.slice(reasonStart).join(" ") || "Aucune raison fournie";

  try {
    const position = target.position;
    const parent = target.parentId;
    const topic = target.topic ?? undefined;
    const nsfw = target.nsfw;
    const permOverwrites = target.permissionOverwrites.cache.map((po) => ({
      id: po.id, allow: po.allow, deny: po.deny, type: po.type,
    }));

    const newChannel = await message.guild.channels.create({
      name: target.name,
      type: ChannelType.GuildText,
      parent: parent ?? undefined,
      topic, nsfw,
      permissionOverwrites: permOverwrites,
      position,
    }) as TextChannel;

    await target.delete(`Nuke par ${message.author.tag} — ${reason}`);

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("💥 Salon nuké")
      .setDescription("L'historique de ce salon a été effacé avec succès.")
      .addFields(
        { name: "Modérateur", value: message.author.tag, inline: true },
        { name: "Raison", value: reason, inline: true }
      )
      .setTimestamp();

    await newChannel.send({ embeds: [embed] });

    await sendLog(message.client, logEmbed(
      0xef4444, "💥 Salon nuké",
      [
        { name: "Salon", value: `#${target.name}`, inline: true },
        { name: "Raison", value: reason, inline: true },
        { name: "Via", value: "Commande préfixe", inline: true },
      ],
      { tag: message.author.tag, id: message.author.id }
    ), { guildId: message.guild.id });
  } catch {
    await message.reply("❌ Impossible de nuker ce salon. Vérifie les permissions du bot.");
  }
}
