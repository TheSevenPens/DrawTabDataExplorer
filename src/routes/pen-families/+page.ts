import {
	setPenFamilyMemberCounts,
	setPenFamilyInventoryCounts,
	setPenFamilyModelIds,
} from '$data/lib/entities/pen-family-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [families, pens, invPens] = await Promise.all([
		ds.PenFamilies.toArray(),
		ds.Pens.toArray(),
		ds.InventoryPens.toArray(),
	]);

	// Pen-model count + model-id list per family.
	const counts: Record<string, number> = {};
	const familyByPenEntityId = new Map<string, string>();
	const modelIdLists: Record<string, string[]> = {};
	for (const p of pens) {
		if (p.PenFamily) {
			counts[p.PenFamily] = (counts[p.PenFamily] ?? 0) + 1;
			familyByPenEntityId.set(p.EntityId, p.PenFamily);
			(modelIdLists[p.PenFamily] ??= []).push(p.PenId);
		}
	}
	setPenFamilyMemberCounts(counts);

	const modelIds: Record<string, string> = {};
	for (const [fid, ids] of Object.entries(modelIdLists)) {
		modelIds[fid] = [...ids].sort((a, b) => a.localeCompare(b)).join(', ');
	}
	setPenFamilyModelIds(modelIds);

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
