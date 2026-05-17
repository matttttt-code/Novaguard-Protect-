import { isOwner } from "./owner-store.js";

interface VerifyEntry {
  userId: string;
  userTag: string;
  avatarURL: string;
  isOwner: boolean;
  guilds: Array<{ id: string; name: string; icon: string | null }>;
  expiresAt: number;
}

const store = new Map<string, VerifyEntry>();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createVerifyCode(
  userId: string,
  userTag: string,
  avatarURL: string,
  guilds: Array<{ id: string; name: string; icon: string | null }>,
): string {
  // Remove any existing codes for this user
  for (const [code, entry] of store.entries()) {
    if (entry.userId === userId) store.delete(code);
  }

  const code = generateCode();
  store.set(code, {
    userId,
    userTag,
    avatarURL,
    isOwner: isOwner(userId),
    guilds,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

export function consumeVerifyCode(code: string): VerifyEntry | null {
  const entry = store.get(code);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(code);
    return null;
  }
  store.delete(code); // one-time use
  return entry;
}
