import { brandName, type Tablet, type Pen } from '$data/lib/drawtab-loader.js';
import { tabletFullName as fmtTabletFullName } from '$lib/tablet-helpers.js';
import { penFullName } from '$lib/pen-helpers.js';
import type { EnrichedPenCompat } from '$data/lib/entities/pen-compat-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [compat, tablets, pens] = await Promise.all([
		ds.PenCompat.toArray(),
		ds.Tablets.toArray(),
		ds.Pens.toArray(),
	]);

	const tabletMap = new Map<string, Tablet>();
	for (const t of tablets) tabletMap.set(t.Model.Id, t);

	const penMap = new Map<string, Pen>();
	for (const p of pens) penMap.set(p.PenId, p);

	const data: EnrichedPenCompat[] = compat.map((c) => {
		const tablet = tabletMap.get(c.TabletId);
		const pen = penMap.get(c.PenId);
		return {
			...c,
			TabletFullName: tablet ? fmtTabletFullName(tablet) : `${brandName(c.Brand)} ${c.TabletId}`,
			PenFullName: pen ? penFullName(pen) : `${brandName(c.Brand)} ${c.PenId}`,
		};
	});

	return { data };
}
