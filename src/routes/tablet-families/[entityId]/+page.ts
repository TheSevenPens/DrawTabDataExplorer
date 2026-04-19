import { base } from '$app/paths';
import { loadTabletFamiliesFromURL, loadTabletsFromURL } from '$data/lib/drawtab-loader.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { type TabletFamily } from '$data/lib/entities/tablet-family-fields.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const entityId = decodeURIComponent(params.entityId);
	const [families, allTablets] = await Promise.all([
		loadTabletFamiliesFromURL(base) as Promise<TabletFamily[]>,
		loadTabletsFromURL(base) as Promise<Tablet[]>,
	]);
	const family = families.find((f) => f.EntityId === entityId);
	if (!family) error(404, 'Tablet family not found');
	const familyTablets = allTablets.filter((t) => t.Model.Family === family.FamilyId);
	return { family, familyTablets, allTablets };
}
