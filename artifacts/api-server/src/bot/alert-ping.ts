const SPECIAL_GUILD_ID = "1454549183523590216";
const SPECIAL_ROLE_ID = "1504892390031364207";

export function getAlertPing(guildId?: string): string {
  return guildId === SPECIAL_GUILD_ID ? `<@&${SPECIAL_ROLE_ID}>` : "@here";
}
