<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import DistributionTable from '$lib/components/DistributionTable.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import { flaggedCount } from '$lib/flagged-store.js';

	let tabletTabs = $derived([
		{ href: '/tablets', label: 'Tablet models' },
		{ href: '/tablet-families', label: 'Tablet families' },
		{ href: '/tablet-analysis', label: 'Analysis' },
		{ href: '/tablet-inventory', label: 'Inventory' },
		{ href: '/tablet-compare', label: 'Compare', badge: $flaggedCount },
	]);
	import ValueHistogram, { type HistogramMarker } from '$lib/components/ValueHistogram.svelte';
	import {
		getDiagonal,
		type Tablet,
		type ISOPaperSize,
		type USPaperSize,
	} from '$data/lib/drawtab-loader.js';
	import { aspectRatioCategory, ASPECT_RATIO_CATEGORIES } from '$data/lib/aspect-ratio.js';
	import { unitPreference } from '$lib/unit-store.js';
	import {
		penTabletRangesCm,
		penTabletRangesIn,
		displayRangesCm,
		displayRangesIn,
		MM_TO_IN,
		MM_TO_CM,
	} from '$lib/tablet-size-ranges.js';
	import {
		BRIGHTNESS_BANDS as BRIGHTNESS_RANGES,
		CONTRAST_BANDS as CONTRAST_RANGES,
		RESPONSE_TIME_BANDS as RESPONSE_TIME_RANGES,
		DENSITY_BANDS as DENSITY_RANGES,
		ACCURACY_CENTER_BANDS as ACCURACY_CENTER_RANGES,
		ACCURACY_CORNER_BANDS as ACCURACY_CORNER_RANGES,
		REPORT_RATE_BANDS as REPORT_RATE_RANGES,
		type SpecBand,
	} from '$lib/bands.js';

	let { data } = $props();
	let allTablets: Tablet[] = $derived(data.allTablets ?? []);
	let isoPaperSizes: ISOPaperSize[] = $derived(data.isoPaperSizes ?? []);
	let usPaperSizes: USPaperSize[] = $derived(data.usPaperSizes ?? []);
	let isMetric = $derived($unitPreference === 'metric');

	// Source of truth for the navigation tree. Each entry is one tree
	// leaf, grouped under a category heading by <SectionedPage>.
	const sectionDefs: Section[] = [
		{ id: 'aspect-pen-tablet', category: 'Aspect Ratio', label: 'Pen Tablets' },
		{
			id: 'aspect-pen-tablet-by-category',
			category: 'Aspect Ratio',
			label: 'Pen Tablets — by Category',
		},
		{ id: 'aspect-pen-display', category: 'Aspect Ratio', label: 'Pen Displays' },
		{
			id: 'aspect-pen-display-by-category',
			category: 'Aspect Ratio',
			label: 'Pen Displays — by Category',
		},
		{ id: 'digitizer-density', category: 'Digitizer', label: 'Density' },
		{ id: 'digitizer-accuracy-center', category: 'Digitizer', label: 'Accuracy (Center)' },
		{ id: 'digitizer-accuracy-corner', category: 'Digitizer', label: 'Accuracy (Corner)' },
		{ id: 'digitizer-report-rate', category: 'Digitizer', label: 'Report Rate' },
		{ id: 'panel-tech', category: 'Display Tech', label: 'Panel Technology' },
		{ id: 'display-brightness', category: 'Display Tech', label: 'Brightness' },
		{ id: 'display-contrast', category: 'Display Tech', label: 'Contrast' },
		{ id: 'display-refresh-rate', category: 'Display Tech', label: 'Refresh Rate' },
		{ id: 'display-response-time', category: 'Display Tech', label: 'Response Time' },
		{ id: 'display-bit-depth', category: 'Display Tech', label: 'Bit Depth' },
		{ id: 'pressure-levels', category: 'Tablet Features', label: 'Pressure Levels' },
		{ id: 'touch-support', category: 'Tablet Features', label: 'Touch Support' },
		{ id: 'sizes-pen-tablet', category: 'Sizes', label: 'Pen Tablet diagonal' },
		{ id: 'sizes-pen-display', category: 'Sizes', label: 'Pen Display diagonal' },
	];

	// --- Helpers ---

	function gcd(a: number, b: number): number {
		return b === 0 ? a : gcd(b, a % b);
	}

	function aspectRatioLabel(w: number, h: number): string {
		const lw = Math.max(w, h);
		const lh = Math.min(w, h);
		const scale = gcd(Math.round(lw), Math.round(lh));
		const rw = Math.round(lw / scale);
		const rh = Math.round(lh / scale);
		// Snap to nearest known ratio
		const ratio = lw / lh;
		if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
		if (Math.abs(ratio - 16 / 10) < 0.02) return '16:10';
		if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3';
		if (Math.abs(ratio - 3 / 2) < 0.02) return '3:2';
		if (Math.abs(ratio - 5 / 4) < 0.02) return '5:4';
		return `${rw}:${rh}`;
	}

	function ratio16(label: string): string {
		const [w, h] = label.split(':').map(Number);
		if (!w || !h) return '';
		const x = (h / w) * 16;
		const rounded = Math.round(x * 100) / 100;
		const display =
			rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2).replace(/\.?0+$/, '');
		return `16:${display}`;
	}

	function countBy<T>(items: T[], key: (item: T) => string): { label: string; count: number }[] {
		const map = new Map<string, number>();
		for (const item of items) {
			const k = key(item);
			map.set(k, (map.get(k) ?? 0) + 1);
		}
		return [...map.entries()]
			.map(([label, count]) => ({ label, count }))
			.sort((a, b) => b.count - a.count);
	}

	// --- Aspect Ratio tab ---

	let penTablets = $derived(allTablets.filter((t) => t.Model.Type === 'PENTABLET'));
	let penDisplays = $derived(
		allTablets.filter((t) => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE'),
	);

	function ratioDecimal(label: string): string {
		const [w, h] = label.split(':').map(Number);
		if (!w || !h) return '';
		return (w / h).toFixed(2);
	}

	function labelToCategory(label: string): string {
		const [w, h] = label.split(':').map(Number);
		if (!w || !h) return '';
		return aspectRatioCategory(w, h) ?? '';
	}

	function arRows(tablets: Tablet[]) {
		return countBy(
			tablets.filter(
				(t) => t.Digitizer?.Dimensions?.Width != null && t.Digitizer?.Dimensions?.Height != null,
			),
			(t) => aspectRatioLabel(t.Digitizer!.Dimensions!.Width!, t.Digitizer!.Dimensions!.Height!),
		).map((r) => ({
			...r,
			ratio16: ratio16(r.label),
			decimal: ratioDecimal(r.label),
			category: labelToCategory(r.label),
		}));
	}

	let ptAR = $derived(arRows(penTablets));
	let pdAR = $derived(arRows(penDisplays));

	// Categorized aspect-ratio buckets (16X9_EXACT, 16X10_VERYCLOSE, …,
	// OTHER). Tablets with missing dimensions are skipped, not bucketed
	// as OTHER. Sorted by ASPECT_RATIO_CATEGORIES order so 16X9_* group
	// together visually, and rows with zero count are dropped.
	function arCategoryRows(tablets: Tablet[]) {
		const counts = new Map<string, number>();
		for (const t of tablets) {
			const d = t.Digitizer?.Dimensions;
			const cat = aspectRatioCategory(d?.Width, d?.Height);
			if (cat == null) continue;
			counts.set(cat, (counts.get(cat) ?? 0) + 1);
		}
		return ASPECT_RATIO_CATEGORIES.filter((c) => counts.has(c)).map((c) => ({
			label: c,
			count: counts.get(c)!,
		}));
	}

	let ptARCat = $derived(arCategoryRows(penTablets));
	let pdARCat = $derived(arCategoryRows(penDisplays));

	// --- Display Tech tab ---

	let displaysWithTech = $derived(penDisplays.filter((t) => t.Display?.PanelTech != null));

	let panelTechRows = $derived(countBy(displaysWithTech, (t) => t.Display!.PanelTech!));

	let panelTechTotal = $derived(displaysWithTech.length);
	let panelTechCovered = $derived(penDisplays.length);

	// Per-section "tablets released within N years" filter. `null` = no filter.
	// One entry per numericSections id; the value is two-way-bound through
	// ValueHistogram's compareYears dropdown.
	let yearFilters = $state<Record<string, number | null>>({
		'display-brightness': null,
		'display-contrast': null,
		'display-refresh-rate': null,
		'display-response-time': null,
		'display-bit-depth': null,
		'digitizer-density': null,
		'digitizer-accuracy-center': null,
		'digitizer-accuracy-corner': null,
		'digitizer-report-rate': null,
	});

	function withinYears(t: Tablet, n: number | null): boolean {
		if (n === null) return true;
		const y = parseInt(t.Model.LaunchYear, 10);
		if (isNaN(y)) return false;
		return y >= new Date().getFullYear() - n;
	}

	function subtitleFor(tablets: Tablet[]): string {
		const n = tablets.length;
		const noun = n === 1 ? 'tablet' : 'tablets';
		if (n === 0) return `0 ${noun}`;
		const ys = tablets.map((t) => parseInt(t.Model.LaunchYear, 10)).filter((y) => !isNaN(y));
		if (ys.length === 0) return `${n} ${noun}`;
		const min = Math.min(...ys);
		const max = Math.max(...ys);
		const range = min === max ? `${min}` : `${min}–${max}`;
		return `${n} ${noun} · ${range}`;
	}

	// Numeric Display.* stats — sorted ascending by numeric value rather
	// than descending by count, since these are physical-quantity scales
	// users want to read in order.
	function numericDisplayRows(
		getValue: (t: Tablet) => string | null | undefined,
		yearsFilter: number | null = null,
	) {
		const tablets = penDisplays.filter((t) => {
			if (!withinYears(t, yearsFilter)) return false;
			const v = getValue(t);
			return v != null && v !== '' && !isNaN(Number(v));
		});
		const rows = countBy(tablets, (t) => String(getValue(t))).sort(
			(a, b) => Number(a.label) - Number(b.label),
		);
		return { rows, count: tablets.length, tablets };
	}

	// Raw numeric values for histogram rendering. The exact-count tables below
	// keep all data points; the histogram clips outliers (e.g. 100,000:1 OLED
	// contrast values) so the linear-scale distribution stays readable.
	function rawNumericDisplayValues(
		getValue: (t: Tablet) => string | null | undefined,
		max: number | undefined,
		yearsFilter: number | null = null,
	): number[] {
		return penDisplays
			.filter((t) => withinYears(t, yearsFilter))
			.map((t) => Number(getValue(t)))
			.filter((v): v is number => Number.isFinite(v) && (max == null || v <= max));
	}

	// --- Digitizer.* numeric stats (apply to ALL tablets, not just displays) ---

	function numericTabletRows(
		getValue: (t: Tablet) => string | null | undefined,
		yearsFilter: number | null = null,
	) {
		const tablets = allTablets.filter((t) => {
			if (!withinYears(t, yearsFilter)) return false;
			const v = getValue(t);
			return v != null && v !== '' && !isNaN(Number(v));
		});
		const rows = countBy(tablets, (t) => String(getValue(t))).sort(
			(a, b) => Number(a.label) - Number(b.label),
		);
		return { rows, count: tablets.length, tablets };
	}

	function rawNumericTabletValues(
		getValue: (t: Tablet) => string | null | undefined,
		max: number | undefined,
		yearsFilter: number | null = null,
	): number[] {
		return allTablets
			.filter((t) => withinYears(t, yearsFilter))
			.map((t) => Number(getValue(t)))
			.filter((v): v is number => Number.isFinite(v) && (max == null || v <= max));
	}

	const DISPLAY_POOL_LABEL = 'pen displays and standalones';
	const TABLET_POOL_LABEL = 'tablets';

	type HistogramConfig = {
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

	type NumericSection = {
		id: string;
		title: string;
		unit: string;
		filename: string;
		data: ReturnType<typeof numericDisplayRows>;
		pool: number;
		poolLabel: string;
		histogram: HistogramConfig | null;
	};

	// Defaults shared by every histogram on the analysis page: unit shown
	// in the title (parenthesised), not on the bands or axis ticks.
	const HISTOGRAM_DEFAULTS = {
		showUnitInTitle: true,
		showUnitInBands: false,
		showUnitInAxis: false,
	} as const;

	function displayMetric(opts: {
		id: string;
		title: string;
		unit: string; // column-header unit, e.g. "cd/m²"
		getValue: (t: Tablet) => string | null | undefined;
		ranges?: SpecBand[];
		valuesMax?: number; // optional histogram clip
		binSize?: number;
		tickStep?: number;
		histogramUnit?: string; // " cd/m²" etc.; defaults to ` ${unit}`
		note?: string;
		histogram?: false; // pass `false` to skip the histogram (table-only sections)
	}): NumericSection {
		const id = opts.id;
		const years = yearFilters[id];
		return {
			id,
			title: opts.title,
			unit: opts.unit,
			filename: `analysis-${id.replace(/^display-/, '')}`,
			data: numericDisplayRows(opts.getValue, years),
			pool: penDisplays.length,
			poolLabel: DISPLAY_POOL_LABEL,
			histogram:
				opts.histogram === false || !opts.ranges || opts.binSize === undefined
					? null
					: {
							values: rawNumericDisplayValues(opts.getValue, opts.valuesMax, years),
							ranges: opts.ranges,
							unit: opts.histogramUnit ?? ` ${opts.unit}`,
							binSize: opts.binSize,
							tickStep: opts.tickStep,
							note: opts.note,
							...HISTOGRAM_DEFAULTS,
						},
		};
	}

	function digitizerMetric(opts: {
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
	}): NumericSection {
		const id = opts.id;
		const years = yearFilters[id];
		return {
			id,
			title: opts.title,
			unit: opts.unit,
			filename: `analysis-${id}`,
			data: numericTabletRows(opts.getValue, years),
			pool: allTablets.length,
			poolLabel: TABLET_POOL_LABEL,
			histogram:
				opts.histogram === false || !opts.ranges || opts.binSize === undefined
					? null
					: {
							values: rawNumericTabletValues(opts.getValue, opts.valuesMax, years),
							ranges: opts.ranges,
							unit: opts.histogramUnit ?? ` ${opts.unit}`,
							binSize: opts.binSize,
							tickStep: opts.tickStep,
							note: opts.note,
							...HISTOGRAM_DEFAULTS,
						},
		};
	}

	let numericSections: NumericSection[] = $derived([
		displayMetric({
			id: 'display-brightness',
			title: 'Brightness',
			unit: 'cd/m²',
			getValue: (t) => t.Display?.Brightness,
			ranges: BRIGHTNESS_RANGES,
			binSize: 25,
			tickStep: 50,
		}),
		displayMetric({
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
		}),
		displayMetric({
			id: 'display-refresh-rate',
			title: 'Refresh Rate',
			unit: 'Hz',
			getValue: (t) => t.Display?.RefreshRate,
			histogram: false,
		}),
		displayMetric({
			id: 'display-response-time',
			title: 'Response Time',
			unit: 'ms',
			getValue: (t) => t.Display?.ResponseTime,
			ranges: RESPONSE_TIME_RANGES,
			valuesMax: 30,
			binSize: 1,
		}),
		displayMetric({
			id: 'display-bit-depth',
			title: 'Bit Depth',
			unit: 'bit',
			getValue: (t) => t.Display?.ColorBitDepth,
			histogram: false,
		}),
		digitizerMetric({
			id: 'digitizer-density',
			title: 'Density',
			unit: 'LPmm',
			getValue: (t) => t.Digitizer?.Density,
			ranges: DENSITY_RANGES,
			valuesMax: 300,
			binSize: 10,
			tickStep: 50,
			note: 'Values above 300 LPmm are excluded from the histogram for scale; they remain in the table below.',
		}),
		digitizerMetric({
			id: 'digitizer-accuracy-center',
			title: 'Accuracy (Center)',
			unit: 'mm',
			getValue: (t) => t.Digitizer?.AccuracyCenter,
			ranges: ACCURACY_CENTER_RANGES,
			valuesMax: 2,
			binSize: 0.1,
			tickStep: 0.25,
		}),
		digitizerMetric({
			id: 'digitizer-accuracy-corner',
			title: 'Accuracy (Corner)',
			unit: 'mm',
			getValue: (t) => t.Digitizer?.AccuracyCorner,
			ranges: ACCURACY_CORNER_RANGES,
			valuesMax: 5,
			binSize: 0.25,
		}),
		digitizerMetric({
			id: 'digitizer-report-rate',
			title: 'Report Rate',
			unit: 'Hz',
			getValue: (t) => t.Digitizer?.ReportRate,
			ranges: REPORT_RATE_RANGES,
			binSize: 20,
			tickStep: 50,
		}),
	]);

	// --- Pressure Levels tab ---

	let tabletsWithPressure = $derived(allTablets.filter((t) => t.Digitizer?.PressureLevels != null));

	let pressureRows = $derived(
		countBy(tabletsWithPressure, (t) => t.Digitizer!.PressureLevels!).sort(
			(a, b) => Number(a.label) - Number(b.label),
		),
	);

	let pressureTotal = $derived(tabletsWithPressure.length);

	// --- Touch Support tab ---

	const TOUCH_ORDER = ['YES', 'NO', '(not specified)'];

	let touchSupportRows = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const t of allTablets) {
			const v = t.Digitizer?.SupportsTouch;
			const key = v === 'YES' || v === 'NO' ? v : '(not specified)';
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return TOUCH_ORDER.filter((k) => counts.has(k)).map((k) => ({
			label: k,
			count: counts.get(k)!,
		}));
	});

	let touchTotal = $derived(touchSupportRows.reduce((s, r) => s + r.count, 0));

	// Single shared ExportDialog instance, opened by per-section trigger buttons.
	let exportDialog: {
		title: string;
		filename: string;
		headers: string[];
		rows: (string | number)[][];
	} | null = $state(null);

	function openExport(
		title: string,
		filename: string,
		headers: string[],
		rows: (string | number)[][],
	): void {
		exportDialog = { title, filename, headers, rows };
	}

	function pct(n: number, total: number): string {
		return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
	}

	// --- Sizes tab ---

	type Overlay = 'none' | 'iso-a' | 'iso-b' | 'us';
	const OVERLAY_OPTIONS: { value: Overlay; label: string }[] = [
		{ value: 'none', label: 'None' },
		{ value: 'iso-a', label: 'ISO A paper sizes' },
		{ value: 'iso-b', label: 'ISO B paper sizes' },
		{ value: 'us', label: 'US paper sizes' },
	];

	let ptOverlay = $state<Overlay>('none');
	let pdOverlay = $state<Overlay>('none');
	let ptSizesYears = $state<number | null>(15);
	let pdSizesYears = $state<number | null>(15);

	function filterByYears(
		tablets: Tablet[],
		type: 'PENTABLET' | 'PENDISPLAY',
		years: number | null,
	): Tablet[] {
		return tablets.filter((t) => {
			if (type === 'PENTABLET' && t.Model.Type !== 'PENTABLET') return false;
			if (type === 'PENDISPLAY' && t.Model.Type === 'PENTABLET') return false;
			return withinYears(t, years);
		});
	}

	function diagsOf(tablets: Tablet[]): number[] {
		return tablets
			.map((t) => {
				const d = getDiagonal(t.Digitizer?.Dimensions);
				return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
			})
			.filter((d): d is number => d !== null);
	}

	let ptSizesTablets = $derived(filterByYears(allTablets, 'PENTABLET', ptSizesYears));
	let pdSizesTablets = $derived(filterByYears(allTablets, 'PENDISPLAY', pdSizesYears));
	let ptSizesValues = $derived(diagsOf(ptSizesTablets));
	let pdSizesValues = $derived(diagsOf(pdSizesTablets));
	let ptSizesRanges = $derived(isMetric ? penTabletRangesCm : penTabletRangesIn);
	let pdSizesRanges = $derived(isMetric ? displayRangesCm : displayRangesIn);

	function paperMarkers(
		sizes: { Name: string; Width_mm: number; Height_mm: number }[],
	): HistogramMarker[] {
		return sizes.map((p) => {
			const diagMm = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			return { value: isMetric ? diagMm / 10 : diagMm * MM_TO_IN, label: p.Name };
		});
	}

	function markersFor(overlay: Overlay): HistogramMarker[] {
		switch (overlay) {
			case 'iso-a':
				return paperMarkers(isoPaperSizes.filter((p) => p.Series === 'A'));
			case 'iso-b':
				return paperMarkers(isoPaperSizes.filter((p) => p.Series === 'B'));
			case 'us':
				return paperMarkers(usPaperSizes.filter((p) => p.Series === 'Common'));
			default:
				return [];
		}
	}

	let ptMarkers = $derived(markersFor(ptOverlay));
	let pdMarkers = $derived(markersFor(pdOverlay));
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<h1>Analysis</h1>

