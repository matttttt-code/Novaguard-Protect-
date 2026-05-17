import { EmbedBuilder, GuildTextBasedChannel, Message } from "discord.js";

export function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function captchaEmbed(code: string, label: string): EmbedBuilder {
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
 * Collecte la réponse via createMessageCollector pour s'arrêter IMMÉDIATEMENT
 * dès que le bon code est tapé (sans attendre le timeout).
 * Retourne true si validé dans les 2 minutes, false sinon.
 */
export function collectCaptchaResponse(
  channel: GuildTextBasedChannel,
  userId: string,
  expectedCode: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;

    const collector = channel.createMessageCollector({
      filter: (m: Message) => m.author.id === userId,
      time: 2 * 60 * 1000,
    });

    collector.on("collect", (m: Message) => {
      attempts++;
      if (m.content.trim().toUpperCase() === expectedCode) {
        collector.stop("success");
      } else if (attempts >= 3) {
        collector.stop("max_attempts");
      }
    });

    collector.on("end", (_collected, reason) => {
      resolve(reason === "success");
    });
  });
}

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
