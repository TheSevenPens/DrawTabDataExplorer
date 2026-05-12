export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, pens] = await Promise.all([ds.Tablets.toArray(), ds.Pens.toArray()]);
	return { tablets, pens };
}
