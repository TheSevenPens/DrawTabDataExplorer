import { writable, derived } from 'svelte/store';
import { getStorageJson, setStorageJson } from '$lib/storage.js';

const STORAGE_KEY = 'drawtabdata-flagged-tablets';
const MAX_FLAGGED = 6;

function load(): string[] {
  const parsed = getStorageJson(STORAGE_KEY, [] as string[]);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
}

function persist(ids: string[]) {
  setStorageJson(STORAGE_KEY, ids);
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
