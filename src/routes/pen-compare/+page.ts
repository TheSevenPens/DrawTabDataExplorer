import { buildInventoryDefects } from '$data/lib/pressure/defects.js';

export const prerender = false;

export async function load({ parent }) {
	const { ds } = await parent();
	const [allPens, allSessions, allInventory] = await Promise.all([
		ds.Pens.toArray(),
		ds.PressureResponse.toArray(),
		ds.InventoryPens.toArray(),
	]);
	const defectsByInventoryId = buildInventoryDefects(allInventory);
	return { allPens, allSessions, defectsByInventoryId };
}
