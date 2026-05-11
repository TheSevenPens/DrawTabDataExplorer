import { base } from '$app/paths';
import { DrawTabDataSet } from '$data/lib/dataset.js';

export const prerender = false;

export async function load() {
	const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base });
	const [allTablets, allPens] = await Promise.all([ds.Tablets.toArray(), ds.Pens.toArray()]);
	return { allTablets, allPens };
}
