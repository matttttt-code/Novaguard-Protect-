const ROLE_PING_MAP: Record<string, string> = {
  "1454549183523590216": "1504892390031364207",
  "1504463605163364573": "1504892390031364207",
};

export function getAlertPing(guildId?: string): string {
  const roleId = guildId ? ROLE_PING_MAP[guildId] : undefined;
  return roleId ? `<@&${roleId}>` : "@here";
}
