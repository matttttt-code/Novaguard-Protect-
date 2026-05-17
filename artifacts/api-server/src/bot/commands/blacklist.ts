import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  User,
  EmbedBuilder,
  Message,
} from "discord.js";
import { addToBlacklist, isBlacklisted } from "../blacklist-store.js";
import { sendLog, logEmbed } from "../log.js";
import { sendSanctionDM } from "../dm-notify.js";

async function execBlacklist(
  client: ChatInputCommandInteraction["client"],
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  user: User,
  member: GuildMember | null,
  reason: string,
  moderatorTag: string,
  moderatorId: string
): Promise<EmbedBuilder> {
  if (isBlacklisted(guild.id, user.id)) {
    throw new Error("Cet utilisateur est déjà dans la liste noire.");
  }

  if (member && !member.bannable) {
    throw new Error("Je ne peux pas bannir ce membre (permissions insuffisantes).");
  }

  addToBlacklist(guild.id, {
    userId: user.id,
    userTag: user.tag,
    reason,
    moderatorTag,
    moderatorId,
    timestamp: new Date(),
  });

  if (member) {
    await sendSanctionDM(user, "ban", `[BLACKLIST] ${reason}`, guild);
  }

  await guild.members.ban(user.id, { reason: `[BLACKLIST] ${reason}` });

  await sendLog(
    client,
    logEmbed(0x0f0f0f, "⛔ Membre blacklisté", [
      { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Dans le serveur", value: member ? "Oui" : "Non (blacklist par ID)", inline: true },
      { name: "Raison", value: reason },
      { name: "ℹ️ Info", value: "Un déban nécessitera l'approbation d'un administrateur." },
    ], { tag: moderatorTag, id: moderatorId }),
    { pingEveryone: true, guildId: guild.id, logType: "ban" }
  );

  return new EmbedBuilder()
    .setColor(0x0f0f0f)
    .setTitle("⛔ Membre blacklisté")
    .setDescription("Ce membre est banni définitivement. Un déban nécessite l'approbation d'un administrateur.")
    .addFields(
      { name: "Membre", value: `${user.tag} (\`${user.id}\`)`, inline: true },
      { name: "Dans le serveur", value: member ? "Oui" : "Non (blacklist par ID)", inline: true },
      { name: "Raison", value: reason }
    )
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("blacklist")
  .setDescription("Ajoute un utilisateur à la liste noire permanente (fonctionne par ID même hors du serveur)")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à blacklister (mention ou ID)").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("raison").setDescription("Raison du blacklist").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const user = interaction.options.getUser("membre", true);
  const member = interaction.options.getMember("membre") as GuildMember | null;
  const reason = interaction.options.getString("raison", true);

  if (user.id === interaction.user.id) {
    return interaction.reply({ content: "Vous ne pouvez pas vous blacklister.", ephemeral: true });
  }

  await interaction.deferReply();
  try {
    const embed = await execBlacklist(
      interaction.client, interaction.guild, user, member, reason,
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
    await message.reply("❌ Vous devez être administrateur pour utiliser cette commande."); return;
  }

  const rawId = args[0]?.replace(/[<@!>]/g, "");
  if (!rawId || !/^\d+$/.test(rawId)) {
    await message.reply("Usage : `&blacklist @membre raison` ou `&blacklist <userId> raison`"); return;
  }
  if (rawId === message.author.id) {
    await message.reply("❌ Vous ne pouvez pas vous blacklister."); return;
  }

  const reason = args.slice(1).join(" ") || "Aucune raison fournie";

  let user: User;
  let member: GuildMember | null = null;

  try {
    member = await message.guild.members.fetch(rawId);
    user = member.user;
  } catch {
    try {
      user = await message.client.users.fetch(rawId);
    } catch {
      await message.reply("❌ Utilisateur introuvable. Vérifie l'ID."); return;
    }
  }

  try {
    const embed = await execBlacklist(
      message.client, message.guild, user, member, reason,
      message.author.tag, message.author.id
    );
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply(`❌ ${(err as Error).message}`);
  }
}
