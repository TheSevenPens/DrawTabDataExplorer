import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
import { buildTabletNameAndIdMap } from '$lib/tablet-helpers.js';

export const prerender = true;

export async function load({ parent }) {
	const { ds } = await parent();
	const [allPens, allTablets, penFamilies, allSessions, allInventory, allRange] = await Promise.all(
		[
			ds.Pens.toArray(),
			ds.Tablets.toArray(),
			ds.PenFamilies.toArray(),
			ds.PressureResponse.toArray(),
			ds.InventoryPens.toArray(),
			ds.PressureRange.toArray(),
		],
	);
	return {
		allPens,
		penFamilies,
		allInventory,
		allSessions,
		defectsByInventoryId: buildInventoryDefects(allInventory),
		iafMeasurements: allRange.filter((m) => m.Metric === 'IAF'),
		maxMeasurements: allRange.filter((m) => m.Metric === 'MAX'),
		tabletNameById: buildTabletNameAndIdMap(allTablets),
	};
}
