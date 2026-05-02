// Universal entity detail loader.
// Parses the EntityId, determines the entity type from the second dot-segment,
// and fetches the appropriate data. The page component renders the right detail
// view based on `entityType` — no redirect, URL stays at /entity/[entityId].
export const prerender = false;

import { base } from '$app/paths';
import { error } from '@sveltejs/kit';
import {
	loadTabletsFromURL,
	loadPenCompatFromURL,
	loadPensFromURL,
	loadISOPaperSizesFromURL,
	loadBrandsFromURL,
	loadDriversFromURL,
	loadPenFamiliesFromURL,
	loadTabletFamiliesFromURL,
	loadPressureResponseFromURL,
	loadInventoryPensFromURL,
} from '$data/lib/drawtab-loader.js';
import type { Tablet, Brand, Pen, PressureResponse } from '$data/lib/drawtab-loader.js';
import type { InventoryPen } from '$data/lib/schemas.js';
import { type PenFamily } from '$data/lib/entities/pen-family-fields.js';
import { type TabletFamily } from '$data/lib/entities/tablet-family-fields.js';
import { type Driver } from '$data/lib/entities/driver-fields.js';
import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
import { sessionEntityId } from '$data/lib/pressure/session-id.js';
import { buildInventoryDefects } from '$data/lib/pressure/defects.js';

export async function load({ params }) {
	const entityId = decodeURIComponent(params.entityId);
	const parts = entityId.split('.');
	const entityType = parts.length === 1 ? 'brand' : parts[1];

	switch (entityType) {
		case 'tablet': {
			const [allTablets, allCompat, allPens, isoSizes] = await Promise.all([
				loadTabletsFromURL(base) as Promise<Tablet[]>,
				loadPenCompatFromURL(base) as Promise<PenCompat[]>,
				loadPensFromURL(base) as Promise<Pen[]>,
				loadISOPaperSizesFromURL(base),
			]);
			const tablet = allTablets.find((t) => t.Meta.EntityId === entityId);
			if (!tablet) error(404, 'Tablet not found');
			const compatPenIds = new Set(
				allCompat.filter((c) => c.TabletId === tablet.Model.Id).map((c) => c.PenId),
			);
			const compatiblePens = allPens.filter((p) => compatPenIds.has(p.PenId));
			return { entityType, tablet, allTablets, allPens, compatiblePens, isoSizes };
		}

		case 'pen': {
			const [allPens, allCompat, allTablets, allPressure, allInventory] = await Promise.all([
				loadPensFromURL(base) as Promise<Pen[]>,
				loadPenCompatFromURL(base) as Promise<PenCompat[]>,
				loadTabletsFromURL(base) as Promise<Tablet[]>,
				loadPressureResponseFromURL(base) as Promise<PressureResponse[]>,
				loadInventoryPensFromURL(base, 'sevenpens') as Promise<InventoryPen[]>,
			]);
			const pen = allPens.find((p) => p.EntityId === entityId);
			if (!pen) error(404, 'Pen not found');
			const compatTabletIds = new Set(
				allCompat.filter((c) => c.PenId === pen.PenId).map((c) => c.TabletId),
			);
			const compatibleTablets = allTablets.filter((t) => compatTabletIds.has(t.Model.Id));
			const includedWithTablets = allTablets.filter((t) =>
				(t.Model.IncludedPen ?? []).some((p) => p === entityId),
			);
			const pressureSessions = allPressure.filter((s) => s.PenEntityId === entityId);
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			return {
				entityType,
				pen,
				compatibleTablets,
				includedWithTablets,
				pressureSessions,
				defectsByInventoryId,
			};
		}

		case 'driver': {
			const all = (await loadDriversFromURL(base)) as Driver[];
			const driver = all.find((d) => d.EntityId === entityId);
			if (!driver) error(404, 'Driver not found');
			return { entityType, driver };
		}

		case 'penfamily': {
			const [families, pens, allPressure, allInventory] = await Promise.all([
				loadPenFamiliesFromURL(base) as Promise<PenFamily[]>,
				loadPensFromURL(base) as Promise<Pen[]>,
				loadPressureResponseFromURL(base) as Promise<PressureResponse[]>,
				loadInventoryPensFromURL(base, 'sevenpens') as Promise<InventoryPen[]>,
			]);
			const family = families.find((f) => f.EntityId === entityId);
			if (!family) error(404, 'Pen family not found');
			const memberPens = pens
				.filter((p) => p.PenFamily === family.EntityId)
				.sort((a, b) => a.PenId.localeCompare(b.PenId));
			const memberPenIds = new Set(memberPens.map((p) => p.EntityId));
			const pressureSessions = allPressure.filter((s) => memberPenIds.has(s.PenEntityId));
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			return { entityType, family, memberPens, pressureSessions, defectsByInventoryId };
		}

		case 'tabletfamily': {
			const [families, allTablets, isoSizes] = await Promise.all([
				loadTabletFamiliesFromURL(base) as Promise<TabletFamily[]>,
				loadTabletsFromURL(base) as Promise<Tablet[]>,
				loadISOPaperSizesFromURL(base),
			]);
			const family = families.find((f) => f.EntityId === entityId);
			if (!family) error(404, 'Tablet family not found');
			const familyTablets = allTablets.filter((t) => t.Model.Family === family.EntityId);
			return { entityType, family, familyTablets, allTablets, isoSizes };
		}

		case 'session': {
			const [allPressure, allPens, allInventory] = await Promise.all([
				loadPressureResponseFromURL(base) as Promise<PressureResponse[]>,
				loadPensFromURL(base) as Promise<Pen[]>,
				loadInventoryPensFromURL(base, 'sevenpens') as Promise<InventoryPen[]>,
			]);
			const session = allPressure.find((s) => sessionEntityId(s) === entityId);
			if (!session) error(404, 'Pressure-response session not found');
			const pen = allPens.find((p) => p.EntityId === session.PenEntityId);
			const defectsByInventoryId = buildInventoryDefects(allInventory);
			const defectInfo = defectsByInventoryId.get(session.InventoryId) ?? null;
			return { entityType, session, pen, defectInfo };
		}

		case 'brand': {
			const [allBrands, allTablets, allPens] = await Promise.all([
				loadBrandsFromURL(base) as Promise<Brand[]>,
				loadTabletsFromURL(base),
				loadPensFromURL(base) as Promise<Pen[]>,
			]);
			const brand = allBrands.find((b) => b.EntityId === entityId);
			if (!brand) error(404, 'Brand not found');
			const tablets = allTablets.filter((t) => t.Model.Brand === brand.BrandId);
			const pens = allPens.filter((p) => p.Brand === brand.BrandId);
			return { entityType, brand, tablets, pens };
		}

		default:
			error(404, `Unknown entity type: ${entityType}`);
	}
}
