import type {
	Brand,
	Tablet,
	Pen,
	PenCompat,
	PenFamily,
	TabletFamily,
	Driver,
	PressureResponse,
	PressureRange,
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
import { resolveIafByUnit } from '$data/lib/pressure/range-resolve.js';
import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
import {
	checkRequired,
	checkWhitespace,
	checkDuplicateInventoryIds,
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
	pressureRange: PressureRange[];
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
		pressureRange,
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

	allIssues.push(
		...checkRequired(pressureRange, 'PressureRange', [
			'Brand',
			'PenEntityId',
			'PenInventoryId',
			'Metric',
			'Value',
			'Date',
		]),
	);

	// Whitespace checks
	allIssues.push(...checkWhitespace(ds.tablets, 'Tablet'));
	allIssues.push(...checkWhitespace(ds.pens, 'Pen'));
	allIssues.push(...checkWhitespace(ds.drivers, 'Driver'));
	allIssues.push(...checkWhitespace(ds.pressureResponse, 'PressureResponse'));
	allIssues.push(...checkWhitespace(pressureRange, 'PressureRange'));

	// Inventory id uniqueness — pen and tablet collections checked independently
	// (a pen and a tablet may legitimately share an id string).
	allIssues.push(...checkDuplicateInventoryIds(invPens, 'InventoryPen'));
	allIssues.push(...checkDuplicateInventoryIds(invTablets, 'InventoryTablet'));

	// Direct pressure-range measurement integrity: the PenInventoryId must
	// resolve to an owned inventory pen, the (optional) TabletEntityId to a
	// known tablet, and exact-identical rows (same unit / metric / date /
	// tablet / driver / OS / value) are flagged as likely accidental
	// re-imports. Same-day repeat trials with different values are allowed.
	const rangeInvIds = new Set(invPens.map((p) => p.InventoryId));
	const rangeTabletIds = new Set(tablets.map((t) => t.Meta.EntityId));
	const seenRange = new Set<string>();
	for (const m of pressureRange) {
		if (m.PenInventoryId && !rangeInvIds.has(m.PenInventoryId)) {
			allIssues.push({
				entity: 'PressureRange',
				entityId: m._id,
				field: 'PenInventoryId',
				issue: 'references an unknown inventory pen',
				value: m.PenInventoryId,
			});
		}
		if (m.TabletEntityId && !rangeTabletIds.has(m.TabletEntityId)) {
			allIssues.push({
				entity: 'PressureRange',
				entityId: m._id,
				field: 'TabletEntityId',
				issue: 'references an unknown tablet',
				value: m.TabletEntityId,
			});
		}
		// Value is part of the key: two same-context readings with *different*
		// values are an intentional same-day repeat trial (allowed), not a
		// duplicate — only an exact-identical row (likely an accidental
		// re-import) is flagged.
		const dupKey = [
			m.PenInventoryId,
			m.Metric,
			m.Date,
			m.TabletEntityId,
			m.Driver,
			m.OS,
			m.Value,
		].join('|');
		if (seenRange.has(dupKey)) {
			allIssues.push({
				entity: 'PressureRange',
				entityId: m._id,
				field: 'Metric',
				issue: 'identical measurement (same unit / metric / date / tablet / driver / OS / value)',
				value: dupKey,
			});
		}
		seenRange.add(dupKey);
	}

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

	// Pen units with an estimated IAF (from pressure-response sessions) but no
	// direct IAF measurement yet — candidates for direct measurement. Mirrors
	// the IAF tab: defective units are excluded, and `source === 'estimated'`
	// means the resolver found an estimate but no measurement for that unit.
	const iafDefects = buildInventoryDefects(invPens);
	const nonDefectiveForIaf = pressureResponse.filter((s) => !iafDefects.has(s.InventoryId));
	const iafEstimatedNoMeasurement = resolveIafByUnit(nonDefectiveForIaf, pressureRange)
		.filter((r) => r.source === 'estimated')
		.map((r) => {
			const pen = penByEntityId.get(r.penEntityId);
			return {
				brand: pen?.Brand ?? '',
				penEntityId: r.penEntityId,
				penName: pen ? `${pen.PenName} (${pen.PenId})` : r.penEntityId,
				inventoryId: r.inventoryId,
				estimate: r.value,
			};
		})
		.sort(
			(a, b) => a.penName.localeCompare(b.penName) || a.inventoryId.localeCompare(b.inventoryId),
		);

	// Tablets whose Model.ReleaseDate isn't an exact YYYY-MM-DD, broken out by
	// how much precision is missing: none (no date), year-only (YYYY), or
	// month-only (YYYY-MM). Exact dates pass.
	const releaseDatePrecisionLabel = {
		none: 'missing',
		year: 'year only (no month/day)',
		month: 'month only (no day)',
	} as const;
	const tabletsMissingExactReleaseDate = ds.tablets
		.map((t) => {
			const rd = t.Model.ReleaseDate ?? '';
			let precision: 'none' | 'year' | 'month' | 'exact';
			if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) precision = 'exact';
			else if (/^\d{4}-\d{2}$/.test(rd)) precision = 'month';
			else if (/^\d{4}$/.test(rd)) precision = 'year';
			else precision = 'none';
			return {
				brand: t.Model.Brand,
				id: t.Model.Id,
				name: t.Model.Name,
				entityId: t.Meta.EntityId,
				releaseDate: rd,
				precision,
				missing: precision === 'exact' ? '' : releaseDatePrecisionLabel[precision],
			};
		})
		.filter((t) => t.precision !== 'exact')
		// year-only (most incomplete) first, then month-only, then by brand/id
		.sort(
			(a, b) =>
				a.precision.localeCompare(b.precision) ||
				a.brand.localeCompare(b.brand) ||
				a.id.localeCompare(b.id),
		);

	return {
		ds,
		inventoryPenCount: invPens.length,
		tabletsMissingExactReleaseDate,
		inventoryTabletCount: invTablets.length,
		issues: allIssues,
		nonMonotonicSessions: findNonMonotonicSessions(ds.pressureResponse),
		missingLowEndPens: findMissingLowEnd(ds.pressureResponse),
		singleSessionPens: findSingleSessionPens(ds.pressureResponse),
		staleMeasurements: findStaleMeasurements(ds.pressureResponse),
		remeasureRecommendations: findRecommendedForRemeasurement(ds.pressureResponse),
		iafEstimatedNoMeasurement,
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
			{ entity: 'Pressure Range Measurements', count: pressureRange.length },
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
