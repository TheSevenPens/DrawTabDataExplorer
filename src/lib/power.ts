// Power specs (the tablet `Power` group): pure helpers shared by the
// /tablet-analysis Power sections and the tablet Specs tab.
//
// Two kinds of number live in that group and must never be mixed up:
//
//   - **Input rating** — what the tablet's power input accepts, as printed
//     on the device or its manual (e.g. 5 V 0.5 A, 19 V 3.42 A). It is a
//     ceiling the power supply has to meet, not what the tablet draws.
//   - **Consumption** — what the tablet actually draws (typical, maximum,
//     standby), as the manufacturer states it.
//
// Rated input watts are computed as voltage × current when the spec gives
// both, unless it states the input watts directly.

import type { Tablet } from '$data/lib/drawtab-loader.js';
import { POWER_SOURCES } from '$data/lib/schemas.js';

export type PowerSource = (typeof POWER_SOURCES)[number];

/** Reader-facing names for the stored `InputSource` / `AltInputSource` codes. */
export const POWER_SOURCE_LABELS: Record<PowerSource, string> = {
	ADAPTER: 'Power adapter',
	USB_PD: 'USB-C Power Delivery',
	USB: 'USB port',
};

/** The label for a stored power-source code; unknown codes pass through. */
export function powerSourceLabel(code: string): string {
	return (POWER_SOURCE_LABELS as Record<string, string>)[code] ?? code;
}

