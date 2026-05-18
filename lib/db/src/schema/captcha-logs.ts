import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const captchaLogs = pgTable("captcha_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  guildName: text("guild_name").notNull().default(""),
  userId: text("user_id").notNull(),
  userTag: text("user_tag").notNull(),
  event: text("event").notNull(),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CaptchaLog = typeof captchaLogs.$inferSelect;
export type InsertCaptchaLog = typeof captchaLogs.$inferInsert;
