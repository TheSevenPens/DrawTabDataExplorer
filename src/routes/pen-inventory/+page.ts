import { penFullName } from '$lib/pen-helpers.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [pens, allPens] = await Promise.all([ds.InventoryPens.toArray(), ds.Pens.toArray()]);
	const penNameMap: Record<string, string> = {};
	for (const pen of allPens) penNameMap[pen.EntityId] = penFullName(pen);
	return { pens, penNameMap };
}
