import type { Tablet, WacomUpdateProduct } from '$data/lib/drawtab-loader.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [products, tablets] = await Promise.all([
		ds.getWacomUpdateProducts(),
		ds.Tablets.toArray(),
	]);
	// Manifest model strings are dashless and uppercase (e.g. "DTH1152");
	// our Model.Id values use dashes (e.g. "DTH-1152"). Normalize to a
	// dashless uppercase key so the join lights up.
	const norm = (s: string) => s.replace(/-/g, '').toUpperCase();
	const modelToTablet = new Map<string, Tablet>();
	const sensorIdToTablet = new Map<string, Tablet>();
	for (const t of tablets) {
		if (t.Model.Brand !== 'WACOM') continue;
		if (t.Model.Id) modelToTablet.set(norm(t.Model.Id), t);
		if (t.Model.SensorId) sensorIdToTablet.set(t.Model.SensorId, t);
	}
	return {
		products: products as WacomUpdateProduct[],
		modelToTablet,
		sensorIdToTablet,
	};
}
