import { buildPenNameMap } from '$lib/pen-helpers.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [pens, allPens] = await Promise.all([ds.InventoryPens.toArray(), ds.Pens.toArray()]);
	const penNameMap = buildPenNameMap(allPens);
	return { pens, penNameMap };
}
