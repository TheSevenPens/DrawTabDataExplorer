import type {
	Brand,
	Tablet,
	Pen,
	PenCompat,
	PenFamily,
	TabletFamily,
	Driver,
	PressureResponse,
} from '$data/lib/drawtab-loader.js';
import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
import type { InventoryTablet } from '$data/lib/entities/inventory-tablet-fields.js';
import { buildTabletToPenCompatMap, buildPenToTabletCompatMap } from '$data/lib/compat-helpers.js';
import {
	findNonMonotonicSessions,
	findMissingLowEnd,
	findSingleSessionPens,
	findStaleMeasurements,
	findRecommendedForRemeasurement,
} from '$data/lib/pressure/data-quality.js';
import {
	checkRequired,
	checkWhitespace,
	computeCompletion,
	findOrphanedCompat,
	type DataBundle,
	type IncludedPenMissing,
	type Issue,
} from '$lib/data-quality/helpers.js';

// Mirror of the bundle passed into `analyzeData`. Each field is the
// raw collection straight from the loader.
export interface AnalysisInput {
	brands: Brand[];
	tablets: Tablet[];
	pens: Pen[];
	penCompat: PenCompat[];
	penFamilies: PenFamily[];
	tabletFamilies: TabletFamily[];
	drivers: Driver[];
	pressureResponse: PressureResponse[];
	invPens: InventoryPen[];
	invTablets: InventoryTablet[];
}

