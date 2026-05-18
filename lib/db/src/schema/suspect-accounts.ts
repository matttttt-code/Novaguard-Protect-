import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const suspectAccountsTable = pgTable("suspect_accounts", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  guildName: text("guild_name").notNull().default(""),
  userId: text("user_id").notNull(),
  userTag: text("user_tag").notNull(),
  accountAgeDays: integer("account_age_days").notNull().default(0),
  hasNoAvatar: boolean("has_no_avatar").notNull().default(false),
  reasons: text("reasons").notNull().default(""),
  actionTaken: text("action_taken").notNull().default("flagged"),
  securityLevel: integer("security_level").notNull().default(1),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  vpnSuspicion: boolean("vpn_suspicion").notNull().default(false),
  userLocale: text("user_locale"),
  verified: boolean("verified").notNull().default(false),
  tags: text("tags").notNull().default(""),
});

export type SuspectAccount = typeof suspectAccountsTable.$inferSelect;
