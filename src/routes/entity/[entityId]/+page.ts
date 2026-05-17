// Universal entity detail loader.
// Parses the EntityId, determines the entity type from the second dot-segment,
// and fetches the appropriate data via DrawTabDataSet. The page component
// renders the right detail view based on `entityType` — no redirect, URL
// stays at /entity/[entityId].
export const prerender = false;

import { error } from '@sveltejs/kit';
import { sessionEntityId } from '$data/lib/pressure/session-id.js';
import { buildInventoryDefects } from '$data/lib/pressure/defects.js';

export async function load({ params, parent }) {
	const entityId = decodeURIComponent(params.entityId);
	const parts = entityId.split('.');
	const entityType = parts.length === 1 ? 'brand' : parts[1];

	const { ds } = await parent();

	switch (entityType) {
		case 'tablet': {
			const tablet = await ds.Tablets.find((t) => t.Meta.EntityId === entityId);
			if (!tablet) error(404, 'Tablet not found');
			const [allTablets, allPens, compatiblePens, family, isoSizes, allInventoryTablets] =
				await Promise.all([
					ds.Tablets.toArray(),
					ds.Pens.toArray(),
					tablet.getCompatiblePens(),
					tablet.getFamily(),
					ds.getISOPaperSizes(),
					ds.InventoryTablets.toArray(),
				]);
			const inventoryUnits = allInventoryTablets.filter((u) => u.TabletEntityId === entityId);
			return {
				entityType,
				tablet,
				allTablets,
				allPens,
				compatiblePens,
				isoSizes,
				family,
				inventoryUnits,
			};
		}

		case 'pen': {
			const pen = await ds.Pens.find((p) => p.EntityId === entityId);
			if (!pen) error(404, 'Pen not found');
			const [compatibleTablets, allTablets, allPressure, allInventory] = await Promise.all([
				pen.getCompatibleTablets(),
				ds.Tablets.toArray(),
				ds.PressureResponse.toArray(),
				ds.InventoryPens.toArray(),
			]);
			const includedWithTablets = allTablets.filter((t) =>
				(t.Model.IncludedPen ?? []).some((p) => p === entityId),
			);
			const pressureSessions = allPressure.filter((s) => s.PenEntityId === entityId);
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			const inventoryUnits = allInventory.filter((u) => u.PenEntityId === entityId);
			return {
				entityType,
				pen,
				compatibleTablets,
				includedWithTablets,
				pressureSessions,
				defectsByInventoryId,
				inventoryUnits,
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
			const [memberPensUnsorted, allPressure, allInventory] = await Promise.all([
				family.getPens(),
				ds.PressureResponse.toArray(),
				ds.InventoryPens.toArray(),
			]);
			const memberPens = [...memberPensUnsorted].sort((a, b) => a.PenId.localeCompare(b.PenId));
			const memberPenIds = new Set(memberPens.map((p) => p.EntityId));
			const pressureSessions = allPressure.filter((s) => memberPenIds.has(s.PenEntityId));
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			return { entityType, family, memberPens, pressureSessions, defectsByInventoryId };
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
			const [pen, allInventory] = await Promise.all([session.getPen(), ds.InventoryPens.toArray()]);
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			const defectInfo = defectsByInventoryId.get(session.InventoryId) ?? null;
			return { entityType, session, pen, defectInfo };
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
