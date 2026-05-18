import { db, captchaLogs } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

export type CaptchaEventType =
  | "triggered_channel"
  | "triggered_dm"
  | "success"
  | "fail_attempt"
  | "fail_kick"
  | "timeout_kick"
  | "dm_closed";

export async function addCaptchaLog(entry: {
  guildId: string;
  guildName: string;
  userId: string;
  userTag: string;
  event: CaptchaEventType;
  details?: string;
}): Promise<void> {
  await db.insert(captchaLogs).values({
    guildId: entry.guildId,
    guildName: entry.guildName,
    userId: entry.userId,
    userTag: entry.userTag,
    event: entry.event,
    details: entry.details ?? "",
  }).catch(() => null);
}

export async function getCaptchaLogs(opts: { guildId?: string; limit?: number; event?: string } = {}) {
  const { guildId, limit = 200, event } = opts;

  let rows = db.select().from(captchaLogs).$dynamic();
  if (guildId) rows = rows.where(eq(captchaLogs.guildId, guildId));
  if (event) rows = rows.where(eq(captchaLogs.event, event));
  return rows.orderBy(desc(captchaLogs.createdAt)).limit(limit);
}

export async function deleteCaptchaLogs(guildId: string): Promise<void> {
  await db.delete(captchaLogs).where(eq(captchaLogs.guildId, guildId));
}
