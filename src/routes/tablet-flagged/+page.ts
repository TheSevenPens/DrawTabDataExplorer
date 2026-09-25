export const prerender = true;

export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, families] = await Promise.all([
		ds.Tablets.toArray(),
		ds.TabletFamilies.toArray(),
	]);
	return { tablets, families };
}
