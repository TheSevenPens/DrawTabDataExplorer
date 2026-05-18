// Redirect to the canonical entity URL.
import { redirectToCanonicalEntity } from '$lib/entity-redirect.js';

export const prerender = false;

export function load({ params }: { params: { entityId: string } }) {
	redirectToCanonicalEntity(params);
}
