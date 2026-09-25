import { buildTabletNameMap, tabletBrandAndName } from '$lib/tablet-helpers.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, allTablets] = await Promise.all([
		ds.InventoryTablets.toArray(),
		ds.Tablets.toArray(),
	]);
	const tabletNameMap = buildTabletNameMap(allTablets);
	// The Timeline tab labels each unit from its model record — the canonical
	// "Brand Name" (no "Wacom Wacom One") and the model's own Type, not the
	// copy of it on the inventory row.
	const modelById = new Map(
		allTablets.map((t) => [t.Meta.EntityId, { label: tabletBrandAndName(t), type: t.Model.Type }]),
	);
	return { tablets, tabletNameMap, modelById };
}
