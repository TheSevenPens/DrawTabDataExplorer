import { setPenFamilyMemberCounts } from '$data/lib/entities/pen-family-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [families, pens] = await Promise.all([ds.PenFamilies.toArray(), ds.Pens.toArray()]);
	const counts: Record<string, number> = {};
	for (const p of pens) {
		if (p.PenFamily) counts[p.PenFamily] = (counts[p.PenFamily] ?? 0) + 1;
	}
	setPenFamilyMemberCounts(counts);
	return { families };
}
