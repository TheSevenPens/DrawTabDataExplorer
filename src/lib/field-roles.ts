/**
 * Semantic role for each entity field: does it *identify* the row, *describe*
 * it, or describe our dataset's coverage of it?
 *
 * `FieldDisplayDef.group` cannot carry this. Group is a layout hint, and the
 * `Model` group mixes all three — `Entity ID` and `Name` sit beside `Status`,
 * `Family` and `Included Pen`, which are exactly what a comparison should
 * surface. Splitting on group would drop the wrong half.
 *
 * The immediate consumer is the compare pages. Diffing every field means the
 * first rows of every comparison restate the question: of the 12 fields that
 * differ between the Kamvas 22 and the Kamvas 22 Plus, 7 are Entity ID, Model
 * ID, Name, Full Name, Name-and-Model-ID, Product Link and a curated-link
 * count. They differ because the two rows are different products. The column
 * headers already name them.
 *
 * Eventual home: `role` belongs on `FieldDisplayDef` itself, beside `group`
 * and `computed`. That is a two-submodule change (the type lives in
 * `queriton`, the field arrays in `data-repo`), so until it is worth making,
 * the mapping lives here and `field-roles.test.ts` fails on any drift — a
 * field added, renamed or removed upstream breaks the build rather than
 * silently defaulting to a role.
 */
import type { FieldDisplayDef } from '@thesevenpens/queriton';

export type FieldRole =
	/** Says *which* row this is. Always differs between two rows, so never news. */
	| 'identity'
	/** A property of the thing itself. The only role worth diffing. */
	| 'spec'
	/** About our dataset rather than the product — curation, ownership, links. */
	| 'metadata';

const TABLET_IDENTITY = [
	'EntityId',
	'FullName',
	'NameAndModelId',
	'Brand',
	'ModelId',
	'ModelName',
	'AlternateNames',
] as const;

const TABLET_METADATA = [
	// Count of links curated from DrawingTabletDocs — how much research has been
	// done on a row, not anything about the hardware.
	'LinkCount',
	// How many units the dataset owner happens to own.
	'UnitsInInventory',
	// Reference pointers. Neither identity nor a spec you can compare — two
	// tablets always have different URLs, and that tells you nothing.
	'ModelProductLink',
	'ModelUserManual',
] as const;

const TABLET_SPEC = [
	// Free text, but a fact about the product, so `spec`. /tablet-compare also
	// hides it for an unrelated presentational reason (nowrap cells blow the
	// column out) — that exclusion is tracked in GitHub #309 and deliberately
	// kept separate from this map. A role is semantic; a layout workaround is
	// not, and folding one into the other would silently close that issue.
	'ModelNotes',
	'ModelType',
	'ModelReleaseYear',
	'ReleaseDate',
	'Age',
	'AgeInDays',
	'ModelAudience',
	'ModelFamily',
	'ModelStatus',
	'LastSupportedWindowsDriver',
	'LastSupportedMacOSDriver',
	'ModelIncludedPen',
	'DigitizerType',
	'DigitizerPressureLevels',
	'DigitizerReportRate',
	'DigitizerDensity',
	'DigitizerTilt',
	'DigitizerAccuracyCenter',
	'DigitizerAccuracyCorner',
	'DigitizerMaxHover',
	'DigitizerSupportsTouch',
	'DigitizerDimensions',
	'DigitizerAspectRatio',
	'DigitizerAspectRatioFraction',
	'DigitizerAspectRatioCategory',
	'DigitizerSizeCategory',
	'DigitizerDiagonal',
	'DigitizerActiveAreaMm2',
	'DigitizerActiveAreaCm2',
	'ForceProportionsLoss16x9',
	'ForceProportionsLoss16x10',
	'DisplayPanelTech',
	'DisplayBrightness',
	'DisplayBrightnessPeak',
	'DisplayContrast',
	'DisplayColorBitDepth',
	'DisplayGamutSRGB',
	'DisplayGamutAdobeRGB',
	'DisplayGamutDCIP3',
	'DisplayGamutDisplayP3',
	'DisplayGamutNTSC',
	'DisplayGamutRec709',
	'DisplayColorGamuts',
	'DisplayLamination',
	'DisplayAntiGlare',
	'DisplayResponseTime',
	'DisplayRefreshRate',
	'DisplayPixelDimensions',
	'DisplayPixelCount',
	'DisplayDiagonal',
	'DisplayDensity',
	'DisplayPixelDimensionsCategory',
	'PhysicalWeight',
	'PhysicalDimensions',
	'ComputeOS',
	'ComputeProcessor',
	'ComputeGPU',
	'ComputeRAM',
	'ComputeStorage',
	'ComputeExpandableStorage',
	'ComputeMemoryCardSlot',
	'BatteryCapacity',
	'BatteryLife',
	'BatteryChargingWatts',
	'ConnectivityWifi',
	'ConnectivityBluetooth',
	'ConnectivityUSB',
	'HardwareSpeakers',
	'HardwareFrontCamera',
	'HardwareRearCamera',
] as const;

