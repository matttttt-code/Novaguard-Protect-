import type { Guild } from "discord.js";

const ALERT_ROLE_ID = "1504892390031364207";

export function getAlertPing(guild?: Guild | null): string {
  if (guild?.roles.cache.has(ALERT_ROLE_ID)) return `<@&${ALERT_ROLE_ID}>`;
  return "@here";
}
