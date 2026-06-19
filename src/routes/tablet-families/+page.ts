import type { TabletFamily } from '$data/lib/entities/tablet-family-fields.js';

export async function load({ parent }) {
	const { ds } = await parent();
	const [families, tablets, invTablets] = await Promise.all([
		ds.TabletFamilies.toArray() as Promise<TabletFamily[]>,
		ds.Tablets.toArray(),
		ds.InventoryTablets.toArray(),
	]);

	// Build lookup: EntityId → { count, earliestYear } and tablet EntityId → Family.
	const familyStats = new Map<string, { count: number; earliestYear: number }>();
	const familyByTabletEntityId = new Map<string, string>();
	for (const t of tablets) {
		if (t.Model.Family) familyByTabletEntityId.set(t.Meta.EntityId, t.Model.Family);
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

	// Count physical inventory tablet units per family (unit → its tablet's Family).
	const inventoryCounts = new Map<string, number>();
	for (const inv of invTablets) {
		const fid = familyByTabletEntityId.get(inv.TabletEntityId);
		if (!fid) continue;
		inventoryCounts.set(fid, (inventoryCounts.get(fid) ?? 0) + 1);
	}

	const data = families.map((f) => {
		const stats = familyStats.get(f.EntityId);
		return {
			...f,
			_tabletCount: stats?.count ?? 0,
			_inventoryCount: inventoryCounts.get(f.EntityId) ?? 0,
			_earliestYear: stats && stats.earliestYear !== Infinity ? String(stats.earliestYear) : '',
		};
	});

	return { data };
}
