// /compare has no page of its own: it opens the tablets comparison (#373).
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const prerender = true;

export function load() {
	throw redirect(307, `${base}/compare/tablets`);
}
