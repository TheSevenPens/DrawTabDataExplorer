import { error } from '@sveltejs/kit';
import { tabletFullName } from '$lib/tablet-helpers.js';
import { penFullName } from '$lib/pen-helpers.js';

export const prerender = false;

export async function load({ params, parent }) {
	const { ds } = await parent();
	const [tablets, allTablets, inventoryPens, allPens] = await Promise.all([
		ds.InventoryTablets.toArray(),
		ds.Tablets.toArray(),
		ds.InventoryPens.toArray(),
		ds.Pens.toArray(),
	]);

	const item = tablets.find((t) => t._id === params.id);
	if (!item) error(404, `Inventory tablet not found: ${params.id}`);

	const tabletModel = allTablets.find((t) => t.Meta.EntityId === item.TabletEntityId);
	const modelName = tabletModel ? tabletFullName(tabletModel) : item.TabletEntityId;

	const bundledPens =
		item.InventoryId && item.InventoryId !== 'UNASSIGNED'
			? inventoryPens.filter((p) => p.WithTabletInventoryId === item.InventoryId)
			: [];

	const penNameMap: Record<string, string> = {};
	for (const p of allPens) penNameMap[p.EntityId] = penFullName(p);

	return { item, modelName, bundledPens, penNameMap };
}
