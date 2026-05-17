import { EmbedBuilder } from "discord.js";

export interface AdminDMPending {
  guildId: string;
  embed: EmbedBuilder;
  timestamp: number;
}

const store = new Map<string, AdminDMPending>();

export function addAdminDMPending(id: string, data: AdminDMPending): void {
  store.set(id, data);
  setTimeout(() => store.delete(id), 60 * 60 * 1000);
}

export function getAdminDMPending(id: string): AdminDMPending | undefined {
  return store.get(id);
}

export function removeAdminDMPending(id: string): void {
  store.delete(id);
}
