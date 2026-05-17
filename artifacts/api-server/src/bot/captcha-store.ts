export interface CaptchaChallenge {
  question: string;
  answer: string;
  guildId: string;
  attempts: number;
}

const pending = new Map<string, CaptchaChallenge>();

export function generateChallenge(): { question: string; answer: string } {
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;

  if (op === "+") {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    answer = a + b;
  } else if (op === "-") {
    a = Math.floor(Math.random() * 20) + 10;
    b = Math.floor(Math.random() * 10) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 10) + 2;
    b = Math.floor(Math.random() * 9) + 2;
    answer = a * b;
  }

  return { question: `${a} ${op} ${b} = ?`, answer: String(answer) };
}

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
