// Curation-gap view: tablets that are in the inventory (have at least one
// inventory unit) but carry no reference links yet. One row per such tablet,
// with its inventory unit count. Labels go through the canonical tablet
// formatters (see tablet-helpers) — never reconstruct names inline.
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { brandName } from '$data/lib/drawtab-loader.js';
import { tabletFullName, tabletNameAndId } from '$lib/tablet-helpers.js';

export interface InventoryNoLinksRow {
	tabletEntityId: string;
	/** Brand + Name + Id, used for the search filter. */
	tabletFullName: string;
	/** Name (Id) only — brand lives in its own column. */
	tabletLabel: string;
	/** Brand enum code (e.g. "WACOM"), the brand dropdown value. */
	brand: string;
	brandName: string;
	/** Tablet Model.Type (PENTABLET / PENDISPLAY / STANDALONE). */
	type: string;
	/** Model.ReleaseYear. */
	year: string;
	/** Number of inventory units owned for this tablet. */
	units: number;
}

/** Anything carrying a TabletEntityId — the only inventory field we read. */
interface InventoryRef {
	TabletEntityId: string;
}

export function buildInventoryTabletsWithoutLinksRows(
	tablets: Tablet[],
	inventory: InventoryRef[],
): InventoryNoLinksRow[] {
	const counts = new Map<string, number>();
	for (const u of inventory) counts.set(u.TabletEntityId, (counts.get(u.TabletEntityId) ?? 0) + 1);

	const rows: InventoryNoLinksRow[] = [];
	for (const t of tablets) {
		const units = counts.get(t.Meta.EntityId);
		if (!units) continue; // not in inventory
		if ((t.Model.Links?.length ?? 0) > 0) continue; // already has links
		rows.push({
			tabletEntityId: t.Meta.EntityId,
			tabletFullName: tabletFullName(t),
			tabletLabel: tabletNameAndId(t),
			brand: t.Model.Brand,
			brandName: brandName(t.Model.Brand),
			type: t.Model.Type,
			year: t.Model.ReleaseYear,
			units,
		});
	}
	rows.sort((a, b) => a.tabletFullName.localeCompare(b.tabletFullName));
	return rows;
}
