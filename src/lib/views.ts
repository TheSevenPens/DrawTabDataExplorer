import type { Step } from '@thesevenpens/queriton';
import { getStorageJson, setStorageJson, removeStorageItem } from '$lib/storage.js';
import { migrateFieldKeys } from '$lib/field-key-migrations.js';
import { migrateFilterValues } from '$lib/filter-value-migrations.js';

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

/** The built-in view every entity list offers. User views may not take its
 * name — the picker keys options by name, so a clash would shadow it. */
export const BUILTIN_VIEW_NAME = 'Default';

function isReservedName(name: string): boolean {
	return name.trim().toLowerCase() === BUILTIN_VIEW_NAME.toLowerCase();
}

/** A step must at least be an object naming its kind; anything else (e.g. a
 * `null` left by a bad write) would throw when the pipeline reads `kind`. */
function isValidStep(value: unknown): boolean {
	return (
		!!value && typeof value === 'object' && typeof (value as { kind?: unknown }).kind === 'string'
	);
}

function isValidSavedView(value: unknown): value is SavedView {
	if (!value || typeof value !== 'object') return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.name === 'string' &&
		entry.name.trim() !== '' &&
		Array.isArray(entry.steps) &&
		entry.steps.every(isValidStep)
	);
}

/** Names are the view identity (the picker selects and keys by name), so they
 * must be unique. Storage written before that was enforced can hold
 * duplicates or the reserved name; suffix those rather than drop them. */
function uniqueNames(views: SavedView[]): SavedView[] {
	const taken = new Set<string>([BUILTIN_VIEW_NAME.toLowerCase()]);
	return views.map((view) => {
		let name = view.name;
		for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${view.name} (${n})`;
		taken.add(name.toLowerCase());
		return name === view.name ? view : { ...view, name };
	});
}

/**
 * Load the saved views for an entity list. Entries that aren't a usable view
 * (no name, non-array steps, a malformed step) are skipped rather than
 * crashing the page when applied (GitHub #334).
 */
export function loadViews(entityType: string): SavedView[] {
	migrate(entityType);
	const raw = getStorageJson<unknown>(getStorageKey(entityType), []);
	if (!Array.isArray(raw)) return [];
	// Steps reference fields by FieldDef key, so a view saved before a key was
	// renamed would point at a field that no longer exists — see
	// field-key-migrations.ts. Filter values that used to be display labels
	// get the same treatment — see filter-value-migrations.ts.
	return uniqueNames(
		raw.filter(isValidSavedView).map((view) => migrateFilterValues(migrateFieldKeys(view))),
	);
}

function persist(entityType: string, views: SavedView[]): boolean {
	return setStorageJson(getStorageKey(entityType), views);
}

/** Outcome of a write. `storage` means the browser refused the write
 * (quota, private mode) — the caller should tell the user it wasn't saved. */
export type ViewWriteResult = 'ok' | 'reserved' | 'exists' | 'missing' | 'storage';

/**
 * Persist a named saved view. `steps` is the *active* query (the same pipeline
 * that executes) — disabled filters are already excluded upstream by
 * `buildActiveSteps`, so a saved view captures the active query only and
 * disabled filters stay transient UI state, never persisted (GitHub #227).
 *
 * Saving under an existing user view's name overwrites it (that is how a
 * view is updated). The built-in name is refused.
 */
export function saveView(entityType: string, name: string, steps: Step[]): ViewWriteResult {
	const trimmed = name.trim();
	if (isReservedName(trimmed)) return 'reserved';
	const views = loadViews(entityType);
	const existing = views.findIndex((v) => v.name === trimmed);
	const entry: SavedView = { name: trimmed, steps: JSON.parse(JSON.stringify(steps)) };
	if (existing >= 0) {
		views[existing] = entry;
	} else {
		views.push(entry);
	}
	return persist(entityType, views) ? 'ok' : 'storage';
}

export function deleteView(entityType: string, name: string): ViewWriteResult {
	const views = loadViews(entityType).filter((v) => v.name !== name);
	return persist(entityType, views) ? 'ok' : 'storage';
}

/** Rename a view. Refuses a name another view already has — renaming A to an
 * existing B used to leave two views named B, which broke the picker. */
export function renameView(entityType: string, oldName: string, newName: string): ViewWriteResult {
	const trimmed = newName.trim();
	if (isReservedName(trimmed)) return 'reserved';
	const views = loadViews(entityType);
	const view = views.find((v) => v.name === oldName);
	if (!view) return 'missing';
	if (trimmed === oldName) return 'ok';
	if (views.some((v) => v !== view && v.name.toLowerCase() === trimmed.toLowerCase()))
		return 'exists';
	view.name = trimmed;
	return persist(entityType, views) ? 'ok' : 'storage';
}
