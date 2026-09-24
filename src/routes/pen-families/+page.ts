// PenCount / InventoryCount / ModelIds are computed by the dataset while
// loading PenFamilies (#346) — this page used to compute them and push them
// into module-level setters, which is why a pen-family page reached any
// other way showed 0.
export async function load({ parent }) {
	const { ds } = await parent();
	return { families: await ds.PenFamilies.toArray() };
}
