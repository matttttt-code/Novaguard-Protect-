import { db, suspectAccountsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";

export interface SaveSuspectAccountOpts {
  guildId: string;
  guildName: string;
  userId: string;
  userTag: string;
  accountAgeDays: number;
  hasNoAvatar: boolean;
  reasons: string[];
  actionTaken: "flagged" | "timeout" | "kicked" | "banned";
  securityLevel: number;
}

export async function saveSuspectAccount(opts: SaveSuspectAccountOpts): Promise<void> {
  await db.insert(suspectAccountsTable).values({
    guildId: opts.guildId,
    guildName: opts.guildName,
    userId: opts.userId,
    userTag: opts.userTag,
    accountAgeDays: opts.accountAgeDays,
    hasNoAvatar: opts.hasNoAvatar,
    reasons: opts.reasons.join("|"),
    actionTaken: opts.actionTaken,
    securityLevel: opts.securityLevel,
  });
}

export async function getSuspectAccounts(opts: {
  guildId?: string;
  limit?: number;
}) {
  const limit = Math.min(opts.limit ?? 100, 500);
  const conditions = [];
  if (opts.guildId) conditions.push(eq(suspectAccountsTable.guildId, opts.guildId));

  const rows = await db
    .select()
    .from(suspectAccountsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(suspectAccountsTable.detectedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, reasons: r.reasons.split("|").filter(Boolean) }));
}
