// Cell-link factories for the inventory list pages. Both list pages wire
// the same two clickable columns:
//   - InventoryId → unit detail page (/pen-inventory/<_id> or
//     /tablet-inventory/<_id>)
//   - {Pen,Tablet}EntityId → product-model detail page (/entity/<id>)
//
// Factories return the cellLinks Record consumed by ResultsTable.

import { base } from '$app/paths';
import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
import type { InventoryTablet } from '$data/lib/entities/inventory-tablet-fields.js';

type CellLink = { label: string; href: string };

export function inventoryPenCellLinks(
	penNameMap: ReadonlyMap<string, string>,
): Record<string, (item: InventoryPen) => CellLink[]> {
	return {
		InventoryId: (item) => [
			{ label: item.InventoryId, href: `${base}/pen-inventory/${encodeURIComponent(item._id)}` },
		],
		PenEntityId: (item) => [
			{
				label: penNameMap.get(item.PenEntityId) ?? item.PenEntityId,
				href: `${base}/entity/${encodeURIComponent(item.PenEntityId)}`,
			},
		],
	};
}

export function inventoryTabletCellLinks(
	tabletNameMap: ReadonlyMap<string, string>,
): Record<string, (item: InventoryTablet) => CellLink[]> {
	return {
		InventoryId: (item) => [
			{ label: item.InventoryId, href: `${base}/tablet-inventory/${encodeURIComponent(item._id)}` },
		],
		TabletEntityId: (item) => [
			{
				label: tabletNameMap.get(item.TabletEntityId) ?? item.TabletEntityId,
				href: `${base}/entity/${encodeURIComponent(item.TabletEntityId)}`,
			},
		],
	};
}
