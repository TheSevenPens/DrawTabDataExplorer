/**
 * The working comparisons behind /compare (#373): one per kind, kept in the
 * browser until cleared — like flags, no names, no links. Operations are the
 * pure functions in model.ts; this only wraps them in stores and persists.
 */

import { writable, type Writable } from 'svelte/store';
import { getStorageJson, setStorageJson } from '$lib/storage.js';
import { parseComparison, type CompareKind, type Comparison } from './model';

const KEYS: Record<CompareKind, string> = {
	tablets: 'drawtabdata-compare-tablets',
	pens: 'drawtabdata-compare-pens',
};

function persisted(kind: CompareKind): Writable<Comparison> {
	const store = writable(parseComparison(getStorageJson<unknown>(KEYS[kind], null), kind));
	store.subscribe((c) => setStorageJson(KEYS[kind], c));
	return store;
}

export const comparisons: Record<CompareKind, Writable<Comparison>> = {
	tablets: persisted('tablets'),
	pens: persisted('pens'),
};

/** Apply a pure operation to one kind's working comparison. */
export function updateComparison(kind: CompareKind, op: (c: Comparison) => Comparison): void {
	comparisons[kind].update(op);
}
