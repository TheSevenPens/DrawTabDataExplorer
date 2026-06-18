import {
	brandName,
	type Tablet,
	type Pen,
	type WacomUpdateProduct,
} from '$data/lib/drawtab-loader.js';
import { tabletFullName as fmtTabletFullName } from '$lib/tablet-helpers.js';
import { penFullName } from '$lib/pen-helpers.js';
import type { EnrichedPenCompat } from '$data/lib/entities/pen-compat-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [paperSizes, usPaperSizes, allTablets, penCompatRaw, pens, wacomProducts, brands] =
		await Promise.all([
			ds.getISOPaperSizes(),
			ds.getUSPaperSizes(),
			ds.Tablets.toArray(),
			ds.PenCompat.toArray(),
			ds.Pens.toArray(),
			ds.getWacomUpdateProducts(),
			ds.Brands.toArray(),
		]);

	// --- Pen Compatibility section: enrich each compat row with display names ---
	const tabletById = new Map<string, Tablet>();
	for (const t of allTablets) tabletById.set(t.Model.Id, t);
	const penById = new Map<string, Pen>();
	for (const p of pens) penById.set(p.PenId, p);
	const penCompat: EnrichedPenCompat[] = penCompatRaw.map((c) => {
		const tablet = tabletById.get(c.TabletId);
		const pen = penById.get(c.PenId);
		// Fallbacks only fire for orphaned compat rows (referenced entity gone);
		// cross-entity data-quality checks surface those.
		return {
			...c,
			TabletFullName: tablet ? fmtTabletFullName(tablet) : `${brandName(c.Brand)} ${c.TabletId}`,
			PenFullName: pen ? penFullName(pen) : `${brandName(c.Brand)} ${c.PenId}`,
		};
	});

	// --- Driver Compatibility section: join Wacom update.xml products to tablets ---
	// Manifest model strings are dashless/uppercase (e.g. "DTH1152"); our
	// Model.Id uses dashes (e.g. "DTH-1152"). Normalize to a dashless key.
	const norm = (s: string) => s.replace(/-/g, '').toUpperCase();
	const modelToTablet = new Map<string, Tablet>();
	const sensorIdToTablet = new Map<string, Tablet>();
	for (const t of allTablets) {
		if (t.Model.Brand !== 'WACOM') continue;
		if (t.Model.Id) modelToTablet.set(norm(t.Model.Id), t);
		if (t.Model.SensorId) sensorIdToTablet.set(t.Model.SensorId, t);
	}

	return {
		paperSizes,
		usPaperSizes,
		allTablets,
		brands,
		penCompat,
		wacomProducts: wacomProducts as WacomUpdateProduct[],
		modelToTablet,
		sensorIdToTablet,
	};
}
