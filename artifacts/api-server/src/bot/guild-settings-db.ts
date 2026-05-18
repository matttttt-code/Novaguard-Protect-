import { db, guildSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { GuildSettings } from "@workspace/db";

const cache = new Map<string, GuildSettings>();

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  if (cache.has(guildId)) return cache.get(guildId)!;
  const [row] = await db
    .select()
    .from(guildSettingsTable)
    .where(eq(guildSettingsTable.guildId, guildId))
    .limit(1);
  if (row) {
    cache.set(guildId, row);
    return row;
  }
  // Return defaults without persisting
  return {
    guildId,
    captchaEnabled: false,
    captchaChannelId: null,
    captchaRoleId: null,
    captchaVerifiedRoleId: null,
    captchaTimeoutMins: 5,
    captchaMaxAttempts: 3,
    captchaMode: "channel",
    customPrefix: null,
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: null,
    updatedAt: new Date(),
  };
}

export async function upsertGuildSettings(guildId: string, data: Partial<Omit<GuildSettings, "guildId" | "updatedAt">>): Promise<GuildSettings> {
  cache.delete(guildId);
  const [row] = await db
    .insert(guildSettingsTable)
    .values({ guildId, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: guildSettingsTable.guildId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  cache.set(guildId, row!);
  return row!;
}
