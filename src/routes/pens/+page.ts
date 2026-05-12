import { setPenFamilyNames } from '$data/lib/entities/pen-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [pens, families] = await Promise.all([ds.Pens.toArray(), ds.PenFamilies.toArray()]);
	const familyNames: Record<string, string> = {};
	for (const f of families) familyNames[f.EntityId] = f.FamilyName;
	setPenFamilyNames(familyNames);
	return { pens, familyNames };
}
