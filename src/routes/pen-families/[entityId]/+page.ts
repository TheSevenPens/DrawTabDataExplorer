import { base } from '$app/paths';
import { loadPenFamiliesFromURL, loadPensFromURL } from '$data/lib/drawtab-loader.js';
import type { Pen } from '$data/lib/drawtab-loader.js';
import { type PenFamily } from '$data/lib/entities/pen-family-fields.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const entityId = decodeURIComponent(params.entityId);
	const [families, pens] = await Promise.all([
		loadPenFamiliesFromURL(base) as Promise<PenFamily[]>,
		loadPensFromURL(base) as Promise<Pen[]>,
	]);
	const family = families.find((f) => f.EntityId === entityId);
	if (!family) error(404, 'Pen family not found');
	const memberPens = pens
		.filter((p) => p.PenFamily === family.FamilyId)
		.sort((a, b) => a.PenId.localeCompare(b.PenId));
	return { family, memberPens };
}
