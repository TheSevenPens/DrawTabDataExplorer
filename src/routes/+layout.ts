// Agent note: one DrawTabDataSet per session — child +page.ts use await parent() for ds.
// See CLAUDE.md § Data loading and AGENTS.md.
import { base } from '$app/paths';
import { DrawTabDataSet } from '$data/lib/dataset.js';
import type { VersionInfo } from '$data/lib/drawtab-loader.js';
import { setDefectsByInventoryId } from '$data/lib/entities/pressure-response-fields.js';
import {
	setPenFamilyNames,
	setPressureSessionCountByPenEntityId,
	setInventoryUnitCountByPenEntityId,
} from '$data/lib/entities/pen-fields.js';
import { buildInventoryDefects } from '$data/lib/pressure/defects.js';

export const prerender = true;
export const ssr = false;

// One DataSet instance is constructed here and propagated to every child
// `+page.ts` via `await parent()`. Two wins over per-page instantiation:
// the per-collection load cache is now session-scoped (navigating between
// pages reuses fetched data), and userId / baseUrl are declared in one
// place instead of being repeated by every list page.
//
// We also eagerly load InventoryPens + PressureResponse here so the
// `IsDefective` (on PressureResponse) and `PressureSessionCount` (on Pen)
// computed FieldDefs have accurate values everywhere — any page that
// queries pens or pressure sessions inherits the lookups without having
// to wire them page-by-page.
export async function load(): Promise<{ ds: DrawTabDataSet; version: VersionInfo | null }> {
	const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base, userId: 'sevenpens' });
	const [version, inventoryPens, sessions, penFamilies] = await Promise.all([
		ds.getVersion(),
		ds.InventoryPens.toArray(),
		ds.PressureResponse.toArray(),
		ds.PenFamilies.toArray(),
	]);
	setDefectsByInventoryId(buildInventoryDefects(inventoryPens));

	// EntityId -> FamilyName lookup so the Pen "Family" column on lists
	// and the Family field on PenDetail show a human-readable name even
	// when the user lands directly on /entity/<pen-id> (rather than
	// arriving via /pens which used to be the only setter site).
	const familyNames: Record<string, string> = {};
	for (const f of penFamilies) familyNames[f.EntityId] = f.FamilyName;
	setPenFamilyNames(familyNames);

	// Count pressure-response sessions per pen model (by PenEntityId) so
	// the new `PressureSessionCount` computed FieldDef on Pen reflects
	// real coverage on every list / detail page.
	const sessionsByPen = new Map<string, number>();
	for (const s of sessions) {
		sessionsByPen.set(s.PenEntityId, (sessionsByPen.get(s.PenEntityId) ?? 0) + 1);
	}
	setPressureSessionCountByPenEntityId(sessionsByPen);

	// Count inventory units per pen model so the `UnitsInInventory`
	// computed FieldDef shows how many physical units we own of each model.
	const unitsByPen = new Map<string, number>();
	for (const u of inventoryPens) {
		unitsByPen.set(u.PenEntityId, (unitsByPen.get(u.PenEntityId) ?? 0) + 1);
	}
	setInventoryUnitCountByPenEntityId(unitsByPen);

	return { ds, version };
}
