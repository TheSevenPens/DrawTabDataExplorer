import { base } from '$app/paths';
import { DrawTabDataSet } from '$data/lib/dataset.js';
import type { VersionInfo } from '$data/lib/drawtab-loader.js';

export const prerender = true;
export const ssr = false;

// One DataSet instance is constructed here and propagated to every child
// `+page.ts` via `await parent()`. Two wins over per-page instantiation:
// the per-collection load cache is now session-scoped (navigating between
// pages reuses fetched data), and userId / baseUrl are declared in one
// place instead of being repeated by every list page.
export async function load(): Promise<{ ds: DrawTabDataSet; version: VersionInfo | null }> {
	const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base, userId: 'sevenpens' });
	const version = await ds.getVersion();
	return { ds, version };
}
