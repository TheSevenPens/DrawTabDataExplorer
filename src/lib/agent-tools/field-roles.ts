/**
 * Semantic role for every tablet field, so comparison tools can diff what
 * describes a product and skip what merely names it.
 *
 * Why this exists: diffing all 74 `TABLET_FIELDS` between the Kamvas 22 and
 * the Kamvas 22 Plus returns 12 differences, 7 of which are Entity ID, Model
 * ID, Name, Full Name, Name-and-Model-ID, Product Link and a curated-link
 * count. They differ because the two rows are different products — restating
 * the question, not answering it. See docs/WEBMCP.md § Walkthrough A4.
 *
 * Why not reuse `group`: `FieldDisplayDef.group` is a layout hint. The `Model`
 * group holds 23 fields and mixes both kinds — `Entity ID` and `Name` sit
 * beside `Status`, `Family` and `Included Pen`, which are exactly what a
 * comparison should surface. Group cannot carry this distinction.
 *
 * Why here and not on the field defs: `TABLET_FIELDS` lives in the `data-repo`
 * submodule and `FieldDisplayDef` in `queriton`, so putting `role` on the defs
 * is a two-submodule change. That is the right eventual home — see
 * `docs/WEBMCP.md` § Requirement 7. Until then the mapping lives here and
 * `field-roles.test.ts` fails on any drift: a field added, removed or renamed
 * upstream breaks the build rather than silently defaulting to a role.
 */

export type FieldRole =
	/** Tells you *which* product this is. Always differs between two rows. */
	| 'identity'
	/** A property of the product. The only role worth diffing. */
	| 'spec'
	/** About our dataset rather than the product (curation counts, ownership). */
	| 'metadata';

const IDENTITY = [
	'EntityId',
	'FullName',
	'NameAndModelId',
	'Brand',
	'ModelId',
	'ModelName',
	'AlternateNames',
	'ModelProductLink',
	'ModelUserManual',
] as const;

const METADATA = [
	// Count of links curated from DrawingTabletDocs — says how much research
	// has been done on a row, not anything about the hardware.
	'LinkCount',
	// How many units the dataset owner happens to own.
	'UnitsInInventory',
	// Free text. A product fact, but unstructured enough that surfacing it in a
	// difference table produces a wall of prose rather than a comparison.
	'ModelNotes',
] as const;

const SPEC = [
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

export const TABLET_FIELD_ROLES: Readonly<Record<string, FieldRole>> = Object.freeze({
	...Object.fromEntries(IDENTITY.map((k) => [k, 'identity' as const])),
	...Object.fromEntries(METADATA.map((k) => [k, 'metadata' as const])),
	...Object.fromEntries(SPEC.map((k) => [k, 'spec' as const])),
});

/** Role buckets, exported so the drift test can assert disjointness. */
export const ROLE_KEYS = Object.freeze({
	identity: IDENTITY as readonly string[],
	spec: SPEC as readonly string[],
	metadata: METADATA as readonly string[],
});

/**
 * Role for a field key. Unknown keys are `undefined` rather than defaulting to
 * `spec` — a silent default is exactly the drift this module exists to catch,
 * and callers should decide what to do about a field nobody has classified.
 */
export function tabletFieldRole(key: string): FieldRole | undefined {
	return TABLET_FIELD_ROLES[key];
}
