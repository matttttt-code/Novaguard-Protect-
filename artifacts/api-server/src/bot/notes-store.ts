import { kvSave, kvLoad } from "./kv-db.js";

export interface Note {
  id: number;
  content: string;
  moderator: string;
  moderatorId: string;
  timestamp: string;
}

type NoteInput = Omit<Note, "id">;
type Store = Record<string, Record<string, Note[]>>;
const KV_KEY = "notes";
let data: Store = {};
const counters: Record<string, number> = {};

export async function initNotesStore(): Promise<void> {
  const raw = await kvLoad<{ notes: Store; counters: Record<string, number> }>(KV_KEY);
  if (raw) {
    data = raw.notes ?? {};
    Object.assign(counters, raw.counters ?? {});
  }
}

function save(): void {
  kvSave(KV_KEY, { notes: data, counters });
}

function nextId(guildId: string): number {
  counters[guildId] = (counters[guildId] ?? 0) + 1;
  return counters[guildId]!;
}

export function addNote(guildId: string, userId: string, noteData: NoteInput): Note {
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId]![userId]) data[guildId]![userId] = [];
  const note: Note = { id: nextId(guildId), ...noteData };
  data[guildId]![userId]!.push(note);
  save();
  return note;
}

export function getNotes(guildId: string, userId: string): Note[] {
  return data[guildId]?.[userId] ?? [];
}

export function removeNote(guildId: string, userId: string, noteId: number): boolean {
  const notes = data[guildId]?.[userId];
  if (!notes) return false;
  const idx = notes.findIndex(n => n.id === noteId);
  if (idx === -1) return false;
  notes.splice(idx, 1);
  save();
  return true;
}

export function deleteNote(guildId: string, userId: string, noteId: number): boolean {
  return removeNote(guildId, userId, noteId);
}

export function clearNotes(guildId: string, userId: string): number {
  const count = data[guildId]?.[userId]?.length ?? 0;
  if (data[guildId]) delete data[guildId]![userId];
  save();
  return count;
}

export function getAllNotesForGuild(guildId: string): { userId: string; notes: Note[] }[] {
  return Object.entries(data[guildId] ?? {})
    .filter(([, notes]) => notes.length > 0)
    .map(([userId, notes]) => ({ userId, notes }));
}

export function getAllNotes(): { guildId: string; userId: string; notes: Note[] }[] {
  const result: { guildId: string; userId: string; notes: Note[] }[] = [];
  for (const [guildId, userMap] of Object.entries(data)) {
    for (const [userId, notes] of Object.entries(userMap)) {
      if (notes.length > 0) result.push({ guildId, userId, notes });
    }
  }
  return result;
}
