// Dev tool — not prerendered, not linked from Nav. Loads sessions + pens
// for the /pressure-backfill route that lets the user tune (force, 0) and
// (force, 100) endpoint records for sessions that don't capture them.
export const prerender = false;

export async function load({ parent }) {
	const { ds } = await parent();
	const [sessions, pens] = await Promise.all([ds.PressureResponse.toArray(), ds.Pens.toArray()]);
	return { sessions, pens };
}
