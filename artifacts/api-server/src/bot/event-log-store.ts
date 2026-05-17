/**
 * In-memory event log store — ring buffer, 200 entries per guild.
 * Three categories:
 *  - config_change  : a guild config field was changed via dashboard or command
 *  - command_exec   : a slash or prefix command was executed (success or error)
 *  - bot_error      : an unhandled error was caught in a command/button/modal handler
 */

export type LogType = "config_change" | "command_exec" | "bot_error";

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
}

// ── Public readers ─────────────────────────────────────────────────────────────

export function getGuildLogs(guildId: string, limit = 100): EventLog[] {
  return (guildLogs.get(guildId) ?? []).slice(0, limit);
}

export function getAllBotErrors(limit = 100): EventLog[] {
  return botErrors.slice(0, limit);
}
