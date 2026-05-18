import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const globalBlacklistTable = pgTable("global_blacklist", {
  userId: text("user_id").primaryKey(),
  userTag: text("user_tag").notNull(),
  reason: text("reason").notNull(),
  moderatorTag: text("moderator_tag").notNull(),
  moderatorId: text("moderator_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGlobalBlacklistSchema = createInsertSchema(globalBlacklistTable);
export type InsertGlobalBlacklist = z.infer<typeof insertGlobalBlacklistSchema>;
export type GlobalBlacklistEntry = typeof globalBlacklistTable.$inferSelect;
