/**
 * Stocke les événements de statut du bot en mémoire (ring buffer).
 * Événements : démarrage, ping élevé, reconnexion, déconnexion, DM échoué, erreur client, etc.
 */

export type BotStatusEventType =
  | "ready"
  | "ping_alert"
  | "reconnect"
  | "shard_resume"
  | "shard_disconnect"
  | "dm_failed"
  | "client_error"
  | "unhandled_rejection"
  | "shutdown";

export interface BotStatusEvent {
  id: string;
  type: BotStatusEventType;
  timestamp: number;
  detail: string;
  ping?: number;
  errCode?: string;
}

const MAX_EVENTS = 500;
const events: BotStatusEvent[] = [];
let _counter = 0;

function nextId(): string {
  return `bse-${Date.now()}-${++_counter}`;
}

export function logBotStatusEvent(
  type: BotStatusEventType,
  detail: string,
  extras?: { ping?: number; errCode?: string },
): void {
  const entry: BotStatusEvent = {
    id: nextId(),
    type,
    timestamp: Date.now(),
    detail,
    ...extras,
  };
  events.unshift(entry);
  if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS);
}

export function getBotStatusEvents(limit = 200): BotStatusEvent[] {
  return events.slice(0, Math.min(limit, MAX_EVENTS));
}
