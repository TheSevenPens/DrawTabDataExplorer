import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
import { buildTabletNameMap } from '$lib/tablet-helpers.js';

export const prerender = false;

export async function load({ parent }) {
	const { ds } = await parent();
	const [allPens, allTablets, allSessions, allInventory, allRange] = await Promise.all([
		ds.Pens.toArray(),
		ds.Tablets.toArray(),
		ds.PressureResponse.toArray(),
		ds.InventoryPens.toArray(),
		ds.PressureRange.toArray(),
	]);
	const defectsByInventoryId = buildInventoryDefects(allInventory);
	const iafMeasurements = allRange.filter((m) => m.Metric === 'IAF');
	const maxMeasurements = allRange.filter((m) => m.Metric === 'MAX');
	return {
		allPens,
		allSessions,
		defectsByInventoryId,
		iafMeasurements,
		maxMeasurements,
		tabletNameById: buildTabletNameMap(allTablets),
	};
}
