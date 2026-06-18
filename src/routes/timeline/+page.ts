export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, pens, drivers] = await Promise.all([
		ds.Tablets.toArray(),
		ds.Pens.toArray(),
		ds.Drivers.toArray(),
	]);

	const brands = [
		...new Set([
			...tablets.map((t) => t.Model.Brand),
			...pens.map((p) => p.Brand),
			...drivers.map((d) => d.Brand),
		]),
	].sort();

	// Grouping (by year, or by year-month using ReleaseDate) depends on a user
	// toggle, so it lives in +page.svelte. The loader just hands over the raw
	// entities plus the year range used to seed the From/To inputs.
	// Number("") is 0, not NaN, so guard against blank years collapsing the
	// range — only count plausible 4-digit years. Drivers contribute their
	// ReleaseDate year.
	const years = [
		...tablets.map((t) => Number(t.Model.LaunchYear)),
		...pens.map((p) => Number(p.PenYear)),
		...drivers.map((d) => Number((d.ReleaseDate ?? '').slice(0, 4))),
	].filter((y) => !isNaN(y) && y >= 1900 && y <= 2200);
	const minYear = Math.min(...years);
	const maxYear = Math.max(...years);

	return {
		tablets,
		pens,
		drivers,
		brands,
		minYear,
		maxYear,
		yearFrom: String(minYear),
		yearTo: String(maxYear),
	};
}
