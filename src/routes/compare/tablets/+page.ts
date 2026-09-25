export const prerender = true;

export async function load({ parent }) {
	const { ds } = await parent();
	const [allTablets, allPens, tabletFamilies] = await Promise.all([
		ds.Tablets.toArray(),
		ds.Pens.toArray(),
		ds.TabletFamilies.toArray(),
	]);
	return { allTablets, allPens, tabletFamilies };
}
