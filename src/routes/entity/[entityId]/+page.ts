// Agent note: canonical /entity/[entityId] loader — prerender false. No onMount data fetch.
// Universal entity detail loader.
// Parses the EntityId, determines the entity type from the second dot-segment,
// and fetches the appropriate data via DrawTabDataSet. The page component
// renders the right detail view based on `entityType` — no redirect, URL
// stays at /entity/[entityId].
export const prerender = false;

import { error } from '@sveltejs/kit';
import { sessionEntityId } from '$data/lib/pressure/session-id.js';
import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
import { buildTabletNameMap } from '$lib/tablet-helpers.js';

/** Count assigned (non-UNASSIGNED) inventory records per entity id, so the
 * compat tables can show "how many of this model you own". */
function countByEntity<T extends { InventoryId?: string }>(
	records: readonly T[],
	getId: (r: T) => string | undefined,
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const r of records) {
		if (r.InventoryId === 'UNASSIGNED') continue;
		const id = getId(r);
		if (!id) continue;
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return counts;
}

export async function load({ params, parent }) {
	const entityId = decodeURIComponent(params.entityId);
	const parts = entityId.split('.');
	const entityType = parts.length === 1 ? 'brand' : parts[1];

	const { ds } = await parent();

	switch (entityType) {
		case 'tablet': {
			const tablet = await ds.Tablets.find((t) => t.Meta.EntityId === entityId);
			if (!tablet) error(404, 'Tablet not found');
			const [
				allTablets,
				allPens,
				compatiblePens,
				family,
				isoSizes,
				allInventoryTablets,
				allInventoryPens,
			] = await Promise.all([
				ds.Tablets.toArray(),
				ds.Pens.toArray(),
				tablet.getCompatiblePens(),
				tablet.getFamily(),
				ds.getISOPaperSizes(),
				ds.InventoryTablets.toArray(),
				ds.InventoryPens.toArray(),
			]);
			const inventoryUnits = allInventoryTablets.filter((u) => u.TabletEntityId === entityId);
			// How many of each compatible pen model are in the inventory.
			const inventoryPenCounts = countByEntity(allInventoryPens, (p) => p.PenEntityId);
			return {
				entityType,
				tablet,
				allTablets,
				allPens,
				compatiblePens,
				isoSizes,
				family,
				inventoryUnits,
				inventoryPenCounts,
			};
		}

		case 'pen': {
			const pen = await ds.Pens.find((p) => p.EntityId === entityId);
			if (!pen) error(404, 'Pen not found');
			const [
				compatibleTablets,
				allTablets,
				allPressure,
				allInventory,
				allRange,
				allInventoryTablets,
			] = await Promise.all([
				pen.getCompatibleTablets(),
				ds.Tablets.toArray(),
				ds.PressureResponse.toArray(),
				ds.InventoryPens.toArray(),
				ds.PressureRange.toArray(),
				ds.InventoryTablets.toArray(),
			]);
			const includedWithTablets = allTablets.filter((t) =>
				(t.Model.IncludedPen ?? []).some((p) => p === entityId),
			);
			const pressureSessions = allPressure.filter((s) => s.PenEntityId === entityId);
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			const inventoryUnits = allInventory.filter((u) => u.PenEntityId === entityId);
			const iafMeasurements = allRange.filter(
				(m) => m.Metric === 'IAF' && m.PenEntityId === entityId,
			);
			const maxMeasurements = allRange.filter(
				(m) => m.Metric === 'MAX' && m.PenEntityId === entityId,
			);
			// How many of each compatible tablet model are in the inventory.
			const inventoryTabletCounts = countByEntity(allInventoryTablets, (t) => t.TabletEntityId);
			return {
				entityType,
				pen,
				compatibleTablets,
				includedWithTablets,
				allTablets,
				pressureSessions,
				defectsByInventoryId,
				inventoryUnits,
				iafMeasurements,
				maxMeasurements,
				inventoryTabletCounts,
			};
		}

		case 'driver': {
			const driver = await ds.Drivers.find((d) => d.EntityId === entityId);
			if (!driver) error(404, 'Driver not found');
			return { entityType, driver };
		}

		case 'penfamily': {
			const family = await ds.PenFamilies.find((f) => f.EntityId === entityId);
			if (!family) error(404, 'Pen family not found');
			const [memberPensUnsorted, allTablets, allPressure, allInventory, allRange] =
				await Promise.all([
					family.getPens(),
					ds.Tablets.toArray(),
					ds.PressureResponse.toArray(),
					ds.InventoryPens.toArray(),
					ds.PressureRange.toArray(),
				]);
			const memberPens = [...memberPensUnsorted].sort((a, b) => a.PenId.localeCompare(b.PenId));
			const memberPenIds = new Set(memberPens.map((p) => p.EntityId));
			const pressureSessions = allPressure.filter((s) => memberPenIds.has(s.PenEntityId));
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			const iafMeasurements = allRange.filter(
				(m) => m.Metric === 'IAF' && memberPenIds.has(m.PenEntityId),
			);
			const maxMeasurements = allRange.filter(
				(m) => m.Metric === 'MAX' && memberPenIds.has(m.PenEntityId),
			);
			return {
				entityType,
				family,
				memberPens,
				pressureSessions,
				defectsByInventoryId,
				iafMeasurements,
				maxMeasurements,
				tabletNameById: buildTabletNameMap(allTablets),
			};
		}

		case 'tabletfamily': {
			const family = await ds.TabletFamilies.find((f) => f.EntityId === entityId);
			if (!family) error(404, 'Tablet family not found');
			const [familyTablets, allTablets, isoSizes] = await Promise.all([
				family.getTablets(),
				ds.Tablets.toArray(),
				ds.getISOPaperSizes(),
			]);
			return { entityType, family, familyTablets, allTablets, isoSizes };
		}

		case 'session': {
			const session = await ds.PressureResponse.find((s) => sessionEntityId(s) === entityId);
			if (!session) error(404, 'Pressure-response session not found');
			const [pen, tablet, allInventory] = await Promise.all([
				session.getPen(),
				session.getTablet(),
				ds.InventoryPens.toArray(),
			]);
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			const defectInfo = defectsByInventoryId.get(session.InventoryId) ?? null;
			return { entityType, session, pen, tablet, defectInfo };
		}

		case 'brand': {
			const brand = await ds.Brands.find((b) => b.EntityId === entityId);
			if (!brand) error(404, 'Brand not found');
			const [tablets, pens] = await Promise.all([brand.getTablets(), brand.getPens()]);
			return { entityType, brand, tablets, pens };
		}

		default:
			error(404, `Unknown entity type: ${entityType}`);
	}
}
