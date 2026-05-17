import { error } from '@sveltejs/kit';
import { penFullName } from '$lib/pen-helpers.js';

export const prerender = false;

export async function load({ params, parent }) {
	const { ds } = await parent();
	const [pens, allPens, pressureSessions] = await Promise.all([
		ds.InventoryPens.toArray(),
		ds.Pens.toArray(),
		ds.PressureResponse.toArray(),
	]);

	const item = pens.find((p) => p._id === params.id);
	if (!item) error(404, `Inventory pen not found: ${params.id}`);

	const penModel = allPens.find((p) => p.EntityId === item.PenEntityId);
	const modelName = penModel ? penFullName(penModel) : item.PenEntityId;

	const sessions =
		item.InventoryId && item.InventoryId !== 'UNASSIGNED'
			? pressureSessions.filter((s) => s.InventoryId === item.InventoryId)
			: [];

	return { item, modelName, pressureSessions: sessions };
}
