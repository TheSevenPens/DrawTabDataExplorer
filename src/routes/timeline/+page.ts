import type { Tablet, Pen } from '$data/lib/drawtab-loader.js';

interface YearEntry {
	year: string;
	tablets: Tablet[];
	pens: Pen[];
}

export async function load({ parent }) {
	const { ds } = await parent();
	const [tablets, pens] = await Promise.all([ds.Tablets.toArray(), ds.Pens.toArray()]);

	const brands = [
		...new Set([...tablets.map((t) => t.Model.Brand), ...pens.map((p) => p.Brand)]),
	].sort();

	const yearMap = new Map<string, { tablets: Tablet[]; pens: Pen[] }>();

	for (const t of tablets) {
		if (!t.Model.LaunchYear) continue;
		if (!yearMap.has(t.Model.LaunchYear))
			yearMap.set(t.Model.LaunchYear, { tablets: [], pens: [] });
		yearMap.get(t.Model.LaunchYear)!.tablets.push(t);
	}

	for (const p of pens) {
		if (!p.PenYear) continue;
		if (!yearMap.has(p.PenYear)) yearMap.set(p.PenYear, { tablets: [], pens: [] });
		yearMap.get(p.PenYear)!.pens.push(p);
	}

	const years = [...yearMap.keys()].map(Number).filter((y) => !isNaN(y));
	const allYears = years.sort((a, b) => a - b);

	// Fill in gap years that have no releases.
	if (years.length >= 2) {
		const minYear = Math.min(...years);
		const maxYear = Math.max(...years);
		for (let y = minYear; y <= maxYear; y++) {
			const key = String(y);
			if (!yearMap.has(key)) yearMap.set(key, { tablets: [], pens: [] });
		}
	}

	const timeline: YearEntry[] = [...yearMap.entries()]
		.map(([year, d]) => ({ year, ...d }))
		.sort((a, b) => b.year.localeCompare(a.year));

	return {
		timeline,
		brands,
		allYears,
		yearFrom: String(Math.min(...years)),
		yearTo: String(Math.max(...years)),
	};
}
