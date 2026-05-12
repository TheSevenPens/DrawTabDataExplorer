export async function load({ parent }) {
	const { ds } = await parent();
	const [sessions, pens, inventoryPens] = await Promise.all([
		ds.PressureResponse.toArray(),
		ds.Pens.toArray(),
		ds.InventoryPens.toArray(),
	]);
	return { sessions, pens, inventoryPens };
}
