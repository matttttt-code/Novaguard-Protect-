import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";

export interface PendingSupportRequest {
  guildId: string;
  guildName: string;
  channelId: string | null;
  expiresAt: number;
}

const pending = new Map<string, PendingSupportRequest>();

export function addSupportRequest(userId: string, req: PendingSupportRequest): void {
  pending.set(userId, req);
}

export function getSupportRequest(userId: string): PendingSupportRequest | undefined {
  const req = pending.get(userId);
  if (!req) return undefined;
  if (Date.now() > req.expiresAt) {
    pending.delete(userId);
    return undefined;
  }
  return req;
}

export function removeSupportRequest(userId: string): void {
  pending.delete(userId);
}

export function hasSupportRequest(userId: string): boolean {
  return getSupportRequest(userId) !== undefined;
}

// ── Stockage persistant des réponses au formulaire support (pour transcript dans le ticket) ──
// Sauvegardé sur disque pour survivre aux redémarrages du bot.

const DATA_DIR = join(process.cwd(), "data");
const RESPONSES_FILE = join(DATA_DIR, "support-responses.json");

const supportResponses = new Map<string, string>();

async function saveResponsesToDisk(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const obj: Record<string, string> = {};
    supportResponses.forEach((v, k) => { obj[k] = v; });
    await writeFile(RESPONSES_FILE, JSON.stringify(obj), "utf-8");
  } catch { /* ignore */ }
}

async function loadResponsesFromDisk(): Promise<void> {
  try {
    const raw = await readFile(RESPONSES_FILE, "utf-8");
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) supportResponses.set(k, v);
  } catch { /* Fichier inexistant au premier démarrage — normal */ }
}

void loadResponsesFromDisk();

export function saveSupportResponse(userId: string, content: string): void {
  supportResponses.set(userId, content);
  void saveResponsesToDisk();
}

export function consumeSupportResponse(userId: string): string | undefined {
  const content = supportResponses.get(userId);
  supportResponses.delete(userId);
  void saveResponsesToDisk();
  return content;
}
