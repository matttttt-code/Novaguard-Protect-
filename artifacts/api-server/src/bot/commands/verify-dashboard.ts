import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Message,
} from "discord.js";
import { createVerifyCode } from "../verify-code-store.js";
import { isOwner } from "../owner-store.js";

async function handleVerify(
  userId: string,
  userTag: string,
  avatarURL: string,
  guild: import("discord.js").Guild | null,
  member: import("discord.js").GuildMember | null,
  replyFn: (opts: object) => Promise<unknown>,
  dmFallbackTag?: string,
): Promise<void> {
  const owner = isOwner(userId);

  // Check permission: must be admin on the server OR bot owner
  if (!owner && (!member || !member.permissions.has(PermissionFlagsBits.Administrator))) {
    await replyFn({
      embeds: [
        new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle("❌ Accès refusé")
          .setDescription("Vous devez être **Administrateur** sur ce serveur pour accéder au dashboard."),
      ],
      ephemeral: true,
    });
    return;
  }

  // Build list of guilds where user is admin (from bot's cache)
  const client = member?.guild.client ?? guild?.client;
  const guilds: Array<{ id: string; name: string; icon: string | null }> = [];

  if (owner && client) {
    // Owner gets access to all bot guilds
    for (const g of client.guilds.cache.values()) {
      guilds.push({ id: g.id, name: g.name, icon: g.icon });
    }
  } else if (guild && member) {
    guilds.push({ id: guild.id, name: guild.name, icon: guild.icon });
  }

  const code = createVerifyCode(userId, userTag, avatarURL, guilds);

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("🔐 Code de connexion Dashboard")
    .setDescription(
      `Voici votre code de vérification à usage unique.\n\nRendez-vous sur le **Dashboard web** et entrez ce code pour vous connecter.`
    )
    .addFields(
      { name: "🔑 Code", value: `\`\`\`${code}\`\`\``, inline: false },
      { name: "⏱️ Expire dans", value: "10 minutes", inline: true },
      { name: "🔒 Usage", value: "Une seule fois", inline: true },
    )
    .setFooter({ text: "Ne partagez jamais ce code." })
    .setTimestamp();

  try {
    const user = client?.users.cache.get(userId) ?? await client?.users.fetch(userId);
    await user?.send({ embeds: [embed] });

    await replyFn({
      embeds: [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle("✅ Code envoyé en DM")
          .setDescription("Vérifiez vos messages privés ! Entrez le code sur le dashboard web pour vous connecter.\n\n*Si vous n'avez pas reçu le DM, activez les messages privés du serveur.*"),
      ],
      ephemeral: true,
    });
  } catch {
    // DM failed — show code directly (ephemeral)
    await replyFn({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle("⚠️ Impossible d'envoyer le DM")
          .setDescription("Activez vos messages privés, puis réessayez.\n\nCode temporaire (visible uniquement par vous) :")
          .addFields({ name: "🔑 Code", value: `\`\`\`${code}\`\`\`` })
          .setFooter({ text: "Ce message est visible uniquement par vous." }),
      ],
      ephemeral: true,
    });
  }
}

// ── Slash command ─────────────────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName("verify-dashboard")
  .setDescription("Obtenir un code de connexion pour le Dashboard web.");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as import("discord.js").GuildMember | null;
  const avatarURL = interaction.user.displayAvatarURL({ size: 128 });

  await handleVerify(
    interaction.user.id,
    interaction.user.tag,
    avatarURL,
    interaction.guild,
    member,
    (opts) => interaction.reply(opts as any),
  );
}

// ── Prefix command ────────────────────────────────────────────────────────────
export const prefixName = "verify-dashboard";
export const prefixAliases = ["verifydash", "dashcode"];

export async function executeMessage(message: Message): Promise<void> {
  const member = message.member;
  const avatarURL = message.author.displayAvatarURL({ size: 128 });

  await handleVerify(
    message.author.id,
    message.author.tag,
    avatarURL,
    message.guild,
    member,
    (opts: any) => message.reply(opts),
  );
}
