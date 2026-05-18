import { db, eventLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { EventLog } from "./event-log-store.js";
import { logger } from "../lib/logger.js";

export async function insertEventLogDB(log: EventLog): Promise<void> {
  try {
    await db.insert(eventLogsTable).values({
      logId: log.id,
      type: log.type,
      guildId: log.guildId ?? null,
      tsMs: log.timestamp,
      field: log.field ?? null,
      oldValue: log.oldValue ?? null,
      newValue: log.newValue ?? null,
      command: log.command ?? null,
      via: log.via ?? null,
      userTag: log.userTag ?? null,
      userId: log.userId ?? null,
      success: log.success != null ? String(log.success) : null,
      errCode: log.errCode ?? null,
      errMessage: log.errMessage ?? null,
    }).onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "[event-log-db] Impossible d'insérer le log");
  }
}

function rowToLog(row: typeof eventLogsTable.$inferSelect): EventLog {
  return {
    id: row.logId,
    type: row.type as EventLog["type"],
    guildId: row.guildId ?? null,
    timestamp: Number(row.tsMs),
    field: row.field ?? undefined,
    oldValue: row.oldValue ?? undefined,
    newValue: row.newValue ?? undefined,
    command: row.command ?? undefined,
    via: (row.via ?? undefined) as EventLog["via"],
    userTag: row.userTag ?? undefined,
    userId: row.userId ?? undefined,
    success: row.success != null ? row.success === "true" : undefined,
    errCode: row.errCode ?? undefined,
    errMessage: row.errMessage ?? undefined,
  };
}

export async function getGuildLogsDB(guildId: string, limit = 200): Promise<EventLog[]> {
  const rows = await db
    .select()
    .from(eventLogsTable)
    .where(eq(eventLogsTable.guildId, guildId))
    .orderBy(desc(eventLogsTable.tsMs))
    .limit(limit);
  return rows.map(rowToLog);
}

export async function getBotErrorsDB(limit = 100): Promise<EventLog[]> {
  const rows = await db
    .select()
    .from(eventLogsTable)
    .where(eq(eventLogsTable.type, "bot_error"))
    .orderBy(desc(eventLogsTable.tsMs))
    .limit(limit);
  return rows.map(rowToLog);
}
