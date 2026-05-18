// Agent note: one DrawTabDataSet per session — child +page.ts use await parent() for ds.
// See CLAUDE.md § Data loading and AGENTS.md.
import { base } from '$app/paths';
import { DrawTabDataSet } from '$data/lib/dataset.js';
import type { VersionInfo } from '$data/lib/drawtab-loader.js';
import { setDefectsByInventoryId } from '$data/lib/entities/pressure-response-fields.js';
import { buildInventoryDefects } from '$data/lib/pressure/defects.js';

export const prerender = true;
export const ssr = false;

// One DataSet instance is constructed here and propagated to every child
// `+page.ts` via `await parent()`. Two wins over per-page instantiation:
// the per-collection load cache is now session-scoped (navigating between
// pages reuses fetched data), and userId / baseUrl are declared in one
// place instead of being repeated by every list page.
//
// We also eagerly load InventoryPens here so the PressureResponse
// `IsDefective` computed FieldDef has accurate values everywhere — any
// page that queries pressure sessions inherits the lookup without
// having to wire it page-by-page.
export async function load(): Promise<{ ds: DrawTabDataSet; version: VersionInfo | null }> {
	const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base, userId: 'sevenpens' });
	const [version, inventoryPens] = await Promise.all([ds.getVersion(), ds.InventoryPens.toArray()]);
	setDefectsByInventoryId(buildInventoryDefects(inventoryPens));
	return { ds, version };
}
