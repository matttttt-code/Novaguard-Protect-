import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildSettingsTable = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  // Captcha
  captchaEnabled: boolean("captcha_enabled").notNull().default(false),
  captchaChannelId: text("captcha_channel_id"),
  captchaRoleId: text("captcha_role_id"),
  captchaVerifiedRoleId: text("captcha_verified_role_id"),
  captchaTimeoutMins: integer("captcha_timeout_mins").notNull().default(5),
  captchaMaxAttempts: integer("captcha_max_attempts").notNull().default(3),
  captchaMode: text("captcha_mode").notNull().default("channel"), // "channel" | "dm"
  // Bot custom prefix per guild
  customPrefix: text("custom_prefix"),
  // Welcome message
  welcomeEnabled: boolean("welcome_enabled").notNull().default(false),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message"),
  // Updated
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGuildSettingsSchema = createInsertSchema(guildSettingsTable);
export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type GuildSettings = typeof guildSettingsTable.$inferSelect;
