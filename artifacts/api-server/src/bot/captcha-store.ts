export interface CaptchaChallenge {
  code: string;
  guildId: string;
  attempts: number;
  challengeMessageId?: string;
  isTest?: boolean;
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateChallenge(): { code: string } {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return { code };
}

const pending = new Map<string, CaptchaChallenge>();

export function setCaptcha(userId: string, challenge: CaptchaChallenge): void {
  pending.set(userId, challenge);
}

export function getCaptcha(userId: string): CaptchaChallenge | undefined {
  return pending.get(userId);
}

export function deleteCaptcha(userId: string): void {
  pending.delete(userId);
}

export function hasCaptcha(userId: string): boolean {
  return pending.has(userId);
}

export function decrementAttempts(userId: string): number {
  const c = pending.get(userId);
  if (!c) return 0;
  c.attempts--;
  return c.attempts;
}

export function setChallengeMessageId(userId: string, messageId: string): void {
  const c = pending.get(userId);
  if (c) c.challengeMessageId = messageId;
}
