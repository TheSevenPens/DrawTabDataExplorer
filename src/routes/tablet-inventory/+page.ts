import { tabletFullName } from '$lib/tablet-helpers.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, allTablets] = await Promise.all([
		ds.InventoryTablets.toArray(),
		ds.Tablets.toArray(),
	]);
	const tabletNameMap: Record<string, string> = {};
	for (const t of allTablets) tabletNameMap[t.Meta.EntityId] = tabletFullName(t);
	return { tablets, tabletNameMap };
}
