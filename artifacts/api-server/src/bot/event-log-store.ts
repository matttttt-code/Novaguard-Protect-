/**
 * Event log store — ring buffer mémoire (200 entrées/guild) + persistance DB.
 * Trois catégories :
 *  - config_change  : modification d'un paramètre serveur via dashboard ou commande
 *  - command_exec   : exécution d'une commande slash ou prefix
 *  - bot_error      : erreur non gérée dans un handler de commande/bouton/modal
 */

import { insertEventLogDB, getGuildLogsDB, getBotErrorsDB, getBotRepliesDB } from "./event-log-db.js";

export type LogType = "config_change" | "command_exec" | "bot_error" | "bot_reply";
export type BotReplyLevel = "error" | "warn" | "info";

export interface EventLog {
  id: string;
  type: LogType;
  guildId: string | null;
  timestamp: number;
  // config_change
  field?: string;
  oldValue?: string;
  newValue?: string;
  // command_exec
  command?: string;
  via?: "slash" | "prefix";
  userTag?: string;
  userId?: string;
  success?: boolean;
  // bot_error
  errCode?: string;
  errMessage?: string;
  // bot_reply (level stored in errCode, text in errMessage)
  level?: BotReplyLevel;
  replyText?: string;
}

const MAX_PER_GUILD = 200;
const MAX_BOT_ERRORS = 100;

const guildLogs = new Map<string, EventLog[]>();
const botErrors: EventLog[] = [];

let seq = 0;
function nextId(): string {
  return `${Date.now()}-${(seq++).toString(36)}`;
}

function pushToGuild(guildId: string, entry: EventLog): void {
  if (!guildLogs.has(guildId)) guildLogs.set(guildId, []);
  const arr = guildLogs.get(guildId)!;
  arr.unshift(entry);
  if (arr.length > MAX_PER_GUILD) arr.length = MAX_PER_GUILD;
}

// ── Public writers ────────────────────────────────────────────────────────────

export function logConfigChange(
  guildId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  source: "dashboard" | string = "dashboard",
): void {
  const entry: EventLog = {
    id: nextId(),
    type: "config_change",
    guildId,
    timestamp: Date.now(),
    field,
    oldValue: JSON.stringify(oldValue ?? null),
    newValue: JSON.stringify(newValue ?? null),
    userTag: source,
  };
  pushToGuild(guildId, entry);
  insertEventLogDB(entry);
}

export function logCommandExec(
  guildId: string | null,
  command: string,
  via: "slash" | "prefix",
  userTag: string,
  userId: string,
  success: boolean,
): void {
  const entry: EventLog = {
    id: nextId(),
    type: "command_exec",
    guildId,
    timestamp: Date.now(),
    command,
    via,
    userTag,
    userId,
    success,
  };
  if (guildId) pushToGuild(guildId, entry);
  insertEventLogDB(entry);
}

export function logBotError(
  guildId: string | null,
  errCode: string,
  command: string,
  errMessage: string,
): void {
  const entry: EventLog = {
    id: nextId(),
    type: "bot_error",
    guildId,
    timestamp: Date.now(),
    errCode,
    command,
    errMessage,
  };
  botErrors.unshift(entry);
  if (botErrors.length > MAX_BOT_ERRORS) botErrors.length = MAX_BOT_ERRORS;
  if (guildId) pushToGuild(guildId, entry);
  insertEventLogDB(entry);
}

// ── Public readers — retournent l'historique complet depuis la DB ─────────────

export async function getGuildLogs(guildId: string, limit = 100): Promise<EventLog[]> {
  try {
    return await getGuildLogsDB(guildId, Math.min(limit, 200));
  } catch {
    return (guildLogs.get(guildId) ?? []).slice(0, limit);
  }
}

export async function getAllBotErrors(limit = 100): Promise<EventLog[]> {
  try {
    return await getBotErrorsDB(Math.min(limit, 100));
  } catch {
    return botErrors.slice(0, limit);
  }
}

export function logBotReply(
  guildId: string | null,
  command: string,
  level: BotReplyLevel,
  replyText: string,
  userId?: string,
  userTag?: string,
): void {
  const entry: EventLog = {
    id: nextId(),
    type: "bot_reply",
    guildId,
    timestamp: Date.now(),
    command,
    level,
    replyText,
    userId,
    userTag,
    // errCode = level, errMessage = replyText for DB persistence
    errCode: level,
    errMessage: replyText,
  };
  if (guildId) pushToGuild(guildId, entry);
  insertEventLogDB(entry);
}

export async function getBotRepliesForGuild(guildId: string, limit = 100): Promise<EventLog[]> {
  try {
    return await getBotRepliesDB(guildId, Math.min(limit, 200));
  } catch {
    return (guildLogs.get(guildId) ?? []).filter((e) => e.type === "bot_reply").slice(0, limit);
  }
}
