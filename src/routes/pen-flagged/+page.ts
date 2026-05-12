export async function load({ parent }) {
	const { ds } = await parent();
	const [pens, families, sessions, inventoryPens] = await Promise.all([
		ds.Pens.toArray(),
		ds.PenFamilies.toArray(),
		ds.PressureResponse.toArray(),
		ds.InventoryPens.toArray(),
	]);
	return { pens, families, sessions, inventoryPens };
}
