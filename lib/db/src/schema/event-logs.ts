import { pgTable, serial, text, timestamp, bigint } from "drizzle-orm/pg-core";

export const eventLogsTable = pgTable("event_logs", {
  id: serial("id").primaryKey(),
  logId: text("log_id").notNull().unique(),
  type: text("type").notNull(),
  guildId: text("guild_id"),
  tsMs: bigint("ts_ms", { mode: "number" }).notNull(),
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  command: text("command"),
  via: text("via"),
  userTag: text("user_tag"),
  userId: text("user_id"),
  success: text("success"),
  errCode: text("err_code"),
  errMessage: text("err_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EventLogRow = typeof eventLogsTable.$inferSelect;
export type InsertEventLog = typeof eventLogsTable.$inferInsert;
