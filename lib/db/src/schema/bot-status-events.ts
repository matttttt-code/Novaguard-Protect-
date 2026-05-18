import { pgTable, serial, text, bigint, integer, timestamp } from "drizzle-orm/pg-core";

export const botStatusEventsTable = pgTable("bot_status_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  type: text("type").notNull(),
  tsMs: bigint("ts_ms", { mode: "number" }).notNull(),
  detail: text("detail").notNull(),
  ping: integer("ping"),
  errCode: text("err_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BotStatusEventRow = typeof botStatusEventsTable.$inferSelect;
