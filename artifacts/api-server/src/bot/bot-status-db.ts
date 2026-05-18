import { db, botStatusEventsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import type { BotStatusEvent, BotStatusEventType } from "./bot-status-store.js";

export async function insertBotStatusEventDB(event: BotStatusEvent): Promise<void> {
  try {
    await db.insert(botStatusEventsTable).values({
      eventId: event.id,
      type: event.type,
      tsMs: event.timestamp,
      detail: event.detail,
      ping: event.ping ?? null,
      errCode: event.errCode ?? null,
    }).onConflictDoNothing();
  } catch {
    // Silently ignore — DB might be unavailable during init
  }
}

export async function getBotStatusEventsDB(limit = 200): Promise<BotStatusEvent[]> {
  const rows = await db
    .select()
    .from(botStatusEventsTable)
    .orderBy(desc(botStatusEventsTable.tsMs))
    .limit(Math.min(limit, 500));

  return rows.map((r) => ({
    id: r.eventId,
    type: r.type as BotStatusEventType,
    timestamp: r.tsMs,
    detail: r.detail,
    ...(r.ping != null ? { ping: r.ping } : {}),
    ...(r.errCode != null ? { errCode: r.errCode } : {}),
  }));
}
