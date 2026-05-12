import type { TabletFamily } from '$data/lib/entities/tablet-family-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [families, tablets] = await Promise.all([
		ds.TabletFamilies.toArray() as Promise<TabletFamily[]>,
		ds.Tablets.toArray(),
	]);

	// Build lookup: EntityId → { count, earliestYear }
	const familyStats = new Map<string, { count: number; earliestYear: number }>();
	for (const t of tablets) {
		const fid = t.Model.Family;
		if (!fid) continue;
		const year = parseInt(t.Model.LaunchYear ?? '');
		const existing = familyStats.get(fid);
		if (!existing) {
			familyStats.set(fid, { count: 1, earliestYear: isNaN(year) ? Infinity : year });
		} else {
			existing.count++;
			if (!isNaN(year) && year < existing.earliestYear) existing.earliestYear = year;
		}
	}

	const data = families.map((f) => {
		const stats = familyStats.get(f.EntityId);
		return {
			...f,
			_tabletCount: stats?.count ?? 0,
			_earliestYear: stats && stats.earliestYear !== Infinity ? String(stats.earliestYear) : '',
		};
	});

	return { data };
}
