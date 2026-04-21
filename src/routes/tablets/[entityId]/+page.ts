// Redirect to the canonical entity URL.
export const prerender = false;

import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export function load({ params }: { params: { entityId: string } }) {
	throw redirect(307, `${base}/entity/${params.entityId}`);
}
