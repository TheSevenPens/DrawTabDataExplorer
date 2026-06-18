export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, pens] = await Promise.all([ds.Tablets.toArray(), ds.Pens.toArray()]);

	const brands = [
		...new Set([...tablets.map((t) => t.Model.Brand), ...pens.map((p) => p.Brand)]),
	].sort();

	// Grouping (by year, or by year-month using tablet ReleaseDate) depends on a
	// user toggle, so it lives in +page.svelte. The loader just hands over the
	// raw entities plus the year range used to seed the From/To inputs.
	// Number("") is 0, not NaN, so guard against blank years collapsing the
	// range — only count plausible 4-digit years.
	const years = [
		...tablets.map((t) => Number(t.Model.LaunchYear)),
		...pens.map((p) => Number(p.PenYear)),
	].filter((y) => !isNaN(y) && y >= 1900 && y <= 2200);
	const minYear = Math.min(...years);
	const maxYear = Math.max(...years);

	return {
		tablets,
		pens,
		brands,
		minYear,
		maxYear,
		yearFrom: String(minYear),
		yearTo: String(maxYear),
	};
}
