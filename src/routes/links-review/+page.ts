// Review page for links extracted from DrawingTabletDocs (see +page.svelte).
// Read-only until you export the curated set; nothing writes to entity data.
import { tabletFullName } from '$lib/tablet-helpers.js';
import { penFullName } from '$lib/pen-helpers.js';

export const prerender = true;

export async function load({ parent }) {
	const { ds } = await parent();
	const [docLinks, tablets, pens] = await Promise.all([
		ds.getDocLinks(),
		ds.Tablets.toArray(),
		ds.Pens.toArray(),
	]);
	const nameById = new Map<string, string>();
	for (const t of tablets) nameById.set(t.Meta.EntityId, tabletFullName(t));
	for (const p of pens) nameById.set(p.EntityId, penFullName(p));

	const links = docLinks.map((l) => ({ ...l, entityName: nameById.get(l.entityId) ?? l.entityId }));
	return { links };
}
