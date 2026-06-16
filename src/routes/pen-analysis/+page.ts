export async function load({ parent }) {
	const { ds } = await parent();
	const [pressureSessions, inventoryPens, pens, allRange] = await Promise.all([
		ds.PressureResponse.toArray(),
		ds.InventoryPens.toArray(),
		ds.Pens.toArray(),
		ds.PressureRange.toArray(),
	]);
	const iafMeasurements = allRange.filter((m) => m.Metric === 'IAF');
	return { pressureSessions, inventoryPens, pens, iafMeasurements };
}
