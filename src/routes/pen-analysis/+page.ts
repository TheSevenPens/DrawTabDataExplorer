export async function load({ parent }) {
	const { ds } = await parent();
	const [pressureSessions, inventoryPens, pens] = await Promise.all([
		ds.PressureResponse.toArray(),
		ds.InventoryPens.toArray(),
		ds.Pens.toArray(),
	]);
	return { pressureSessions, inventoryPens, pens };
}
