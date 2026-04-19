import { base } from '$app/paths';
import { loadTabletsFromURL, loadPenCompatFromURL, loadPensFromURL, loadISOPaperSizesFromURL } from '$data/lib/drawtab-loader.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { type Pen } from '$data/lib/entities/pen-fields.js';
import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const entityId = decodeURIComponent(params.entityId);
	const [allTablets, allCompat, allPens, isoSizes] = await Promise.all([
		loadTabletsFromURL(base) as Promise<Tablet[]>,
		loadPenCompatFromURL(base) as Promise<PenCompat[]>,
		loadPensFromURL(base) as Promise<Pen[]>,
		loadISOPaperSizesFromURL(base),
	]);

	const tablet = allTablets.find((t) => t.Meta.EntityId === entityId);
	if (!tablet) error(404, 'Tablet not found');

	const compatPenIds = new Set(
		allCompat.filter((c) => c.TabletId === tablet.Model.Id).map((c) => c.PenId)
	);
	const compatiblePens = allPens.filter((p) => compatPenIds.has(p.PenId));

	return { tablet, allTablets, allPens, compatiblePens, isoSizes };
}
