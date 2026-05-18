import { db, globalBlacklistTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function addToGlobalBlacklistDB(entry: {
  userId: string;
  userTag: string;
  reason: string;
  moderatorTag: string;
  moderatorId: string;
}): Promise<void> {
  await db
    .insert(globalBlacklistTable)
    .values(entry)
    .onConflictDoUpdate({
      target: globalBlacklistTable.userId,
      set: {
        userTag: entry.userTag,
        reason: entry.reason,
        moderatorTag: entry.moderatorTag,
        moderatorId: entry.moderatorId,
        createdAt: new Date(),
      },
    });
}

export async function removeFromGlobalBlacklistDB(userId: string): Promise<void> {
  await db.delete(globalBlacklistTable).where(eq(globalBlacklistTable.userId, userId));
}

export async function isGloballyBlacklistedDB(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: globalBlacklistTable.userId })
    .from(globalBlacklistTable)
    .where(eq(globalBlacklistTable.userId, userId))
    .limit(1);
  return !!row;
}

export async function getAllGlobalBlacklistedDB() {
  return db.select().from(globalBlacklistTable).orderBy(globalBlacklistTable.createdAt);
}

export async function getGlobalBlacklistEntryDB(userId: string) {
  const [row] = await db
    .select()
    .from(globalBlacklistTable)
    .where(eq(globalBlacklistTable.userId, userId))
    .limit(1);
  return row ?? null;
}
