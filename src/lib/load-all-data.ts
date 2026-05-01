/**
 * Shared data-loading helpers.
 *
 * All loaders are called in parallel with Promise.all so adding a new dataset
 * here doesn't slow down any existing consumer.
 */
import {
	loadTabletsFromURL,
	loadPensFromURL,
	loadPenCompatFromURL,
	loadDriversFromURL,
	loadBrandsFromURL,
	loadPenFamiliesFromURL,
	loadTabletFamiliesFromURL,
	loadISOPaperSizesFromURL,
	loadPressureResponseFromURL,
	type Tablet,
	type Pen,
	type Brand,
} from '$data/lib/drawtab-loader.js';
import type { PenFamily, TabletFamily, Driver } from '$data/lib/drawtab-loader.js';
import type { PenCompat } from '$data/lib/entities/pen-compat-fields.js';
import type { PressureResponse } from '$data/lib/drawtab-loader.js';

export interface AllData {
	tablets: Tablet[];
	pens: Pen[];
	penCompat: PenCompat[];
	drivers: Driver[];
	brands: Brand[];
	penFamilies: PenFamily[];
	tabletFamilies: TabletFamily[];
	isoSizes: Awaited<ReturnType<typeof loadISOPaperSizesFromURL>>;
	pressureResponse: PressureResponse[];
}

/** Load every dataset in parallel. Callers can destructure only what they need. */
export async function loadAllData(base: string): Promise<AllData> {
	const [
		tablets,
		pens,
		penCompat,
		drivers,
		brands,
		penFamilies,
		tabletFamilies,
		isoSizes,
		pressureResponse,
	] = await Promise.all([
		loadTabletsFromURL(base) as Promise<Tablet[]>,
		loadPensFromURL(base) as Promise<Pen[]>,
		loadPenCompatFromURL(base) as Promise<PenCompat[]>,
		loadDriversFromURL(base) as Promise<Driver[]>,
		loadBrandsFromURL(base) as Promise<Brand[]>,
		loadPenFamiliesFromURL(base) as Promise<PenFamily[]>,
		loadTabletFamiliesFromURL(base) as Promise<TabletFamily[]>,
		loadISOPaperSizesFromURL(base),
		loadPressureResponseFromURL(base) as Promise<PressureResponse[]>,
	]);
	return {
		tablets,
		pens,
		penCompat,
		drivers,
		brands,
		penFamilies,
		tabletFamilies,
		isoSizes,
		pressureResponse,
	};
}
