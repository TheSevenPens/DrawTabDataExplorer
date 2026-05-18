import type { Tablet } from '$data/lib/drawtab-loader.js';
import type { SpecBand } from '$lib/bands.js';
import { countBy, withinYears } from '$lib/tablet-analysis/helpers.js';

export const DISPLAY_POOL_LABEL = 'pen displays and standalones';
export const TABLET_POOL_LABEL = 'tablets';

// Defaults shared by every histogram on the analysis page: unit shown
// in the title (parenthesised), not on the bands or axis ticks.
export const HISTOGRAM_DEFAULTS = {
	showUnitInTitle: true,
	showUnitInBands: false,
	showUnitInAxis: false,
} as const;

export type HistogramConfig = {
	values: number[];
	ranges: SpecBand[];
	unit: string;
	binSize: number;
	tickStep?: number;
	showUnitInTitle?: boolean;
	showUnitInBands?: boolean;
	showUnitInAxis?: boolean;
	note?: string;
};

export type MetricRowsResult = {
	rows: { label: string; count: number }[];
	count: number;
	tablets: Tablet[];
};

export type NumericSection = {
	id: string;
	title: string;
	unit: string;
	filename: string;
	data: MetricRowsResult;
	pool: number;
	poolLabel: string;
	histogram: HistogramConfig | null;
};

function numericRows(
	source: Tablet[],
	getValue: (t: Tablet) => string | null | undefined,
	yearsFilter: number | null,
): MetricRowsResult {
	const tablets = source.filter((t) => {
		if (!withinYears(t, yearsFilter)) return false;
		const v = getValue(t);
		return v != null && v !== '' && !isNaN(Number(v));
	});
	const rows = countBy(tablets, (t) => String(getValue(t))).sort(
		(a, b) => Number(a.label) - Number(b.label),
	);
	return { rows, count: tablets.length, tablets };
}

function rawNumericValues(
	source: Tablet[],
	getValue: (t: Tablet) => string | null | undefined,
	max: number | undefined,
	yearsFilter: number | null,
): number[] {
	return source
		.filter((t) => withinYears(t, yearsFilter))
		.map((t) => Number(getValue(t)))
		.filter((v): v is number => Number.isFinite(v) && (max == null || v <= max));
}

export type MetricOptions = {
	id: string;
	title: string;
	unit: string;
	getValue: (t: Tablet) => string | null | undefined;
	ranges?: SpecBand[];
	valuesMax?: number;
	binSize?: number;
	tickStep?: number;
	histogramUnit?: string;
	note?: string;
	histogram?: false;
};

export function buildMetric(
	opts: MetricOptions,
	source: Tablet[],
	pool: number,
	poolLabel: string,
	filenamePrefix: string,
	years: number | null,
): NumericSection {
	return {
		id: opts.id,
		title: opts.title,
		unit: opts.unit,
		filename: `${filenamePrefix}${opts.id.replace(/^display-/, '')}`,
		data: numericRows(source, opts.getValue, years),
		pool,
		poolLabel,
		histogram:
			opts.histogram === false || !opts.ranges || opts.binSize === undefined
				? null
				: {
						values: rawNumericValues(source, opts.getValue, opts.valuesMax, years),
						ranges: opts.ranges,
						unit: opts.histogramUnit ?? ` ${opts.unit}`,
						binSize: opts.binSize,
						tickStep: opts.tickStep,
						note: opts.note,
						...HISTOGRAM_DEFAULTS,
					},
	};
}
