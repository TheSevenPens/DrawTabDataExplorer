import { buildInventoryDefects } from '$data/lib/pressure/defects.js';

export const prerender = false;

export async function load({ parent }) {
	const { ds } = await parent();
	const [allPens, allSessions, allInventory, allRange] = await Promise.all([
		ds.Pens.toArray(),
		ds.PressureResponse.toArray(),
		ds.InventoryPens.toArray(),
		ds.PressureRange.toArray(),
	]);
	const defectsByInventoryId = buildInventoryDefects(allInventory);
	const iafMeasurements = allRange.filter((m) => m.Metric === 'IAF');
	return { allPens, allSessions, defectsByInventoryId, iafMeasurements };
}
