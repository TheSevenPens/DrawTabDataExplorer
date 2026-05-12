export async function load({ parent }) {
	const { ds } = await parent();
	const brands = await ds.Brands.toArray();
	return { brands };
}
