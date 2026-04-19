import type { Step } from '$data/lib/pipeline/types.js';
import { getStorageJson, setStorageJson, removeStorageItem } from '$lib/storage.js';

export interface SavedView {
  name: string;
  steps: Step[];
}

const LEGACY_KEY = 'drawtabdata-views';

function getStorageKey(entityType: string): string {
  return `drawtabdata-views-${entityType}`;
}

function migrate(entityType: string) {
  const legacyViews = getStorageJson<SavedView[] | null>(LEGACY_KEY, null);
  if (!legacyViews) return;
  setStorageJson(getStorageKey(entityType), legacyViews);
  removeStorageItem(LEGACY_KEY);
}

function isValidSavedView(value: unknown): value is SavedView {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.name === 'string' && Array.isArray(entry.steps);
}

export function loadViews(entityType: string): SavedView[] {
  migrate(entityType);
  const raw = getStorageJson<unknown>(getStorageKey(entityType), []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidSavedView);
}

function persist(entityType: string, views: SavedView[]) {
  setStorageJson(getStorageKey(entityType), views);
}

export function saveView(entityType: string, name: string, steps: Step[]): void {
  const views = loadViews(entityType);
  const existing = views.findIndex((v) => v.name === name);
  const entry: SavedView = { name, steps: JSON.parse(JSON.stringify(steps)) };
  if (existing >= 0) {
    views[existing] = entry;
  } else {
    views.push(entry);
  }
  persist(entityType, views);
}

export function deleteView(entityType: string, name: string): void {
  const views = loadViews(entityType).filter((v) => v.name !== name);
  persist(entityType, views);
}

export function renameView(entityType: string, oldName: string, newName: string): void {
  const views = loadViews(entityType);
  const view = views.find((v) => v.name === oldName);
  if (view) {
    view.name = newName;
  }
  persist(entityType, views);
}
