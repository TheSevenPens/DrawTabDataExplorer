import { base } from '$app/paths';
import { loadTabletsFromURL, loadPensFromURL, loadISOPaperSizesFromURL } from '$data/lib/drawtab-loader.js';
import type { Tablet, Pen, ISOPaperSize } from '$data/lib/drawtab-loader.js';

export const prerender = false;

export async function load() {
	const [allTablets, allPens, isoSizes] = await Promise.all([
		loadTabletsFromURL(base) as Promise<Tablet[]>,
		loadPensFromURL(base) as Promise<Pen[]>,
		loadISOPaperSizesFromURL(base) as Promise<ISOPaperSize[]>,
	]);
	return { allTablets, allPens, isoSizes };
}
