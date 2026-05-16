import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";

function buildUserEmbed(member: GuildMember, guildId: string): EmbedBuilder {
  const roles = member.roles.cache
    .filter((r) => r.id !== guildId)
    .sort((a, b) => b.position - a.position)
    .map((r) => r.toString())
    .slice(0, 10);

  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  const joinedAt = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

  const flags: string[] = [];
  if (member.user.bot) flags.push("🤖 Bot");
  if (member.permissions.has("Administrator")) flags.push("🛡️ Administrateur");

  return new EmbedBuilder()
    .setColor(member.displayColor || 0x6366f1)
    .setTitle(`👤 ${member.user.tag}`)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "ID", value: `\`${member.id}\``, inline: true },
      { name: "Surnom", value: member.nickname ?? "Aucun", inline: true },
      { name: "Compte créé le", value: `<t:${accountCreated}:F>`, inline: false },
      ...(joinedAt ? [{ name: "A rejoint le", value: `<t:${joinedAt}:F>`, inline: false }] : []),
      { name: `Rôles (${roles.length})`, value: roles.length > 0 ? roles.join(", ") : "Aucun" },
      ...(flags.length > 0 ? [{ name: "Statut", value: flags.join(" ") }] : [])
    )
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Affiche les informations d'un membre")
  .addUserOption((o) => o.setName("membre").setDescription("Le membre à inspecter"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = (interaction.options.getMember("membre") as GuildMember | null) ?? (interaction.member as GuildMember);
  if (!member) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  return interaction.reply({ embeds: [buildUserEmbed(member, interaction.guildId!)] });
}

export const prefixName = "userinfo";
export const prefixAliases = ["ui", "user"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;

  let member: GuildMember = message.member as GuildMember;

  if (args[0]) {
    const userId = args[0].replace(/[<@!>]/g, "");
    try { member = await message.guild.members.fetch(userId); }
    catch { await message.reply("❌ Membre introuvable."); return; }
  }

  await message.reply({ embeds: [buildUserEmbed(member, message.guild.id)] });
}
