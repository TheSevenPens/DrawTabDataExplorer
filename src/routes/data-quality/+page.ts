export async function load({ parent }) {
	const { ds } = await parent();
	const [
		brands,
		tablets,
		pens,
		penCompat,
		penFamilies,
		tabletFamilies,
		drivers,
		pressureResponse,
		invPens,
		invTablets,
	] = await Promise.all([
		ds.Brands.toArray(),
		ds.Tablets.toArray(),
		ds.Pens.toArray(),
		ds.PenCompat.toArray(),
		ds.PenFamilies.toArray(),
		ds.TabletFamilies.toArray(),
		ds.Drivers.toArray(),
		ds.PressureResponse.toArray(),
		ds.InventoryPens.toArray(),
		ds.InventoryTablets.toArray(),
	]);
	return {
		brands,
		tablets,
		pens,
		penCompat,
		penFamilies,
		tabletFamilies,
		drivers,
		pressureResponse,
		invPens,
		invTablets,
	};
}
