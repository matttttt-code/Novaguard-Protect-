export interface ActionLogEntry {
  timestamp: string;
  method: string;
  path: string;
  body: Record<string, unknown>;
}

const MAX = 300;
const entries: ActionLogEntry[] = [];

export function addActionLog(entry: ActionLogEntry): void {
  entries.unshift(entry);
  if (entries.length > MAX) entries.pop();
}

export function getActionLog(): ActionLogEntry[] {
  return [...entries];
}
