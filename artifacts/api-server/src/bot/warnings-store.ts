export interface Warning {
  caseId: number;
  reason: string;
  moderator: string;
  moderatorId: string;
  timestamp: Date;
}

const store = new Map<string, Map<string, Warning[]>>();
const caseCounters = new Map<string, number>();

function getGuildWarnings(guildId: string): Map<string, Warning[]> {
  if (!store.has(guildId)) store.set(guildId, new Map());
  return store.get(guildId)!;
}

function nextCaseId(guildId: string): number {
  const next = (caseCounters.get(guildId) ?? 0) + 1;
  caseCounters.set(guildId, next);
  return next;
}

export function addWarning(
  guildId: string,
  userId: string,
  warning: Omit<Warning, "caseId">
): number {
  const guildWarnings = getGuildWarnings(guildId);
  if (!guildWarnings.has(userId)) guildWarnings.set(userId, []);
  const caseId = nextCaseId(guildId);
  guildWarnings.get(userId)!.push({ ...warning, caseId });
  return caseId;
}

export function getWarnings(guildId: string, userId: string): Warning[] {
  return getGuildWarnings(guildId).get(userId) ?? [];
}

export function clearWarnings(guildId: string, userId: string): number {
  const guildWarnings = getGuildWarnings(guildId);
  const count = guildWarnings.get(userId)?.length ?? 0;
  guildWarnings.delete(userId);
  return count;
}

export function removeWarningByCase(
  guildId: string,
  userId: string,
  caseId: number
): boolean {
  const guildWarnings = getGuildWarnings(guildId);
  const warns = guildWarnings.get(userId);
  if (!warns) return false;
  const idx = warns.findIndex((w) => w.caseId === caseId);
  if (idx === -1) return false;
  warns.splice(idx, 1);
  return true;
}
