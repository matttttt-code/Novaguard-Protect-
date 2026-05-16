import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { addToBlacklist, isBlacklisted } from "../blacklist-store.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM } from "../dm-notify.js";

async function execBlacklist(
  client: ChatInputCommandInteraction["client"],
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  member: GuildMember,
  reason: string,
  moderatorTag: string,
  moderatorId: string
): Promise<EmbedBuilder> {
  if (isBlacklisted(guild.id, member.id)) {
    throw new Error("Ce membre est déjà dans la liste noire.");
  }
  if (!member.bannable) {
    throw new Error("Je ne peux pas bannir ce membre (permissions insuffisantes).");
  }

  addToBlacklist(guild.id, {
    userId: member.id,
    userTag: member.user.tag,
    reason,
    moderatorTag,
    moderatorId,
    timestamp: new Date(),
  });

  await sendSanctionDM(member.user, "ban", `[BLACKLIST] ${reason}`, guild);
  await member.ban({ reason: `[BLACKLIST] ${reason}` });

  await sendLog(
    client,
    logEmbed(0x0f0f0f, "⛔ Membre blacklisté", [
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Raison", value: reason },
      { name: "ℹ️ Info", value: "Un déban nécessitera l'approbation d'un administrateur." },
    ], { tag: moderatorTag, id: moderatorId }),
    { pingEveryone: true }
  );

  return new EmbedBuilder()
    .setColor(0x0f0f0f)
    .setTitle("⛔ Membre blacklisté")
    .setDescription("Ce membre est banni définitivement. Un déban nécessite l'approbation d'un administrateur.")
    .addFields(
      { name: "Membre", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("blacklist")
  .setDescription("Ajoute un membre à la liste noire permanente (ban définitif, déban admin requis)")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à blacklister").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du blacklist").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison", true);

  if (!member || !interaction.guild) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }
  if (member.id === interaction.user.id) {
    return interaction.reply({ content: "Vous ne pouvez pas vous blacklister.", ephemeral: true });
  }

  await interaction.deferReply();
  try {
    const embed = await execBlacklist(
      interaction.client, interaction.guild, member, reason,
      interaction.user.tag, interaction.user.id
    );
    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    return interaction.editReply({ content: `❌ ${(err as Error).message}` });
  }
}

export const prefixName = "blacklist";
export const prefixAliases = ["bl"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;

  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Vous devez être administrateur pour utiliser cette commande.");
    return;
  }

  const mention = args[0];
  if (!mention) {
    await message.reply("Usage : `&blacklist @membre raison`");
    return;
  }

  const userId = mention.replace(/[<@!>]/g, "");
  let member: GuildMember;
  try {
    member = await message.guild.members.fetch(userId);
  } catch {
    await message.reply("❌ Membre introuvable.");
    return;
  }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  try {
    const embed = await execBlacklist(
      message.client, message.guild, member, reason,
      message.author.tag, message.author.id
    );
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply(`❌ ${(err as Error).message}`);
  }
}
