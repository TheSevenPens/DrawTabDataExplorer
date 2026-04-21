import { loadBrandsFromURL, loadTabletsFromURL, loadPensFromURL } from '$data/lib/drawtab-loader.js';
import type { Brand, Tablet, Pen } from '$data/lib/drawtab-loader.js';
import { base } from '$app/paths';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const entityId = decodeURIComponent(params.entityId);
	const [allBrands, allTablets, allPens] = await Promise.all([
		loadBrandsFromURL(base) as Promise<Brand[]>,
		loadTabletsFromURL(base),
		loadPensFromURL(base) as Promise<Pen[]>,
	]);
	const brand = allBrands.find((b) => b.EntityId === entityId);
	if (!brand) {
		error(404, 'Brand not found');
	}
	const tablets = allTablets.filter((t) => t.Model.Brand === brand.BrandId);
	const pens = allPens.filter((p) => p.Brand === brand.BrandId);
	return { brand, tablets, pens };
}
