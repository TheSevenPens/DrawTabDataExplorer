import { writable, derived } from 'svelte/store';

const STORAGE_KEY = 'drawtabdata-flagged-tablets';
const MAX_FLAGGED = 6;

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
}

export const flaggedTablets = writable<string[]>(load());

export function toggleFlag(entityId: string) {
  flaggedTablets.update((ids) => {
    const idx = ids.indexOf(entityId);
    let next: string[];
    if (idx >= 0) {
      next = ids.filter((_, i) => i !== idx);
    } else if (ids.length < MAX_FLAGGED) {
      next = [...ids, entityId];
    } else {
      return ids;
    }
    persist(next);
    return next;
  });
}

export function clearFlags() {
  flaggedTablets.set([]);
  persist([]);
}

export const flaggedCount = derived(flaggedTablets, ($f) => $f.length);
