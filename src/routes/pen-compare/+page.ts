// The old pen comparison moved to /compare/pens (#373); old links and
// bookmarks land there. Flagged pens stay on /pen-flagged.
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const prerender = true;

export function load() {
	throw redirect(307, `${base}/compare/pens`);
}
