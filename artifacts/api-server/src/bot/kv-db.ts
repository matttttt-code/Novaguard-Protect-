import { db, botKvTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export function kvSave(key: string, data: unknown): void {
  db.insert(botKvTable)
    .values({ key, value: data as Record<string, unknown> })
    .onConflictDoUpdate({
      target: botKvTable.key,
      set: { value: data as Record<string, unknown>, updatedAt: new Date() },
    })
    .catch((err: unknown) => logger.error({ err, key }, "[kv-db] save failed"));
}

export async function kvLoad<T>(key: string): Promise<T | null> {
  try {
    const [row] = await db.select().from(botKvTable).where(eq(botKvTable.key, key));
    return row ? (row.value as T) : null;
  } catch (err) {
    logger.error({ err, key }, "[kv-db] load failed");
    return null;
  }
}
