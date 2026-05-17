import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLogDM, LOG_DM_USER_ID } from "../dm-notify.js";

const CATEGORIES: Record<string, string> = {
  fonctionnalite: "✨ Fonctionnalité",
  amelioration:   "🔧 Amélioration",
  bug:            "🐛 Signalement de bug",
  autre:          "💬 Autre",
};

export const data = new SlashCommandBuilder()
  .setName("suggestion")
  .setDescription("Envoyer une suggestion ou signalement pour le bot")
  .addStringOption((o) =>
    o.setName("texte").setDescription("Ta suggestion (détaille au maximum)").setRequired(true).setMaxLength(1500)
  )
  .addStringOption((o) =>
    o.setName("categorie").setDescription("Catégorie de ta suggestion").setRequired(false)
      .addChoices(
        { name: "✨ Fonctionnalité", value: "fonctionnalite" },
        { name: "🔧 Amélioration",   value: "amelioration" },
        { name: "🐛 Signalement de bug", value: "bug" },
        { name: "💬 Autre",           value: "autre" },
      )
  );

async function buildAndSend(
  client: Parameters<typeof sendLogDM>[0],
  authorTag: string,
  authorId: string,
  authorAvatar: string | null,
  guildName: string | null,
  guildId: string | null,
  texte: string,
  categorieKey: string | null,
): Promise<void> {
  const categorie = categorieKey ? (CATEGORIES[categorieKey] ?? "💬 Autre") : "💬 Autre";

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("💡 Nouvelle suggestion")
    .setThumbnail(authorAvatar)
    .addFields(
      { name: "Auteur", value: `${authorTag} (\`${authorId}\`)`, inline: true },
      { name: "Catégorie", value: categorie, inline: true },
      { name: "Serveur", value: guildName ?? "DM", inline: true },
      { name: "Suggestion", value: texte },
    )
    .setFooter({ text: `ID utilisateur : ${authorId}${guildId ? ` • Serveur : ${guildId}` : ""}` })
    .setTimestamp();

  await sendLogDM(client, embed);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const texte = interaction.options.getString("texte", true);
  const categorieKey = interaction.options.getString("categorie");

  if (interaction.user.id === LOG_DM_USER_ID) {
    return interaction.reply({ content: "Tu es l'auteur du bot — ta suggestion ira directement en tête de liste 😄", ephemeral: true });
  }

  await buildAndSend(
    interaction.client,
    interaction.user.tag,
    interaction.user.id,
    interaction.user.displayAvatarURL(),
    interaction.guild?.name ?? null,
    interaction.guildId,
    texte,
    categorieKey,
  );

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Suggestion envoyée !")
      .setDescription(
        "Ta suggestion a bien été transmise au développeur du bot.\n" +
        "Merci pour ta contribution ! 💙"
      )
      .setTimestamp()],
    ephemeral: true,
  });
}

export const prefixName = "suggestion";
export const prefixAliases = ["suggest", "idee"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild && !message.author) return;

  const texte = args.join(" ").trim();
  if (!texte) {
    await message.reply(
      "❌ Usage : `&suggestion <texte>`\n" +
      "Catégories disponibles via `/suggestion` : fonctionnalité · amélioration · bug · autre"
    );
    return;
  }

  if (message.author.id === LOG_DM_USER_ID) {
    await message.reply("Tu es l'auteur du bot — ta suggestion ira directement en tête de liste 😄");
    return;
  }

  await buildAndSend(
    message.client,
    message.author.tag,
    message.author.id,
    message.author.displayAvatarURL(),
    message.guild?.name ?? null,
    message.guild?.id ?? null,
    texte,
    null,
  );

  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Suggestion envoyée !")
      .setDescription("Ta suggestion a bien été transmise au développeur. Merci ! 💙")
      .setTimestamp()],
  });
}
