import { base } from '$app/paths';
import { loadTabletsFromURL } from '$data/lib/drawtab-loader.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';

export async function load() {
	const allTablets = await loadTabletsFromURL(base) as Tablet[];
	return { allTablets };
}
