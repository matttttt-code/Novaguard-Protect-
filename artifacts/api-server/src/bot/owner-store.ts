const _ownerIds = new Set<string>();

export function setOwnerIds(ids: string[]): void {
  _ownerIds.clear();
  for (const id of ids) _ownerIds.add(id);
}

export function isOwner(userId: string): boolean {
  return _ownerIds.has(userId);
}
