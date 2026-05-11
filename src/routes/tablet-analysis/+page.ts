import { base } from '$app/paths';
import { loadISOPaperSizesFromURL, loadUSPaperSizesFromURL } from '$data/lib/drawtab-loader.js';
import { DrawTabDataSet } from '$data/lib/dataset.js';

export async function load() {
	const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base });
	const [allTablets, isoPaperSizes, usPaperSizes] = await Promise.all([
		ds.Tablets.toArray(),
		loadISOPaperSizesFromURL(base),
		loadUSPaperSizesFromURL(base),
	]);
	return { allTablets, isoPaperSizes, usPaperSizes };
}
