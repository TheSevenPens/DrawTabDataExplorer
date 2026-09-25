import { writable, derived } from 'svelte/store';
import { getStorageJson, setStorageJson } from '$lib/storage.js';

// --- Tablet flagging (Tablets > Flagged; an inbox for /compare, #373) ---
//
// Flags collect candidates; they are never required to compare. No cap —
// the comparison itself holds at most 8 columns (compare/model.ts).

const TABLETS_KEY = 'drawtabdata-flagged-tablets';
const TABLET_FAMILIES_KEY = 'drawtabdata-flagged-tablet-families';

// --- Pen flagging (drives the Pens > Flagged sub-tab) ---
//
// Three independent sets so a user can flag at any granularity:
//   pens     — physical pen units, by lowercase InventoryId (e.g. "wap.0030")
//   models   — pen models, by lowercase EntityId (e.g. "wacom.pen.kp504e")
//   families — pen families, by lowercase EntityId (e.g. "wacom.penfamily.wacom_kpgen2")
//
// No cap — overlay charts handle however many sessions get included.

const PEN_UNITS_KEY = 'drawtabdata-flagged-pen-units';
const PEN_MODELS_KEY = 'drawtabdata-flagged-pen-models';
const PEN_FAMILIES_KEY = 'drawtabdata-flagged-pen-families';

function loadList(key: string): string[] {
	const parsed = getStorageJson(key, [] as string[]);
	return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
}

function persist(key: string, ids: string[]) {
	setStorageJson(key, ids);
}

// --- Tablets ---

export const flaggedTablets = writable<string[]>(loadList(TABLETS_KEY));

export function toggleFlag(entityId: string) {
	flaggedTablets.update((ids) => {
		const idx = ids.indexOf(entityId);
		let next: string[];
		if (idx >= 0) {
			next = ids.filter((_, i) => i !== idx);
		} else {
			next = [...ids, entityId];
		}
		persist(TABLETS_KEY, next);
		return next;
	});
}

export function clearFlags() {
	flaggedTablets.set([]);
	persist(TABLETS_KEY, []);
}

// --- Tablet families (by lowercase EntityId) ---

export const flaggedTabletFamilies = writable<string[]>(loadList(TABLET_FAMILIES_KEY));

export function toggleFlaggedTabletFamily(entityId: string) {
	const id = entityId.toLowerCase();
	flaggedTabletFamilies.update((ids) => {
		const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
		persist(TABLET_FAMILIES_KEY, next);
		return next;
	});
}

export function clearFlaggedTabletFamilies() {
	flaggedTabletFamilies.set([]);
	persist(TABLET_FAMILIES_KEY, []);
}

/** Everything flagged on the tablet side: models plus families. */
export const flaggedCount = derived(
	[flaggedTablets, flaggedTabletFamilies],
	([$t, $f]) => $t.length + $f.length,
);

// --- Pen units (inventory IDs) ---

export const flaggedPenUnits = writable<string[]>(loadList(PEN_UNITS_KEY));

export function toggleFlaggedPenUnit(inventoryId: string) {
	const id = inventoryId.toLowerCase();
	flaggedPenUnits.update((ids) => {
		const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
		persist(PEN_UNITS_KEY, next);
		return next;
	});
}

// --- Pen models ---

export const flaggedPenModels = writable<string[]>(loadList(PEN_MODELS_KEY));

export function toggleFlaggedPenModel(entityId: string) {
	const id = entityId.toLowerCase();
	flaggedPenModels.update((ids) => {
		const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
		persist(PEN_MODELS_KEY, next);
		return next;
	});
}

// --- Pen families ---

export const flaggedPenFamilies = writable<string[]>(loadList(PEN_FAMILIES_KEY));

export function toggleFlaggedPenFamily(entityId: string) {
	const id = entityId.toLowerCase();
	flaggedPenFamilies.update((ids) => {
		const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
		persist(PEN_FAMILIES_KEY, next);
		return next;
	});
}

export function clearAllPenFlags() {
	flaggedPenUnits.set([]);
	flaggedPenModels.set([]);
	flaggedPenFamilies.set([]);
	persist(PEN_UNITS_KEY, []);
	persist(PEN_MODELS_KEY, []);
	persist(PEN_FAMILIES_KEY, []);
}

export const flaggedPenTotalCount = derived(
	[flaggedPenUnits, flaggedPenModels, flaggedPenFamilies],
	([$u, $m, $f]) => $u.length + $m.length + $f.length,
);
