// The EntityId -> FamilyName lookup that drives PEN_FIELDS' Family column
// is wired in +layout.ts now, so this loader only needs to fetch pens
// plus the family map the page consumes for its cellLinks builder.
export async function load({ parent }) {
	const { ds } = await parent();
	const [pens, families] = await Promise.all([ds.Pens.toArray(), ds.PenFamilies.toArray()]);
	const familyNames: Record<string, string> = {};
	for (const f of families) familyNames[f.EntityId] = f.FamilyName;
	return { pens, familyNames };
}
