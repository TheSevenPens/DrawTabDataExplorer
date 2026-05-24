export const prerender = false;

export async function load({ parent }) {
	const { ds } = await parent();
	const allPens = await ds.Pens.toArray();
	return { allPens };
}
