import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ticketTranscriptsTable = pgTable("ticket_transcripts", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  guildName: text("guild_name").notNull().default(""),
  channelName: text("channel_name").notNull(),
  ticketNumber: integer("ticket_number").notNull(),
  userId: text("user_id").notNull(),
  userTag: text("user_tag").notNull(),
  closedBy: text("closed_by").notNull(),
  closedById: text("closed_by_id").notNull(),
  reason: text("reason").notNull().default("Aucune raison"),
  content: text("content").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull(),
  closedAt: timestamp("closed_at").notNull().defaultNow(),
});

export const insertTicketTranscriptSchema = createInsertSchema(ticketTranscriptsTable).omit({ id: true });
export type InsertTicketTranscript = z.infer<typeof insertTicketTranscriptSchema>;
export type TicketTranscript = typeof ticketTranscriptsTable.$inferSelect;
