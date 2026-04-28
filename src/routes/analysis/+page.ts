import { base } from '$app/paths';
import {
	loadTabletsFromURL,
	loadISOPaperSizesFromURL,
	loadUSPaperSizesFromURL,
} from '$data/lib/drawtab-loader.js';
import type { Tablet, ISOPaperSize, USPaperSize } from '$data/lib/drawtab-loader.js';

export async function load() {
	const [allTablets, isoPaperSizes, usPaperSizes] = await Promise.all([
		loadTabletsFromURL(base) as Promise<Tablet[]>,
		loadISOPaperSizesFromURL(base),
		loadUSPaperSizesFromURL(base),
	]);
	return { allTablets, isoPaperSizes, usPaperSizes };
}
