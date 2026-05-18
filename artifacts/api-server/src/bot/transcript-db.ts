import { db, ticketTranscriptsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import type { TicketData } from "./ticket-store.js";
import type { TextChannel } from "discord.js";

export async function buildTranscriptContent(channel: TextChannel): Promise<{ content: string; count: number }> {
  const fetched = await channel.messages.fetch({ limit: 100 });
  const sorted = [...fetched.values()].reverse();

  const lines = sorted.map((m) => {
    const ts = new Date(m.createdTimestamp).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    let content = m.content || "";
    if (!content && m.embeds.length) content = `[Embed: ${m.embeds[0]?.title ?? "sans titre"}]`;
    if (!content && m.attachments.size) content = `[Pièce jointe: ${[...m.attachments.values()].map((a) => a.url).join(", ")}]`;
    if (!content) content = "[Message vide]";
    const pinged = m.mentions.users.size ? ` (mentionne: ${m.mentions.users.map((u) => u.tag).join(", ")})` : "";
    return `[${ts}] ${m.author.tag} (${m.author.id}): ${content}${pinged}`;
  });

  const header = [
    `=== TRANSCRIPT — #${channel.name} ===`,
    `Généré le : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
    `Messages récupérés : ${lines.length}`,
    "=".repeat(48),
    "",
  ].join("\n");

  return { content: header + lines.join("\n"), count: lines.length };
}

export async function saveTranscriptToDB(opts: {
  ticket: TicketData;
  guildName: string;
  channelName: string;
  content: string;
  messageCount: number;
  closedBy: string;
  closedById: string;
  reason: string;
}): Promise<number> {
  const [row] = await db
    .insert(ticketTranscriptsTable)
    .values({
      guildId: opts.ticket.guildId,
      guildName: opts.guildName,
      channelName: opts.channelName,
      ticketNumber: opts.ticket.ticketNumber,
      userId: opts.ticket.userId,
      userTag: opts.ticket.username,
      closedBy: opts.closedBy,
      closedById: opts.closedById,
      reason: opts.reason,
      content: opts.content,
      messageCount: opts.messageCount,
      createdAt: opts.ticket.createdAt,
    })
    .returning({ id: ticketTranscriptsTable.id });
  return row?.id ?? 0;
}

export async function getTranscripts(guildId?: string, limit = 50) {
  if (guildId) {
    return db
      .select()
      .from(ticketTranscriptsTable)
      .where(eq(ticketTranscriptsTable.guildId, guildId))
      .orderBy(desc(ticketTranscriptsTable.closedAt))
      .limit(limit);
  }
  return db
    .select()
    .from(ticketTranscriptsTable)
    .orderBy(desc(ticketTranscriptsTable.closedAt))
    .limit(limit);
}

export async function getTranscriptById(id: number) {
  const [row] = await db
    .select()
    .from(ticketTranscriptsTable)
    .where(eq(ticketTranscriptsTable.id, id));
  return row ?? null;
}

export async function deleteTranscript(id: number) {
  await db.delete(ticketTranscriptsTable).where(eq(ticketTranscriptsTable.id, id));
}
