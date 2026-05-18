import { db, userCommandsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";

export interface SaveUserCommandOpts {
  type: "rolerequest" | "suggestion" | "support";
  guildId?: string | null;
  guildName?: string | null;
  userId: string;
  userTag: string;
  data: Record<string, unknown>;
}

export async function saveUserCommand(opts: SaveUserCommandOpts): Promise<void> {
  await db.insert(userCommandsTable).values({
    type: opts.type,
    guildId: opts.guildId ?? null,
    guildName: opts.guildName ?? null,
    userId: opts.userId,
    userTag: opts.userTag,
    data: JSON.stringify(opts.data),
  });
}

export async function getUserCommands(opts: {
  type?: string;
  guildId?: string;
  limit?: number;
}) {
  const limit = Math.min(opts.limit ?? 100, 500);
  const conditions = [];
  if (opts.type) conditions.push(eq(userCommandsTable.type, opts.type));
  if (opts.guildId) conditions.push(eq(userCommandsTable.guildId, opts.guildId));

  const rows = await db
    .select()
    .from(userCommandsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(userCommandsTable.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, data: JSON.parse(r.data) as Record<string, unknown> }));
}
