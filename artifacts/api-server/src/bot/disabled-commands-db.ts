import { db, disabledCommandsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function isCommandDisabled(guildId: string, commandName: string): Promise<boolean> {
  const [row] = await db
    .select({ id: disabledCommandsTable.id })
    .from(disabledCommandsTable)
    .where(
      and(
        eq(disabledCommandsTable.guildId, guildId),
        eq(disabledCommandsTable.commandName, commandName),
      ),
    )
    .limit(1);
  return !!row;
}

export async function getDisabledCommands(guildId: string) {
  return db
    .select()
    .from(disabledCommandsTable)
    .where(eq(disabledCommandsTable.guildId, guildId));
}

export async function disableCommand(guildId: string, commandName: string, disabledBy: string, disabledById: string) {
  await db
    .insert(disabledCommandsTable)
    .values({ guildId, commandName, disabledBy, disabledById })
    .onConflictDoNothing();
}

export async function enableCommand(guildId: string, commandName: string) {
  await db
    .delete(disabledCommandsTable)
    .where(
      and(
        eq(disabledCommandsTable.guildId, guildId),
        eq(disabledCommandsTable.commandName, commandName),
      ),
    );
}

export async function enableAllCommands(guildId: string) {
  await db
    .delete(disabledCommandsTable)
    .where(eq(disabledCommandsTable.guildId, guildId));
}
