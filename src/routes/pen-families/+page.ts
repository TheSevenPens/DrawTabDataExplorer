import {
	setPenFamilyMemberCounts,
	setPenFamilyInventoryCounts,
} from '$data/lib/entities/pen-family-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [families, pens, invPens] = await Promise.all([
		ds.PenFamilies.toArray(),
		ds.Pens.toArray(),
		ds.InventoryPens.toArray(),
	]);

	// Pen-model count per family.
	const counts: Record<string, number> = {};
	const familyByPenEntityId = new Map<string, string>();
	for (const p of pens) {
		if (p.PenFamily) {
			counts[p.PenFamily] = (counts[p.PenFamily] ?? 0) + 1;
			familyByPenEntityId.set(p.EntityId, p.PenFamily);
		}
	}
	setPenFamilyMemberCounts(counts);

	// Physical inventory pen units per family (unit → its pen's PenFamily).
	const invCounts: Record<string, number> = {};
	for (const inv of invPens) {
		const fid = familyByPenEntityId.get(inv.PenEntityId);
		if (!fid) continue;
		invCounts[fid] = (invCounts[fid] ?? 0) + 1;
	}
	setPenFamilyInventoryCounts(invCounts);

	return { families };
}