/** A stored numeric-string power value as a number; null when blank or not numeric. */
export function powerNumber(v: string | null | undefined): number | null {
	if (v == null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

/** Round away float noise (5 × 0.036 → 0.18, not 0.18000000000000002). */
function roundWatts(w: number): number {
	return Math.round(w * 1000) / 1000;
}

/**
 * Rated input power in watts: the stated `InputWatts`, else
 * `InputVoltage × InputCurrent`. Null when neither is available — a voltage
 * without a current is not a rating.
 */
export function ratedInputWatts(t: Tablet): number | null {
	const p = t.Power;
	if (!p) return null;
	const stated = powerNumber(p.InputWatts);
	if (stated !== null) return stated;
	const v = powerNumber(p.InputVoltage);
	const a = powerNumber(p.InputCurrent);
	return v !== null && a !== null ? roundWatts(v * a) : null;
}

/** True when `ratedInputWatts` is computed (V × A) rather than stated. */
export function ratedInputWattsComputed(t: Tablet): boolean {
	return powerNumber(t.Power?.InputWatts) === null && ratedInputWatts(t) !== null;
}

/** Typical power consumption (W), or null. */
export const consumptionWatts = (t: Tablet) => powerNumber(t.Power?.ConsumptionWatts);
/** Maximum power consumption (W), or null. */
export const maxConsumptionWatts = (t: Tablet) => powerNumber(t.Power?.ConsumptionMaxWatts);
/** Standby power (W), or null. */
export const standbyWatts = (t: Tablet) => powerNumber(t.Power?.StandbyWatts);

// --- Coverage ---

/** One row of the coverage table: how many tablets in each pool record it. */
export interface PowerCoverageRow {
	label: string;
	kind: 'Any' | 'Input rating' | 'Consumption' | 'Other';
	penTablets: number;
	penDisplays: number;
}

const COVERAGE_FIELDS: {
	label: string;
	kind: PowerCoverageRow['kind'];
	has: (t: Tablet) => boolean;
}[] = [
	{ label: 'Any power data', kind: 'Any', has: (t) => t.Power != null },
	{ label: 'Input source', kind: 'Input rating', has: (t) => !!t.Power?.InputSource },
	{
		label: 'Input voltage',
		kind: 'Input rating',
		has: (t) => powerNumber(t.Power?.InputVoltage) !== null,
	},
	{
		label: 'Input current',
		kind: 'Input rating',
		has: (t) => powerNumber(t.Power?.InputCurrent) !== null,
	},
	{
		label: 'Rated input watts (stated or V × A)',
		kind: 'Input rating',
		has: (t) => ratedInputWatts(t) !== null,
	},
	{
		label: 'Alternative input',
		kind: 'Input rating',
		has: (t) => !!t.Power?.AltInputSource,
	},
	{
		label: 'Typical consumption',
		kind: 'Consumption',
		has: (t) => consumptionWatts(t) !== null,
	},
	{
		label: 'Max consumption',
		kind: 'Consumption',
		has: (t) => maxConsumptionWatts(t) !== null,
	},
	{ label: 'Standby', kind: 'Consumption', has: (t) => standbyWatts(t) !== null },
	{
		label: 'Adapter watts',
		kind: 'Other',
		has: (t) => powerNumber(t.Power?.AdapterWatts) !== null,
	},
	{
		label: 'Output watts',
		kind: 'Other',
		has: (t) => powerNumber(t.Power?.OutputWatts) !== null,
	},
];

/** How many pen tablets and pen displays record each power field. */
export function powerCoverage(penTablets: Tablet[], penDisplays: Tablet[]): PowerCoverageRow[] {
	return COVERAGE_FIELDS.map(({ label, kind, has }) => ({
		label,
		kind,
		penTablets: penTablets.filter(has).length,
		penDisplays: penDisplays.filter(has).length,
	}));
}

// --- Input source ---

export const NOT_RECORDED = '(not recorded)';

/**
 * Count of tablets by main input source, labelled for readers, in
 * POWER_SOURCES order with the unrecorded ones last. Sources nobody uses
 * are left out.
 */
export function inputSourceRows(tablets: Tablet[]): { label: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const t of tablets) {
		const k = t.Power?.InputSource ?? NOT_RECORDED;
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	const order: string[] = [...POWER_SOURCES, NOT_RECORDED];
	return order
		.filter((k) => counts.has(k))
		.map((k) => ({ label: k === NOT_RECORDED ? k : powerSourceLabel(k), count: counts.get(k)! }));
}

// --- Specs tab layout ---

export interface PowerSpecRow {
	/** TABLET_FIELDS key, or a synthetic key for computed rows. */
	key: string;
	label: string;
	value: string;
	unit?: string;
	computed?: boolean;
}

export interface PowerSpecBlock {
	heading: string;
	rows: PowerSpecRow[];
}

/**
 * The tablet's power specs grouped for the Specs tab: Input rating,
 * Alternative input, Consumption, then Adapter & output. Only recorded
 * values; empty blocks are dropped. Rated input watts are shown (marked
 * computed) when the spec gives voltage and current but not watts; the
 * alternative input's watts are always computed (the schema stores none).
 */
export function powerSpecBlocks(t: Tablet): PowerSpecBlock[] {
	const p = t.Power;
	if (!p) return [];
	const row = (
		key: string,
		label: string,
		value: string | undefined,
		unit?: string,
	): PowerSpecRow | null => (value ? { key, label, value, unit } : null);

	const rated = ratedInputWatts(t);
	const altV = powerNumber(p.AltInputVoltage);
	const altA = powerNumber(p.AltInputCurrent);
	const altRated = altV !== null && altA !== null ? roundWatts(altV * altA) : null;
	const blocks: PowerSpecBlock[] = [
		{
			heading: 'Input rating',
			rows: [
				row(
					'PowerInputSource',
					'Source',
					p.InputSource ? powerSourceLabel(p.InputSource) : undefined,
				),
				row('PowerInputVoltage', 'Voltage', p.InputVoltage, 'V'),
				row('PowerInputCurrent', 'Current', p.InputCurrent, 'A'),
				rated === null
					? null
					: {
							key: 'PowerInputWatts',
							label: 'Power',
							value: String(rated),
							unit: 'W',
							computed: ratedInputWattsComputed(t),
						},
			].filter((r): r is PowerSpecRow => r !== null),
		},
		{
			heading: 'Alternative input',
			rows: [
				row(
					'PowerAltInputSource',
					'Source',
					p.AltInputSource ? powerSourceLabel(p.AltInputSource) : undefined,
				),
				row('PowerAltInputVoltage', 'Voltage', p.AltInputVoltage, 'V'),
				row('PowerAltInputCurrent', 'Current', p.AltInputCurrent, 'A'),
				altRated === null
					? null
					: {
							key: 'PowerAltInputWatts',
							label: 'Power',
							value: String(altRated),
							unit: 'W',
							computed: true,
						},
			].filter((r): r is PowerSpecRow => r !== null),
		},
		{
			heading: 'Consumption',
			rows: [
				row('PowerConsumptionWatts', 'Typical', p.ConsumptionWatts, 'W'),
				row('PowerConsumptionMaxWatts', 'Maximum', p.ConsumptionMaxWatts, 'W'),
				row('PowerStandbyWatts', 'Standby', p.StandbyWatts, 'W'),
			].filter((r): r is PowerSpecRow => r !== null),
		},
		{
			heading: 'Adapter & output',
			rows: [
				row('PowerAdapterWatts', 'Adapter', p.AdapterWatts, 'W'),
				row('PowerOutputWatts', 'Output to devices', p.OutputWatts, 'W'),
			].filter((r): r is PowerSpecRow => r !== null),
		},
	];
	return blocks.filter((b) => b.rows.length > 0);
}
