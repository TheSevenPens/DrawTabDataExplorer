import { error } from '@sveltejs/kit';
import { penFullName } from '$lib/pen-helpers.js';
import { buildTabletNameMap } from '$lib/tablet-helpers.js';
import { buildInventoryDefects } from '$data/lib/pressure/defects.js';

export const prerender = false;

export async function load({ params, parent }) {
	const { ds } = await parent();
	const [pens, allPens, allTablets, pressureSessions, allRange] = await Promise.all([
		ds.InventoryPens.toArray(),
		ds.Pens.toArray(),
		ds.Tablets.toArray(),
		ds.PressureResponse.toArray(),
		ds.PressureRange.toArray(),
	]);

	const item = pens.find((p) => p._id === params.id);
	if (!item) error(404, `Inventory pen not found: ${params.id}`);

	const penModel = allPens.find((p) => p.EntityId === item.PenEntityId);
	const modelName = penModel ? penFullName(penModel) : item.PenEntityId;

	const sessions =
		item.InventoryId && item.InventoryId !== 'UNASSIGNED'
			? pressureSessions.filter((s) => s.InventoryId === item.InventoryId)
			: [];

	// Direct IAF measurements for this physical unit (win over the estimate).
	const iafMeasurements =
		item.InventoryId && item.InventoryId !== 'UNASSIGNED'
			? allRange.filter((m) => m.Metric === 'IAF' && m.PenInventoryId === item.InventoryId)
			: [];

	// Only this unit's defects matter for Piaf/Pmax exclusion on this
	// page — sessions are pre-filtered to one InventoryId.
	const defectsByInventoryId = buildInventoryDefects([item]);

	return {
		item,
		modelName,
		pressureSessions: sessions,
		defectsByInventoryId,
		iafMeasurements,
		tabletNameById: buildTabletNameMap(allTablets),
	};
}
