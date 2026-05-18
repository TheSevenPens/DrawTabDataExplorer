import type { Tablet } from '$data/lib/drawtab-loader.js';
import {
	BRIGHTNESS_BANDS as BRIGHTNESS_RANGES,
	CONTRAST_BANDS as CONTRAST_RANGES,
	RESPONSE_TIME_BANDS as RESPONSE_TIME_RANGES,
	DENSITY_BANDS as DENSITY_RANGES,
	ACCURACY_CENTER_BANDS as ACCURACY_CENTER_RANGES,
	ACCURACY_CORNER_BANDS as ACCURACY_CORNER_RANGES,
	REPORT_RATE_BANDS as REPORT_RATE_RANGES,
} from '$lib/bands.js';
import {
	buildMetric,
	DISPLAY_POOL_LABEL,
	TABLET_POOL_LABEL,
	type MetricOptions,
	type NumericSection,
} from '$lib/tablet-analysis/numeric-sections.js';

// One config per analysis section that renders a NumericMetricSection.
// The `source` field tags which tablet pool the section uses; the array
// order matches the order in which sections appear in the sidebar.
type Source = 'displays' | 'all';

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
];

export function buildAnalysisSections(
	allTablets: Tablet[],
	penDisplays: Tablet[],
	yearFilters: Record<string, number | null>,
): NumericSection[] {
	return ANALYSIS_METRICS.map(({ source, ...opts }) => {
		const tablets = source === 'displays' ? penDisplays : allTablets;
		const poolLabel = source === 'displays' ? DISPLAY_POOL_LABEL : TABLET_POOL_LABEL;
		return buildMetric(opts, tablets, tablets.length, poolLabel, 'analysis-', yearFilters[opts.id]);
	});
}
