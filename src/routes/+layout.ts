import { base } from '$app/paths';
import { loadVersionFromURL } from '$data/lib/drawtab-loader.js';
import type { VersionInfo } from '$data/lib/drawtab-loader.js';

export const prerender = true;
export const ssr = false;

export async function load(): Promise<{ version: VersionInfo | null }> {
	const version = await loadVersionFromURL(base);
	return { version };
}
