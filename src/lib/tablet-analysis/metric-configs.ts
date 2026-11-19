import type { Tablet } from '$data/lib/drawtab-loader.js';
import {
	BRIGHTNESS_BANDS as BRIGHTNESS_RANGES,
	CONTRAST_BANDS as CONTRAST_RANGES,
	RESPONSE_TIME_BANDS as RESPONSE_TIME_RANGES,
	DENSITY_BANDS as DENSITY_RANGES,
	ACCURACY_CENTER_BANDS as ACCURACY_CENTER_RANGES,
	ACCURACY_CORNER_BANDS as ACCURACY_CORNER_RANGES,
	REPORT_RATE_BANDS as REPORT_RATE_RANGES,
	PIXEL_DENSITY_BANDS as PIXEL_DENSITY_RANGES,
	PEN_TABLET_INPUT_BANDS,
	PEN_DISPLAY_INPUT_BANDS,
	PEN_TABLET_CONSUMPTION_BANDS,
	PEN_DISPLAY_CONSUMPTION_BANDS,
	STANDBY_BANDS,
} from '$lib/bands.js';
import { ratedInputWatts } from '$lib/power.js';
import { displayPpi, matchesTypeBrand } from '$lib/tablet-analysis/helpers.js';
import {
	buildMetric,
	DISPLAY_POOL_LABEL,
	PEN_DISPLAY_ONLY_POOL_LABEL,
	PEN_TABLET_POOL_LABEL,
	TABLET_POOL_LABEL,
	type MetricOptions,
	type NumericSection,
} from '$lib/tablet-analysis/numeric-sections.js';

// One config per analysis section that renders a NumericMetricSection.
// The `source` field tags which tablet pool the section uses; the array
// order matches the order in which sections appear in the sidebar.
//   displays     — pen displays and standalones
//   all          — every tablet
//   pen-tablets  — PENTABLET only
//   pen-displays — PENDISPLAY only (the Power sections leave standalones
//                  out: their power is a battery story, and almost none
//                  record an input rating)
type Source = 'displays' | 'all' | 'pen-tablets' | 'pen-displays';

/** Rated input watts as a numeric string, for the distribution table. */
function ratedInputValue(t: Tablet): string | null {
	const w = ratedInputWatts(t);
	return w === null ? null : String(w);
}

type AnalysisMetricConfig = MetricOptions & { source: Source };

