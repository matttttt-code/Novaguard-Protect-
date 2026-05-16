import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";

function buildInfoEmbed(member: GuildMember): EmbedBuilder {
  const roles = member.roles.cache
    .filter((r) => r.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => `<@&${r.id}>`)
    .slice(0, 15);

  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  const joinedAt = member.joinedTimestamp
    ? Math.floor(member.joinedTimestamp / 1000)
    : null;

  const badges: string[] = [];
  if (member.user.bot) badges.push("🤖 Bot");
  if (member.permissions.has("Administrator")) badges.push("🛡️ Administrateur");
  if (member.permissions.has("ManageGuild")) badges.push("⚙️ Gestionnaire");
  if (member.permissions.has("ManageMessages")) badges.push("🔧 Modérateur");

  const voiceChannel = member.voice.channel;

  return new EmbedBuilder()
    .setColor(member.displayColor || 0x6366f1)
    .setAuthor({
      name: member.user.tag,
      iconURL: member.user.displayAvatarURL(),
    })
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "🪪 ID", value: `\`${member.id}\``, inline: true },
      {
        name: "🏷️ Surnom",
        value: member.nickname ?? "*(aucun)*",
        inline: true,
      },
      {
        name: "🤖 Bot",
        value: member.user.bot ? "Oui" : "Non",
        inline: true,
      },
      {
        name: "📅 Compte créé",
        value: `<t:${accountCreated}:F>\n<t:${accountCreated}:R>`,
        inline: true,
      },
      {
        name: "📥 A rejoint le serveur",
        value: joinedAt
          ? `<t:${joinedAt}:F>\n<t:${joinedAt}:R>`
          : "Inconnu",
        inline: true,
      },
      {
        name: "🔊 Vocal",
        value: voiceChannel ? `<#${voiceChannel.id}>` : "Absent",
        inline: true,
      },
      {
        name: `🎭 Rôles (${member.roles.cache.size - 1})`,
        value: roles.length > 0 ? roles.join(" ") : "Aucun",
      },
      ...(badges.length > 0
        ? [{ name: "🏅 Permissions notables", value: badges.join(" • ") }]
        : []),
      {
        name: "🎨 Couleur du rôle principal",
        value: member.displayHexColor,
        inline: true,
      },
      {
        name: "📊 Position du rôle principal",
        value: `#${member.roles.highest.position}`,
        inline: true,
      }
    )
    .setImage(member.user.bannerURL({ size: 512 }) ?? null)
    .setFooter({ text: `Serveur : ${member.guild.name}` })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("infome")
  .setDescription("Affiche toutes les informations d'un membre sur ce serveur")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Membre à inspecter (par défaut : vous)")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const member =
    (interaction.options.getMember("membre") as GuildMember | null) ??
    (interaction.member as GuildMember);

  if (!member) {
    return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
  }

  await interaction.deferReply();
  const embed = buildInfoEmbed(member);
  return interaction.editReply({ embeds: [embed] });
}

export const prefixName = "infome";
export const prefixAliases = ["im", "whoami"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild) return;

  let member: GuildMember = message.member as GuildMember;

  if (args[0]) {
    const userId = args[0].replace(/[<@!>]/g, "");
    try {
      member = await message.guild.members.fetch(userId);
    } catch {
      await message.reply("❌ Membre introuvable.");
      return;
    }
  }

  const embed = buildInfoEmbed(member);
  await message.reply({ embeds: [embed] });
}
