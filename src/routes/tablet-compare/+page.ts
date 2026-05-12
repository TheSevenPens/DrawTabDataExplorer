export const prerender = false;

export async function load({ parent }) {
	const { ds } = await parent();
	const [allTablets, allPens] = await Promise.all([ds.Tablets.toArray(), ds.Pens.toArray()]);
	return { allTablets, allPens };
}
