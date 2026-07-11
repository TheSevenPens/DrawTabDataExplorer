export async function load({ parent }) {
	const { ds } = await parent();
	return { ds };
}
