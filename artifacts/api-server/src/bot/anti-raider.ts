/**
 * Anti-raider silencieux — détecte les vagues de joins rapides.
 * Renvoie true si le seuil de raid est atteint après avoir enregistré un nouveau join.
 */

const joinTimestamps = new Map<string, number[]>();

/**
 * Enregistre un nouveau join et détecte si un raid est en cours.
 * @param guildId      Identifiant du serveur
 * @param threshold    Nombre de joins nécessaires pour déclencher (ex : 5)
 * @param windowSecs   Fenêtre de temps en secondes (ex : 10)
 * @returns true si un raid est détecté
 */
export function recordJoin(guildId: string, threshold: number, windowSecs: number): boolean {
  const now = Date.now();
  const windowMs = windowSecs * 1_000;
  const stamps = joinTimestamps.get(guildId) ?? [];
  const recent = stamps.filter((t) => now - t < windowMs);
  recent.push(now);
  if (recent.length > 1_000) recent.splice(0, recent.length - 1_000);
  joinTimestamps.set(guildId, recent);
  return recent.length >= threshold;
}

export function clearRaidTracking(guildId: string): void {
  joinTimestamps.delete(guildId);
}
