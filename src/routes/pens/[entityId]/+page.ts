import { base } from '$app/paths';
import { loadPensFromURL, loadPenCompatFromURL, loadTabletsFromURL, loadPressureResponseFromURL } from '$data/lib/drawtab-loader.js';
import type { Tablet, PressureResponse } from '$data/lib/drawtab-loader.js';
import { type Pen } from '$data/lib/entities/pen-fields.js';
import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const entityId = decodeURIComponent(params.entityId);
	const [allPens, allCompat, allTablets, allPressure] = await Promise.all([
		loadPensFromURL(base) as Promise<Pen[]>,
		loadPenCompatFromURL(base) as Promise<PenCompat[]>,
		loadTabletsFromURL(base) as Promise<Tablet[]>,
		loadPressureResponseFromURL(base) as Promise<PressureResponse[]>,
	]);

	const pen = allPens.find((p) => p.EntityId === entityId);
	if (!pen) error(404, 'Pen not found');

	const compatTabletIds = new Set(
		allCompat.filter((c) => c.PenId === pen.PenId).map((c) => c.TabletId)
	);
	const compatibleTablets = allTablets.filter((t) => compatTabletIds.has(t.Model.Id));
	const includedWithTablets = allTablets.filter(
		(t) => (t.Model.IncludedPen ?? []).some((p) => p === entityId)
	);
	const pressureSessionCount = allPressure.filter((s) => s.PenEntityId === entityId).length;

	return { pen, compatibleTablets, includedWithTablets, pressureSessionCount };
}
