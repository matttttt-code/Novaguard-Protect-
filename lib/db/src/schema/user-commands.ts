import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const userCommandsTable = pgTable("user_commands", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  guildId: text("guild_id"),
  guildName: text("guild_name"),
  userId: text("user_id").notNull(),
  userTag: text("user_tag").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserCommand = typeof userCommandsTable.$inferSelect;
