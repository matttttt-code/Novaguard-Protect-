export const RATE_THRESHOLD = 10;
export const RATE_WINDOW_SECONDS = 30;
const RATE_WINDOW_MS = RATE_WINDOW_SECONDS * 1000;

const windows = new Map<string, number[]>();

export function recordStaffCommand(guildId: string, userId: string): { exceeded: boolean; count: number } {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  let ts = windows.get(key) ?? [];
  ts = ts.filter((t) => now - t < RATE_WINDOW_MS);
  ts.push(now);
  windows.set(key, ts);
  return { exceeded: ts.length >= RATE_THRESHOLD, count: ts.length };
}

export function resetStaffWindow(guildId: string, userId: string): void {
  windows.delete(`${guildId}:${userId}`);
}
