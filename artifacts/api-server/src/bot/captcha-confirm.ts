import { EmbedBuilder, GuildTextBasedChannel, Message } from "discord.js";

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function captchaEmbed(code: string, label: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`🔐 Confirmation requise — ${label}`)
    .setDescription(
      `Tape le code suivant dans les **2 minutes** pour confirmer :\n\`\`\`\n${code}\n\`\`\`\n` +
      `⚠️ Cette action désactive une mesure de sécurité critique.`,
    )
    .setFooter({ text: "3 tentatives max · insensible à la casse" })
    .setTimestamp();
}

export function captchaSuccessEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("✅ Code validé")
    .setTimestamp();
}

export function captchaFailEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("❌ Code incorrect ou délai expiré — annulé")
    .setTimestamp();
}

/**
 * Attend la saisie du code par `userId` dans `channel` (interaction déjà reply-ée).
 * Retourne true si validé dans les 2 minutes.
 */
export async function collectCaptchaResponse(
  channel: GuildTextBasedChannel,
  userId: string,
  expectedCode: string,
): Promise<boolean> {
  const collected = await channel
    .awaitMessages({
      filter: (m: Message) => m.author.id === userId,
      max: 3,
      time: 2 * 60 * 1000,
    })
    .catch(() => null);

  return (
    collected != null &&
    [...collected.values()].some((m) => m.content.trim().toUpperCase() === expectedCode)
  );
}

export { genCode, captchaEmbed };

/**
 * Version complète pour les commandes préfixe :
 * envoie le captcha dans `channel`, attend la réponse, édite le message avec le résultat.
 * Retourne true si validé.
 */
export async function awaitPrefixCaptcha(
  channel: GuildTextBasedChannel,
  userId: string,
  label: string,
): Promise<boolean> {
  const code = genCode();

  const msg = await channel.send({ embeds: [captchaEmbed(code, label)] });

  const ok = await collectCaptchaResponse(channel, userId, code);

  await msg.edit({ embeds: [ok ? captchaSuccessEmbed() : captchaFailEmbed()] }).catch(() => null);

  return ok;
}
