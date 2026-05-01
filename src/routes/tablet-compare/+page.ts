import { base } from '$app/paths';
import { loadTabletsFromURL, loadPensFromURL } from '$data/lib/drawtab-loader.js';
import type { Tablet, Pen } from '$data/lib/drawtab-loader.js';

export const prerender = false;

export async function load() {
	const [allTablets, allPens] = await Promise.all([
		loadTabletsFromURL(base) as Promise<Tablet[]>,
		loadPensFromURL(base) as Promise<Pen[]>,
	]);
	return { allTablets, allPens };
}