<SectionedPage sections={sectionDefs} defaultSection="aspect-pen-tablet">
	{#snippet content(activeSection: string)}
		{#if activeSection === 'aspect-pen-tablet'}
			<section class="section">
				<h2>Pen Tablets ({penTablets.length})</h2>
				<div class="table-export">
					<button
						class="export-trigger"
						disabled={ptAR.length === 0}
						onclick={() => {
							const total = ptAR.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio: Pen Tablets',
								'analysis-aspect-ratio-pen-tablets',
								['Ratio', 'Decimal', 'Category', 'Count', '%'],
								ptAR.map((r) => [r.ratio16, r.decimal, r.category, r.count, pct(r.count, total)]),
							);
						}}>Export</button
					>
				</div>
				<table class="stat-table">
					<thead
						><tr><th>Ratio</th><th>Decimal</th><th>Category</th><th>Count</th><th></th></tr></thead
					>
					<tbody>
						{#each ptAR as row (row.ratio16 + row.category)}
							{@const pct = ((row.count / ptAR.reduce((s, r) => s + r.count, 0)) * 100).toFixed(1)}
							<tr>
								<td class="decimal">{row.ratio16}</td>
								<td class="decimal">{row.decimal}</td>
								<td class="mono">{row.category}</td>
								<td class="count">{row.count}</td>
								<td class="bar-cell">
									<div class="bar-bg"><div class="bar-fill" style="width:{pct}%"></div></div>
									<span class="pct">{pct}%</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		{#if activeSection === 'aspect-pen-tablet-by-category'}
			<section class="section">
				<h2>Pen Tablets — by Category ({penTablets.length})</h2>
				<p class="description">
					Buckets each tablet's digitizer aspect ratio into a popular ratio (16:9, 16:10, 3:2, 4:3,
					5:4, 1:1) at one of three closeness tiers (EXACT ≤ 0.005, VERYCLOSE ≤ 0.02, CLOSE ≤ 0.05),
					or OTHER.
				</p>
				<div class="table-export">
					<button
						class="export-trigger"
						disabled={ptARCat.length === 0}
						onclick={() => {
							const total = ptARCat.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio Category: Pen Tablets',
								'analysis-aspect-ratio-category-pen-tablets',
								['Category', 'Count', '%'],
								ptARCat.map((r) => [r.label, r.count, pct(r.count, total)]),
							);
						}}>Export</button
					>
				</div>
				<table class="stat-table">
					<thead><tr><th>Category</th><th>Count</th><th></th></tr></thead>
					<tbody>
						{#each ptARCat as row (row.label)}
							{@const total = ptARCat.reduce((s, r) => s + r.count, 0)}
							{@const pctVal = ((row.count / total) * 100).toFixed(1)}
							<tr>
								<td class="label mono">{row.label}</td>
								<td class="count">{row.count}</td>
								<td class="bar-cell">
									<div class="bar-bg"><div class="bar-fill" style="width:{pctVal}%"></div></div>
									<span class="pct">{pctVal}%</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		{#if activeSection === 'aspect-pen-display'}
			<section class="section">
				<h2>Pen Displays &amp; Standalones ({penDisplays.length})</h2>
				<div class="table-export">
					<button
						class="export-trigger"
						disabled={pdAR.length === 0}
						onclick={() => {
							const total = pdAR.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio: Pen Displays & Standalones',
								'analysis-aspect-ratio-pen-displays',
								['Ratio', 'Decimal', 'Category', 'Count', '%'],
								pdAR.map((r) => [r.ratio16, r.decimal, r.category, r.count, pct(r.count, total)]),
							);
						}}>Export</button
					>
				</div>
				<table class="stat-table">
					<thead
						><tr><th>Ratio</th><th>Decimal</th><th>Category</th><th>Count</th><th></th></tr></thead
					>
					<tbody>
						{#each pdAR as row (row.ratio16 + row.category)}
							{@const pct = ((row.count / pdAR.reduce((s, r) => s + r.count, 0)) * 100).toFixed(1)}
							<tr>
								<td class="decimal">{row.ratio16}</td>
								<td class="decimal">{row.decimal}</td>
								<td class="mono">{row.category}</td>
								<td class="count">{row.count}</td>
								<td class="bar-cell">
									<div class="bar-bg"><div class="bar-fill" style="width:{pct}%"></div></div>
									<span class="pct">{pct}%</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		{#if activeSection === 'aspect-pen-display-by-category'}
			<section class="section">
				<h2>Pen Displays &amp; Standalones — by Category ({penDisplays.length})</h2>
				<p class="description">
					Buckets each pen display's (or standalone's) aspect ratio into a popular ratio at one of
					three closeness tiers, or OTHER.
				</p>
				<div class="table-export">
					<button
						class="export-trigger"
						disabled={pdARCat.length === 0}
						onclick={() => {
							const total = pdARCat.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio Category: Pen Displays & Standalones',
								'analysis-aspect-ratio-category-pen-displays',
								['Category', 'Count', '%'],
								pdARCat.map((r) => [r.label, r.count, pct(r.count, total)]),
							);
						}}>Export</button
					>
				</div>
				<table class="stat-table">
					<thead><tr><th>Category</th><th>Count</th><th></th></tr></thead>
					<tbody>
						{#each pdARCat as row (row.label)}
							{@const total = pdARCat.reduce((s, r) => s + r.count, 0)}
							{@const pctVal = ((row.count / total) * 100).toFixed(1)}
							<tr>
								<td class="label mono">{row.label}</td>
								<td class="count">{row.count}</td>
								<td class="bar-cell">
									<div class="bar-bg"><div class="bar-fill" style="width:{pctVal}%"></div></div>
									<span class="pct">{pctVal}%</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		{#if activeSection === 'panel-tech'}
			<section class="section">
				<h2>Panel Technology</h2>
				<p class="description">
					{displaysWithTech.length} of {panelTechCovered} pen displays and standalones have panel tech
					data.
				</p>
				<div class="table-export">
					<button
						class="export-trigger"
						disabled={panelTechRows.length === 0}
						onclick={() =>
							openExport(
								'Panel Technology',
								'analysis-panel-tech',
								['Panel Tech', 'Count', '%'],
								panelTechRows.map((r) => [r.label, r.count, pct(r.count, panelTechTotal)]),
							)}>Export</button
					>
				</div>
				<DistributionTable labelHeader="Panel Tech" rows={panelTechRows} total={panelTechTotal} />
			</section>
		{/if}

		{#each numericSections as section (section.id)}
			{#if activeSection === section.id}
				<section class="section">
					<h2>{section.title}</h2>
					<p class="description">
						{section.data.count} of {section.pool}
						{section.poolLabel} have {section.title.toLowerCase()}
						data.
					</p>
					{#if section.histogram && section.histogram.values.length > 0}
						<ValueHistogram
							title={`${section.title} distribution`}
							subtitle={subtitleFor(section.data.tablets)}
							values={section.histogram.values}
							currentValue={null}
							ranges={section.histogram.ranges}
							unit={section.histogram.unit}
							binSize={section.histogram.binSize}
							tickStep={section.histogram.tickStep}
							showUnitInTitle={section.histogram.showUnitInTitle ?? false}
							showUnitInBands={section.histogram.showUnitInBands ?? true}
							showUnitInAxis={section.histogram.showUnitInAxis ?? true}
							bind:compareYears={yearFilters[section.id]}
							compareYearOptions={[5, 10, 15, 20, null]}
						/>
						{#if section.histogram.note}
							<p class="description histogram-note">{section.histogram.note}</p>
						{/if}
					{/if}
					{#if section.data.rows.length > 0}
						<div class="table-export">
							<button
								class="export-trigger"
								onclick={() =>
									openExport(
										section.title,
										section.filename,
										[section.title, 'Count', '%'],
										section.data.rows.map((r) => [
											Number(r.label),
											r.count,
											pct(r.count, section.data.count),
										]),
									)}>Export</button
							>
						</div>
						<DistributionTable
							labelHeader={`${section.title} (${section.unit})`}
							rows={section.data.rows}
							total={section.data.count}
							formatLabel={(l) => Number(l).toLocaleString()}
						/>
					{/if}
				</section>
			{/if}
		{/each}

		{#if activeSection === 'pressure-levels'}
			<section class="section">
				<h2>Pressure Levels</h2>
				<p class="description">
					{pressureTotal} of {allTablets.length} tablets have pressure level data.
				</p>
				<div class="table-export">
					<button
						class="export-trigger"
						disabled={pressureRows.length === 0}
						onclick={() =>
							openExport(
								'Pressure Levels',
								'analysis-pressure-levels',
								['Pressure Levels', 'Count', '%'],
								pressureRows.map((r) => [Number(r.label), r.count, pct(r.count, pressureTotal)]),
							)}>Export</button
					>
				</div>
				<DistributionTable
					labelHeader="Pressure Levels"
					rows={pressureRows}
					total={pressureTotal}
					formatLabel={(l) => Number(l).toLocaleString()}
				/>
			</section>
		{/if}

		{#if activeSection === 'touch-support'}
			<section class="section">
				<h2>Touch Support</h2>
				<p class="description">
					Distribution of {allTablets.length} tablets by digitizer touch support.
				</p>
				<div class="table-export">
					<button
						class="export-trigger"
						disabled={touchSupportRows.length === 0}
						onclick={() =>
							openExport(
								'Touch Support',
								'analysis-touch-support',
								['Touch', 'Count', '%'],
								touchSupportRows.map((r) => [r.label, r.count, pct(r.count, touchTotal)]),
							)}>Export</button
					>
				</div>
				<DistributionTable labelHeader="Touch" rows={touchSupportRows} total={touchTotal} />
			</section>
		{/if}

		{#if activeSection === 'sizes-pen-tablet'}
			<section class="section">
				<div class="section-header">
					<h2>Pen Tablet diagonal ({ptSizesValues.length})</h2>
					<label class="overlay-select">
						Overlay:
						<select bind:value={ptOverlay}>
							{#each OVERLAY_OPTIONS as opt (opt.value)}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</label>
				</div>
				<p class="description">
					Distribution of pen-tablet active-area diagonals. Use the overlay control to project
					paper-size markers onto the chart.
				</p>
				{#if ptSizesValues.length > 0}
					<ValueHistogram
						title="Pen tablet active area diagonal"
						subtitle={subtitleFor(ptSizesTablets)}
						values={ptSizesValues}
						currentValue={null}
						ranges={ptSizesRanges}
						unit={isMetric ? ' cm' : '"'}
						binSize={isMetric ? 1 : 0.5}
						bandwidthMultiplier={0.2}
						bind:compareYears={ptSizesYears}
						compareYearOptions={[5, 10, 15, 20, null]}
						markers={ptMarkers}
						showUnitInTitle
						showUnitInBands={false}
						showUnitInAxis={false}
					/>
				{/if}
			</section>
		{/if}

		{#if activeSection === 'sizes-pen-display'}
			<section class="section">
				<div class="section-header">
					<h2>Pen Display diagonal ({pdSizesValues.length})</h2>
					<label class="overlay-select">
						Overlay:
						<select bind:value={pdOverlay}>
							{#each OVERLAY_OPTIONS as opt (opt.value)}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</label>
				</div>
				<p class="description">
					Distribution of pen-display (and standalone) active-area diagonals. Use the overlay
					control to project paper-size markers onto the chart.
				</p>
				{#if pdSizesValues.length > 0}
					<ValueHistogram
						title="Pen display active area diagonal"
						subtitle={subtitleFor(pdSizesTablets)}
						values={pdSizesValues}
						currentValue={null}
						ranges={pdSizesRanges}
						unit={isMetric ? ' cm' : '"'}
						binSize={isMetric ? 1 : 0.5}
						bandwidthMultiplier={0.2}
						bind:compareYears={pdSizesYears}
						compareYearOptions={[5, 10, 15, 20, null]}
						markers={pdMarkers}
						showUnitInTitle
						showUnitInBands={false}
						showUnitInAxis={false}
					/>
				{/if}
			</section>
		{/if}
	{/snippet}
</SectionedPage>

{#if exportDialog}
	<ExportDialog
		entityType="analysis"
		title={exportDialog.title}
		filename={exportDialog.filename}
		headers={exportDialog.headers}
		rows={exportDialog.rows}
		onclose={() => (exportDialog = null)}
	/>
{/if}

<style>
	h1 {
		margin-bottom: 16px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 8px;
	}
	.section-header h2 {
		margin: 0;
	}

	.table-export {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	.export-trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}
	.export-trigger:hover {
		border-color: var(--text-dim);
		color: var(--text);
	}
	.export-trigger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.overlay-select {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.overlay-select select {
		font-size: 12px;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}

	.section {
		margin-bottom: 32px;
	}

	h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
	}

	.description {
		font-size: 13px;
		color: var(--text-dim);
		margin-bottom: 8px;
	}

	/* .stat-table / .label / .count / .bar-cell / .bar-bg / .bar-fill / .pct
		 styles now live in DistributionTable.svelte's :global() block. The
		 bespoke aspect-ratio tables on this page still use those class names
		 directly. */
</style>
