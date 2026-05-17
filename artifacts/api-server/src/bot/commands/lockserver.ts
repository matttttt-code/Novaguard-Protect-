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
  .setName("lockserver")
  .setDescription("Verrouille ou déverrouille TOUS les salons textuels du serveur")
  .addStringOption((o) =>
    o.setName("action")
      .setDescription("Activer ou désactiver le lockdown")
      .setRequired(true)
      .addChoices(
        { name: "🔒 Verrouiller le serveur", value: "lock" },
        { name: "🔓 Déverrouiller le serveur", value: "unlock" }
      )
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du lockdown")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function applyLockdown(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: ChatInputCommandInteraction["client"],
  lock: boolean,
  reason: string,
  modTag: string,
  modId: string
): Promise<{ count: number; embed: EmbedBuilder }> {
  const textChannels = guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText
  ) as Map<string, TextChannel>;

  let count = 0;
  const errors: string[] = [];

  for (const [, ch] of textChannels) {
    try {
      await ch.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: lock ? false : null,
      });
      count++;
    } catch {
      errors.push(ch.name);
    }
  }

  const color = lock ? 0xef4444 : 0x22c55e;
  const icon = lock ? "🔒" : "🔓";
  const label = lock ? "Serveur verrouillé" : "Serveur déverrouillé";

  await sendLog(client, logEmbed(
    color, `${icon} ${label}`,
    [
      { name: "Salons traités", value: String(count), inline: true },
      { name: "Raison", value: reason, inline: true },
      ...(errors.length > 0 ? [{ name: "Erreurs", value: errors.slice(0, 5).join(", ") }] : []),
    ],
    { tag: modTag, id: modId }
  ), { guildId: guild.id });

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${icon} ${label}`)
    .setDescription(
      lock
        ? "🚨 Tous les salons textuels ont été verrouillés. Personne ne peut écrire."
        : "✅ Tous les salons textuels ont été déverrouillés. La situation est sous contrôle."
    )
    .addFields(
      { name: "Salons traités", value: String(count), inline: true },
      { name: "Raison", value: reason, inline: true },
      ...(errors.length > 0 ? [{ name: `⚠️ Salons échoués (${errors.length})`, value: errors.slice(0, 5).join(", ") }] : [])
    )
    .setTimestamp();

  return { count, embed };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const action = interaction.options.getString("action", true);
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const lock = action === "lock";

  await interaction.deferReply();

  const { embed } = await applyLockdown(
    interaction.guild, interaction.client, lock, reason,
    interaction.user.tag, interaction.user.id
  );

  return interaction.editReply({ embeds: [embed] });
}

export const prefixName = "lockserver";
export const prefixAliases = ["serverlock", "lockdown"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Seuls les administrateurs peuvent utiliser cette commande."); return;
  }

  const sub = args[0]?.toLowerCase();
  const lock = ["lock", "on", "activer"].includes(sub ?? "");
  const unlock = ["unlock", "off", "désactiver", "desactiver"].includes(sub ?? "");

  if (!lock && !unlock) {
    await message.reply("Usage : `&lockserver lock [raison]` | `&lockserver unlock [raison]`"); return;
  }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";
  const reply = await message.reply("⏳ Application du lockdown en cours…");

  const { embed } = await applyLockdown(
    message.guild, message.client, lock, reason,
    message.author.tag, message.author.id
  );

  await reply.edit({ content: null, embeds: [embed] });
}