const PEN_IDENTITY = ['EntityId', 'FullName', 'Brand', 'PenId', 'PenName'] as const;

const PEN_METADATA = [
	// Curation labels we apply, not properties of the pen.
	'Tags',
	'LinkCount',
	'UnitsInInventory',
	// How many pressure sessions we have recorded — a measure of our coverage.
	'PressureSessionCount',
] as const;

const PEN_SPEC = [
	// See the ModelNotes note above — free text, but the pen's own.
	'Notes',
	'PenFamily',
	'PenTech',
	'ReleaseYear',
	'PressureSensitive',
	'PressureLevels',
	'Tilt',
	'BarrelRotation',
	'Hover',
	'IAF',
	'ButtonCount',
	'Wheel',
	'Eraser',
	'Shape',
	'Weight',
	'Length',
	'Diameter',
] as const;

function buildRoles(
	identity: readonly string[],
	spec: readonly string[],
	metadata: readonly string[],
): Readonly<Record<string, FieldRole>> {
	return Object.freeze({
		...Object.fromEntries(identity.map((k) => [k, 'identity' as const])),
		...Object.fromEntries(spec.map((k) => [k, 'spec' as const])),
		...Object.fromEntries(metadata.map((k) => [k, 'metadata' as const])),
	});
}

export const TABLET_FIELD_ROLES = buildRoles(TABLET_IDENTITY, TABLET_SPEC, TABLET_METADATA);
export const PEN_FIELD_ROLES = buildRoles(PEN_IDENTITY, PEN_SPEC, PEN_METADATA);

/** Role buckets, exported so the drift test can assert disjointness. */
export const ROLE_KEYS = Object.freeze({
	tablet: { identity: TABLET_IDENTITY, spec: TABLET_SPEC, metadata: TABLET_METADATA },
	pen: { identity: PEN_IDENTITY, spec: PEN_SPEC, metadata: PEN_METADATA },
});

/**
 * Role for a field key, or `undefined` when nobody has classified it.
 *
 * Deliberately not defaulting to `spec`: a silent default is the drift this
 * module exists to catch, and callers should decide what an unclassified field
 * means rather than inherit a guess.
 */
export function fieldRole(
	roles: Readonly<Record<string, FieldRole>>,
	key: string,
): FieldRole | undefined {
	return roles[key];
}

/**
 * The fields worth comparing between two rows of the same entity.
 *
 * An unclassified field is kept, not dropped — hiding a real difference is
 * worse than showing an unclassified one, and the drift test will have already
 * failed the build by then.
 */
export function comparableFields<T>(
	fields: readonly FieldDisplayDef<T>[],
	roles: Readonly<Record<string, FieldRole>>,
): FieldDisplayDef<T>[] {
	return fields.filter((f) => {
		const role = fieldRole(roles, f.key);
		return role === undefined || role === 'spec';
	});
}
