export async function load({ parent }) {
	const { ds } = await parent();
	const drivers = await ds.Drivers.toArray();
	return { drivers };
}
