// Shared helper for the typed-entity redirect routes. The canonical
// detail URL is /entity/[entityId]; the typed routes (/tablets/[id],
// /pens/[id], etc.) are thin redirects so old links keep working.

import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export function redirectToCanonicalEntity(params: { entityId: string }): never {
	throw redirect(307, `${base}/entity/${params.entityId}`);
}
