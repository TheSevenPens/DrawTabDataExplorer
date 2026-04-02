import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'drawtabdata-theme';

function loadTheme(): Theme {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export const theme = writable<Theme>(loadTheme());

export function toggleTheme() {
  theme.update((current) => {
    const next: Theme = current === 'light' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  });
}
