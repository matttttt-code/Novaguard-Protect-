import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger.js";

export interface Note {
  id: number;
  content: string;
  moderator: string;
  moderatorId: string;
  timestamp: string;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "notes.json");

type Store = Record<string, Record<string, Note[]>>;
let data: Store = {};
const counters: Record<string, number> = {};

function save(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify({ notes: data, counters }, null, 2), "utf8");
  } catch (err) { logger.error({ err }, "[notes-store] save failed"); }
}

function load(): void {
  try {
    if (!existsSync(FILE)) return;
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as { notes: Store; counters: Record<string, number> };
    data = raw.notes ?? {};
    Object.assign(counters, raw.counters ?? {});
  } catch (err) { logger.error({ err }, "[notes-store] load failed"); }
}

load();

function nextId(guildId: string): number {
  counters[guildId] = (counters[guildId] ?? 0) + 1;
  return counters[guildId]!;
}

export function addNote(guildId: string, userId: string, note: Omit<Note, "id">): Note {
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId]![userId]) data[guildId]![userId] = [];
  const full: Note = { ...note, id: nextId(guildId) };
  data[guildId]![userId]!.push(full);
  save();
  return full;
}

export function getNotes(guildId: string, userId: string): Note[] {
  return data[guildId]?.[userId] ?? [];
}

export function deleteNote(guildId: string, userId: string, noteId: number): boolean {
  const notes = data[guildId]?.[userId];
  if (!notes) return false;
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx === -1) return false;
  notes.splice(idx, 1);
  save();
  return true;
}

export function getAllNotesForGuild(guildId: string): { userId: string; notes: Note[] }[] {
  const guildData = data[guildId];
  if (!guildData) return [];
  return Object.entries(guildData)
    .filter(([, notes]) => notes.length > 0)
    .map(([userId, notes]) => ({ userId, notes }));
}

export function getAllNotes(): { guildId: string; userId: string; notes: Note[] }[] {
  const result: { guildId: string; userId: string; notes: Note[] }[] = [];
  for (const [guildId, users] of Object.entries(data)) {
    for (const [userId, notes] of Object.entries(users)) {
      if (notes.length > 0) result.push({ guildId, userId, notes });
    }
  }
  return result;
}

export function clearNotes(guildId: string, userId: string): number {
  const notes = data[guildId]?.[userId] ?? [];
  const count = notes.length;
  if (data[guildId]) delete data[guildId]![userId];
  save();
  return count;
}
