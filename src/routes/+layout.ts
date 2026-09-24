// Agent note: one DrawTabDataSet per session — child +page.ts use await parent() for ds.
// See CLAUDE.md § Data loading and AGENTS.md.
import { base } from '$app/paths';
import { DrawTabDataSet } from '$data/lib/dataset.js';
import type { VersionInfo } from '$data/lib/drawtab-loader.js';

export const prerender = true;
export const ssr = false;

// One DataSet instance is constructed here and propagated to every child
// `+page.ts` via `await parent()`. Two wins over per-page instantiation:
// the per-collection load cache is session-scoped (navigating between
// pages reuses fetched data), and userId / baseUrl are declared in one
// place instead of being repeated by every list page.
//
// Only version.json is loaded eagerly (for the schema banner). Computed
// fields — UnitsInInventory, PressureSessionCount, IsDefective, pen-family
// names and counts — used to force this layout to preload inventory,
// every pressure session and every pen family (~1.6 MB) on *every* page,
// /about included, just to fill module-level lookups. The dataset now
// computes them itself while loading the collection that shows them
// (data-repo lib/computed.ts, #346), so a page pays only for what it reads.
export async function load(): Promise<{ ds: DrawTabDataSet; version: VersionInfo | null }> {
	const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base, userId: 'sevenpens' });
	const version = await ds.getVersion();
	return { ds, version };
}