export const ANALYSIS_METRICS: AnalysisMetricConfig[] = [
	{
		source: 'displays',
		id: 'display-brightness',
		title: 'Brightness',
		unit: 'cd/m²',
		getValue: (t) => t.Display?.Brightness,
		ranges: BRIGHTNESS_RANGES,
		binSize: 25,
		tickStep: 50,
	},
	{
		source: 'displays',
		id: 'display-contrast',
		title: 'Contrast',
		unit: ':1',
		getValue: (t) => t.Display?.Contrast,
		ranges: CONTRAST_RANGES,
		valuesMax: 3500,
		binSize: 100,
		tickStep: 500,
		histogramUnit: ':1',
		note: 'OLED panels reporting 100,000:1 (~3% of records) are excluded from the histogram so the linear scale stays readable; they remain in the table below.',
	},
	{
		source: 'displays',
		id: 'display-refresh-rate',
		title: 'Refresh Rate',
		unit: 'Hz',
		getValue: (t) => t.Display?.RefreshRate,
		histogram: false,
	},
	{
		source: 'displays',
		id: 'display-response-time',
		title: 'Response Time',
		unit: 'ms',
		getValue: (t) => t.Display?.ResponseTime,
		ranges: RESPONSE_TIME_RANGES,
		valuesMax: 30,
		binSize: 1,
	},
	{
		source: 'displays',
		id: 'display-pixel-density',
		title: 'Pixel Density',
		unit: 'PPI',
		// Rounded to whole PPI so the distribution table groups near-equal
		// panels instead of listing every computed decimal on its own row.
		getValue: (t) => {
			const ppi = displayPpi(t);
			return ppi === null ? null : String(Math.round(ppi));
		},
		ranges: PIXEL_DENSITY_RANGES,
		binSize: 10,
		tickStep: 50,
	},
	{
		source: 'displays',
		id: 'display-bit-depth',
		title: 'Bit Depth',
		unit: 'bit',
		getValue: (t) => t.Display?.ColorBitDepth,
		histogram: false,
	},
	{
		source: 'all',
		id: 'digitizer-density',
		title: 'Density',
		unit: 'LPmm',
		getValue: (t) => t.Digitizer?.Density,
		ranges: DENSITY_RANGES,
		valuesMax: 300,
		binSize: 10,
		tickStep: 50,
		note: 'Values above 300 LPmm are excluded from the histogram for scale; they remain in the table below.',
	},
	{
		source: 'all',
		id: 'digitizer-accuracy-center',
		title: 'Accuracy (Center)',
		unit: 'mm',
		getValue: (t) => t.Digitizer?.AccuracyCenter,
		ranges: ACCURACY_CENTER_RANGES,
		valuesMax: 2,
		binSize: 0.1,
		tickStep: 0.25,
	},
	{
		source: 'all',
		id: 'digitizer-accuracy-corner',
		title: 'Accuracy (Corner)',
		unit: 'mm',
		getValue: (t) => t.Digitizer?.AccuracyCorner,
		ranges: ACCURACY_CORNER_RANGES,
		valuesMax: 5,
		binSize: 0.25,
	},
	{
		source: 'all',
		id: 'digitizer-report-rate',
		title: 'Report Rate',
		unit: 'Hz',
		getValue: (t) => t.Digitizer?.ReportRate,
		ranges: REPORT_RATE_RANGES,
		binSize: 20,
		tickStep: 50,
	},
	// --- Power ---
	// Input rating (what the input accepts) and consumption (what the tablet
	// draws) are separate sections on purpose: a 19 V 3.42 A input is a 65 W
	// ceiling, not a 65 W draw.
	{
		source: 'pen-displays',
		id: 'power-display-consumption',
		title: 'Pen Display Max Consumption',
		measureLabel: 'max consumption',
		unit: 'W',
		getValue: (t) => t.Power?.ConsumptionMaxWatts,
		ranges: PEN_DISPLAY_CONSUMPTION_BANDS,
		binSize: 5,
		tickStep: 10,
	},
	{
		source: 'pen-displays',
		id: 'power-display-standby',
		title: 'Pen Display Standby',
		measureLabel: 'standby power',
		unit: 'W',
		getValue: (t) => t.Power?.StandbyWatts,
		ranges: STANDBY_BANDS,
		binSize: 0.25,
		tickStep: 0.5,
	},
	{
		source: 'pen-displays',
		id: 'power-display-input',
		title: 'Pen Display Rated Input',
		measureLabel: 'rated input',
		unit: 'W',
		getValue: ratedInputValue,
		ranges: PEN_DISPLAY_INPUT_BANDS,
		binSize: 5,
		tickStep: 20,
		note: 'Rated input is the stated input watts, or input voltage × input current. Band shading marks what a USB-C port at 5 V (15 W) and USB Power Delivery (100 W) can supply.',
	},
	{
		source: 'pen-tablets',
		id: 'power-tablet-consumption',
		title: 'Pen Tablet Consumption',
		measureLabel: 'typical consumption',
		unit: 'W',
		getValue: (t) => t.Power?.ConsumptionWatts,
		ranges: PEN_TABLET_CONSUMPTION_BANDS,
		binSize: 0.1,
		tickStep: 0.5,
	},
	{
		source: 'pen-tablets',
		id: 'power-tablet-input',
		title: 'Pen Tablet Rated Input',
		measureLabel: 'rated input',
		unit: 'W',
		getValue: ratedInputValue,
		ranges: PEN_TABLET_INPUT_BANDS,
		binSize: 0.25,
		tickStep: 0.5,
		note: 'Rated input is input voltage × input current. Band shading marks what a USB 2.0 port (2.5 W), and a USB 3.x port (4.5 W) can supply.',
	},
];

/** A section's type and brand dropdown values; '' means "all". */
export type PoolFilter = { type: string; brand: string };

export function buildAnalysisSections(
	allTablets: Tablet[],
	penDisplays: Tablet[],
	yearFilters: Record<string, number | null>,
	poolFilters: Record<string, PoolFilter> = {},
): NumericSection[] {
	return ANALYSIS_METRICS.map(({ source, ...opts }) => {
		const base =
			source === 'displays'
				? penDisplays
				: source === 'pen-tablets'
					? allTablets.filter((t) => t.Model.Type === 'PENTABLET')
					: source === 'pen-displays'
						? allTablets.filter((t) => t.Model.Type === 'PENDISPLAY')
						: allTablets;
		const f = poolFilters[opts.id];
		const tablets = f
			? base.filter((t) =>
					matchesTypeBrand({ type: t.Model.Type, brand: t.Model.Brand as string }, f.type, f.brand),
				)
			: base;
		const poolLabel = {
			displays: DISPLAY_POOL_LABEL,
			all: TABLET_POOL_LABEL,
			'pen-tablets': PEN_TABLET_POOL_LABEL,
			'pen-displays': PEN_DISPLAY_ONLY_POOL_LABEL,
		}[source];
		return buildMetric(opts, tablets, tablets.length, poolLabel, 'analysis-', yearFilters[opts.id]);
	});
}
