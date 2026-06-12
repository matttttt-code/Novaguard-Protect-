import { kvSave, kvLoad } from "./kv-db.js";

type LastSeenStore = Record<string, Record<string, number>>;

const store = new Map<string, Map<string, number>>();
const KV_KEY = "last-seen";
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const obj: LastSeenStore = {};
    for (const [guildId, members] of store) {
      obj[guildId] = {};
      for (const [userId, ts] of members) obj[guildId]![userId] = ts;
    }
    kvSave(KV_KEY, obj);
  }, 5000);
}

export async function initLastSeenStore(): Promise<void> {
  const saved = await kvLoad<LastSeenStore>(KV_KEY);
  if (!saved) return;
  for (const [guildId, members] of Object.entries(saved)) {
    const map = new Map<string, number>();
    for (const [userId, ts] of Object.entries(members)) map.set(userId, ts);
    store.set(guildId, map);
  }
}

export function recordSeen(guildId: string, userId: string): void {
  let members = store.get(guildId);
  if (!members) { members = new Map(); store.set(guildId, members); }
  members.set(userId, Date.now());
  schedulePersist();
}

export function getLastSeen(guildId: string, userId: string): number | null {
  return store.get(guildId)?.get(userId) ?? null;
}
