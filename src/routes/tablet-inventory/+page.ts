import { buildTabletNameMap } from '$lib/tablet-helpers.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, allTablets] = await Promise.all([
		ds.InventoryTablets.toArray(),
		ds.Tablets.toArray(),
	]);
	const tabletNameMap = buildTabletNameMap(allTablets);
	return { tablets, tabletNameMap };
}