export function analyzeData(data: AnalysisInput) {
	const {
		brands,
		tablets,
		pens,
		penCompat,
		penFamilies,
		tabletFamilies,
		drivers,
		pressureResponse,
		invPens,
		invTablets,
	} = data;

	const ds: DataBundle = {
		brands,
		tablets,
		pens,
		penCompat,
		penFamilies,
		tabletFamilies,
		drivers,
		pressureResponse,
		tabletToPens: buildTabletToPenCompatMap(penCompat, pens),
		penToTablets: buildPenToTabletCompatMap(penCompat, tablets),
	};

	const allIssues: Issue[] = [];

	// Required field checks
	allIssues.push(
		...checkRequired(ds.tablets, 'Tablet', [
			'Meta.EntityId',
			'Model.Brand',
			'Model.Id',
			'Model.Name',
			'Model.Type',
		]),
	);
	allIssues.push(...checkRequired(ds.pens, 'Pen', ['EntityId', 'Brand', 'PenId', 'PenName']));
	allIssues.push(
		...checkRequired(ds.drivers, 'Driver', [
			'EntityId',
			'Brand',
			'DriverVersion',
			'DriverName',
			'OSFamily',
			'ReleaseDate',
		]),
	);
	allIssues.push(
		...checkRequired(ds.penFamilies, 'PenFamily', ['EntityId', 'Brand', 'FamilyName']),
	);
	allIssues.push(
		...checkRequired(ds.tabletFamilies, 'TabletFamily', ['EntityId', 'Brand', 'FamilyName']),
	);
	allIssues.push(...checkRequired(ds.penCompat, 'PenCompat', ['Brand', 'TabletId', 'PenId']));
	allIssues.push(
		...checkRequired(ds.pressureResponse, 'PressureResponse', [
			'Brand',
			'PenEntityId',
			'InventoryId',
			'Date',
			'TabletEntityId',
		]),
	);

	// Whitespace checks
	allIssues.push(...checkWhitespace(ds.tablets, 'Tablet'));
	allIssues.push(...checkWhitespace(ds.pens, 'Pen'));
	allIssues.push(...checkWhitespace(ds.drivers, 'Driver'));
	allIssues.push(...checkWhitespace(ds.pressureResponse, 'PressureResponse'));

	const displayTablets = ds.tablets.filter(
		(t) => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE',
	);

	// Orphaned family references
	const penFamilyIds = new Set(ds.penFamilies.map((f) => f.EntityId));
	const tabletFamilyIds = new Set(ds.tabletFamilies.map((f) => f.EntityId));
	const orphFamilies: { type: string; id: string; referencedBy: string }[] = [];
	for (const pen of ds.pens) {
		if (pen.PenFamily && !penFamilyIds.has(pen.PenFamily)) {
			orphFamilies.push({ type: 'PenFamily', id: pen.PenFamily, referencedBy: pen.PenId });
		}
	}
	for (const tab of ds.tablets) {
		if (tab.Model.Family && !tabletFamilyIds.has(tab.Model.Family)) {
			orphFamilies.push({
				type: 'TabletFamily',
				id: tab.Model.Family,
				referencedBy: tab.Model.Id,
			});
		}
	}

	// Compat coverage
	const wacomTablets = ds.tablets.filter((t) => t.Model.Brand === 'WACOM');

	// Included pens missing compatibility info.
	const penByEntityId = new Map(ds.pens.map((p) => [p.EntityId, p]));
	const compatPairs = new Set<string>();
	for (const row of ds.penCompat) {
		compatPairs.add(`${row.TabletId}::${row.PenId}`);
	}
	const missing: IncludedPenMissing[] = [];
	for (const tablet of ds.tablets) {
		const included = tablet.Model.IncludedPen ?? [];
		for (const penEntityId of included) {
			const pen = penByEntityId.get(penEntityId);
			const penIdForCompat = pen?.PenId;
			const penName = pen?.PenName ?? '(missing pen record)';
			const linked = penIdForCompat
				? compatPairs.has(`${tablet.Model.Id}::${penIdForCompat}`)
				: false;
			if (!linked) {
				missing.push({
					tabletId: tablet.Model.Id,
					tabletName: tablet.Model.Name,
					penEntityId,
					penName,
				});
			}
		}
	}

	return {
		ds,
		inventoryPenCount: invPens.length,
		inventoryTabletCount: invTablets.length,
		issues: allIssues,
		nonMonotonicSessions: findNonMonotonicSessions(ds.pressureResponse),
		missingLowEndPens: findMissingLowEnd(ds.pressureResponse),
		singleSessionPens: findSingleSessionPens(ds.pressureResponse),
		staleMeasurements: findStaleMeasurements(ds.pressureResponse),
		remeasureRecommendations: findRecommendedForRemeasurement(ds.pressureResponse),
		tabletCompletion: computeCompletion(ds.tablets, [
			'Model.LaunchYear',
			'Model.Audience',
			'Model.Family',
			'Model.Status',
			'Model.IncludedPen',
			'Digitizer.Type',
			'Digitizer.PressureLevels',
			'Digitizer.Dimensions',
			'Digitizer.Density',
			'Digitizer.ReportRate',
			'Digitizer.Tilt',
			'Digitizer.AccuracyCenter',
			'Digitizer.AccuracyCorner',
			'Digitizer.MaxHover',
			'Digitizer.SupportsTouch',
			'Physical.Dimensions',
			'Physical.Weight',
			'Model.ProductLink',
		]),
		displayCompletion: computeCompletion(displayTablets, [
			'Display.PixelDimensions',
			'Display.PanelTech',
			'Display.Brightness',
			'Display.Contrast',
			'Display.ColorBitDepth',
			'Display.ColorGamuts',
			'Display.Lamination',
		]),
		displayTabletCount: displayTablets.length,
		penCompletion: computeCompletion(ds.pens, ['PenName', 'PenFamily', 'PenYear']),
		driverCompletion: computeCompletion(ds.drivers, [
			'DriverURLWacom',
			'DriverURLArchiveDotOrg',
			'ReleaseNotesURL',
		]),
		pressureResponseCompletion: computeCompletion(ds.pressureResponse, ['PenFamily', 'Notes']),
		inventoryPenCompletion: computeCompletion(invPens, [
			'PenEntityId',
			'PenTech',
			'WithTabletInventoryId',
		]),
		inventoryTabletCompletion: computeCompletion(invTablets, [
			'TabletEntityId',
			'Vendor',
			'OrderDate',
		]),
		orphanedCompat: findOrphanedCompat(ds),
		orphanedFamilies: orphFamilies,
		entityCounts: [
			{ entity: 'Tablets', count: ds.tablets.length },
			{ entity: 'Pens', count: ds.pens.length },
			{ entity: 'Pen Compat Rows', count: ds.penCompat.length },
			{ entity: 'Pen Families', count: ds.penFamilies.length },
			{ entity: 'Tablet Families', count: ds.tabletFamilies.length },
			{ entity: 'Drivers', count: ds.drivers.length },
			{ entity: 'Pressure Response Sessions', count: ds.pressureResponse.length },
			{ entity: 'Inventory Pens', count: invPens.length },
			{ entity: 'Inventory Tablets', count: invTablets.length },
		],
		tabletsNoCompat: wacomTablets
			.filter((t) => !ds.tabletToPens.has(t.Model.Id))
			.map((t) => ({ id: t.Model.Id, name: t.Model.Name })),
		pensNoCompat: ds.pens
			.filter((p) => !ds.penToTablets.has(p.PenId))
			.map((p) => ({ id: p.PenId, name: p.PenName })),
		includedPenMissingCompat: missing,
	};
}

export type AnalysisResult = ReturnType<typeof analyzeData>;
