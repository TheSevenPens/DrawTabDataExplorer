import { base } from '$app/paths';
import { loadDriversFromURL } from '$data/lib/drawtab-loader.js';
import { type Driver } from '$data/lib/entities/driver-fields.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const entityId = decodeURIComponent(params.entityId);
	const all = (await loadDriversFromURL(base)) as Driver[];
	const driver = all.find((d) => d.EntityId === entityId);
	if (!driver) error(404, 'Driver not found');
	return { driver };
}
