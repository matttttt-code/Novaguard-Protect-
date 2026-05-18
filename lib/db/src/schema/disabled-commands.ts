import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const disabledCommandsTable = pgTable("disabled_commands", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  commandName: text("command_name").notNull(),
  disabledBy: text("disabled_by").notNull(),
  disabledById: text("disabled_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("uq_guild_command").on(t.guildId, t.commandName),
]);

export const insertDisabledCommandSchema = createInsertSchema(disabledCommandsTable).omit({ id: true });
export type InsertDisabledCommand = z.infer<typeof insertDisabledCommandSchema>;
export type DisabledCommand = typeof disabledCommandsTable.$inferSelect;
