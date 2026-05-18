<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import DistributionTable from '$lib/components/DistributionTable.svelte';
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
	} from '$lib/spec-bands.js';

	let { data } = $props();
	let allTablets: Tablet[] = $derived(data.allTablets ?? []);
	let isoPaperSizes: ISOPaperSize[] = $derived(data.isoPaperSizes ?? []);
	let usPaperSizes: USPaperSize[] = $derived(data.usPaperSizes ?? []);
	let isMetric = $derived($unitPreference === 'metric');

	interface SectionDef {
		id: string;
		category: string;
		label: string;
	}

	// Source of truth for the navigation tree. Same pattern as the
	// Data Quality page (src/routes/data-quality/+page.svelte) — each
	// entry is one tree leaf, grouped under a category heading.
	const sectionDefs: SectionDef[] = [
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

	const sectionIds = new Set(sectionDefs.map((s) => s.id));
	const defaultSection = 'aspect-pen-tablet';

	const groupedSections: [string, SectionDef[]][] = (() => {
		const map = new Map<string, SectionDef[]>();
		for (const s of sectionDefs) {
			if (!map.has(s.category)) map.set(s.category, []);
			map.get(s.category)!.push(s);
		}
		return [...map.entries()];
	})();

	let activeSection: string = $derived.by(() => {
		const hash = page.url.hash.slice(1);
		return sectionIds.has(hash) ? hash : defaultSection;
	});

	function setSection(id: string) {
		// page.url.pathname is already resolved (includes base path).
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}#${id}`, {
			replaceState: false,
			noScroll: true,
		});
	}

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

	let brightnessData = $derived(
		numericDisplayRows((t) => t.Display?.Brightness, yearFilters['display-brightness']),
	);
	let contrastData = $derived(
		numericDisplayRows((t) => t.Display?.Contrast, yearFilters['display-contrast']),
	);
	let refreshData = $derived(
		numericDisplayRows((t) => t.Display?.RefreshRate, yearFilters['display-refresh-rate']),
	);
	let responseData = $derived(
		numericDisplayRows((t) => t.Display?.ResponseTime, yearFilters['display-response-time']),
	);
	let bitDepthData = $derived(
		numericDisplayRows((t) => t.Display?.ColorBitDepth, yearFilters['display-bit-depth']),
	);

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

	let brightnessValues = $derived(
		rawNumericDisplayValues(
			(t) => t.Display?.Brightness,
			undefined,
			yearFilters['display-brightness'],
		),
	);
	let contrastValues = $derived(
		rawNumericDisplayValues((t) => t.Display?.Contrast, 3500, yearFilters['display-contrast']),
	);
	let responseValues = $derived(
		rawNumericDisplayValues(
			(t) => t.Display?.ResponseTime,
			30,
			yearFilters['display-response-time'],
		),
	);

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

	let densityData = $derived(
		numericTabletRows((t) => t.Digitizer?.Density, yearFilters['digitizer-density']),
	);
	let accuracyCenterData = $derived(
		numericTabletRows((t) => t.Digitizer?.AccuracyCenter, yearFilters['digitizer-accuracy-center']),
	);
	let accuracyCornerData = $derived(
		numericTabletRows((t) => t.Digitizer?.AccuracyCorner, yearFilters['digitizer-accuracy-corner']),
	);
	let reportRateData = $derived(
		numericTabletRows((t) => t.Digitizer?.ReportRate, yearFilters['digitizer-report-rate']),
	);

	let densityValues = $derived(
		rawNumericTabletValues((t) => t.Digitizer?.Density, 300, yearFilters['digitizer-density']),
	);
	let accuracyCenterValues = $derived(
		rawNumericTabletValues(
			(t) => t.Digitizer?.AccuracyCenter,
			2,
			yearFilters['digitizer-accuracy-center'],
		),
	);
	let accuracyCornerValues = $derived(
		rawNumericTabletValues(
			(t) => t.Digitizer?.AccuracyCorner,
			5,
			yearFilters['digitizer-accuracy-corner'],
		),
	);
	let reportRateValues = $derived(
		rawNumericTabletValues(
			(t) => t.Digitizer?.ReportRate,
			undefined,
			yearFilters['digitizer-report-rate'],
		),
	);

	const DISPLAY_POOL_LABEL = 'pen displays and standalones';
	const TABLET_POOL_LABEL = 'tablets';

	let numericSections = $derived([
		{
			id: 'display-brightness',
			title: 'Brightness',
			unit: 'cd/m²',
			filename: 'analysis-brightness',
			data: brightnessData,
			pool: penDisplays.length,
			poolLabel: DISPLAY_POOL_LABEL,
			histogram: {
				values: brightnessValues,
				ranges: BRIGHTNESS_RANGES,
				unit: ' cd/m²',
				binSize: 25,
				tickStep: 50,
				showUnitInTitle: true,
				showUnitInBands: false,
				showUnitInAxis: false,
				note: undefined as string | undefined,
			},
		},
		{
			id: 'display-contrast',
			title: 'Contrast',
			unit: ':1',
			filename: 'analysis-contrast',
			data: contrastData,
			pool: penDisplays.length,
			poolLabel: DISPLAY_POOL_LABEL,
			histogram: {
				values: contrastValues,
				ranges: CONTRAST_RANGES,
				unit: ':1',
				binSize: 100,
				tickStep: 500,
				note: 'OLED panels reporting 100,000:1 (~3% of records) are excluded from the histogram so the linear scale stays readable; they remain in the table below.',
			},
		},
		{
			id: 'display-refresh-rate',
			title: 'Refresh Rate',
			unit: 'Hz',
			filename: 'analysis-refresh-rate',
			data: refreshData,
			pool: penDisplays.length,
			poolLabel: DISPLAY_POOL_LABEL,
			histogram: null as null | {
				values: number[];
				ranges: typeof BRIGHTNESS_RANGES;
				unit: string;
				binSize: number;
				tickStep?: number;
				showUnitInTitle?: boolean;
				showUnitInBands?: boolean;
				showUnitInAxis?: boolean;
				note?: string;
			},
		},
		{
			id: 'display-response-time',
			title: 'Response Time',
			unit: 'ms',
			filename: 'analysis-response-time',
			data: responseData,
			pool: penDisplays.length,
			poolLabel: DISPLAY_POOL_LABEL,
			histogram: {
				values: responseValues,
				ranges: RESPONSE_TIME_RANGES,
				unit: ' ms',
				binSize: 1,
				showUnitInTitle: true,
				showUnitInBands: false,
				showUnitInAxis: false,
				note: undefined as string | undefined,
			},
		},
		{
			id: 'display-bit-depth',
			title: 'Bit Depth',
			unit: 'bit',
			filename: 'analysis-bit-depth',
			data: bitDepthData,
			pool: penDisplays.length,
			poolLabel: DISPLAY_POOL_LABEL,
			histogram: null,
		},
		{
			id: 'digitizer-density',
			title: 'Density',
			unit: 'LPmm',
			filename: 'analysis-digitizer-density',
			data: densityData,
			pool: allTablets.length,
			poolLabel: TABLET_POOL_LABEL,
			histogram: {
				values: densityValues,
				ranges: DENSITY_RANGES,
				unit: ' LPmm',
				binSize: 10,
				tickStep: 50,
				showUnitInTitle: true,
				showUnitInBands: false,
				showUnitInAxis: false,
				note: 'Values above 300 LPmm are excluded from the histogram for scale; they remain in the table below.',
			},
		},
		{
			id: 'digitizer-accuracy-center',
			title: 'Accuracy (Center)',
			unit: 'mm',
			filename: 'analysis-digitizer-accuracy-center',
			data: accuracyCenterData,
			pool: allTablets.length,
			poolLabel: TABLET_POOL_LABEL,
			histogram: {
				values: accuracyCenterValues,
				ranges: ACCURACY_CENTER_RANGES,
				unit: ' mm',
				binSize: 0.1,
				tickStep: 0.25,
				showUnitInTitle: true,
				showUnitInBands: false,
				showUnitInAxis: false,
				note: undefined as string | undefined,
			},
		},
		{
			id: 'digitizer-accuracy-corner',
			title: 'Accuracy (Corner)',
			unit: 'mm',
			filename: 'analysis-digitizer-accuracy-corner',
			data: accuracyCornerData,
			pool: allTablets.length,
			poolLabel: TABLET_POOL_LABEL,
			histogram: {
				values: accuracyCornerValues,
				ranges: ACCURACY_CORNER_RANGES,
				unit: ' mm',
				binSize: 0.25,
				showUnitInTitle: true,
				showUnitInBands: false,
				showUnitInAxis: false,
				note: undefined as string | undefined,
			},
		},
		{
			id: 'digitizer-report-rate',
			title: 'Report Rate',
			unit: 'Hz',
			filename: 'analysis-digitizer-report-rate',
			data: reportRateData,
			pool: allTablets.length,
			poolLabel: TABLET_POOL_LABEL,
			histogram: {
				values: reportRateValues,
				ranges: REPORT_RATE_RANGES,
				unit: ' Hz',
				binSize: 20,
				tickStep: 50,
				showUnitInTitle: true,
				showUnitInBands: false,
				showUnitInAxis: false,
				note: undefined as string | undefined,
			},
		},
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

	const currentYear = new Date().getFullYear();

	function filterByYears(
		tablets: Tablet[],
		type: 'PENTABLET' | 'PENDISPLAY',
		years: number | null,
	): Tablet[] {
		return tablets.filter((t) => {
			if (type === 'PENTABLET' && t.Model.Type !== 'PENTABLET') return false;
			if (type === 'PENDISPLAY' && t.Model.Type === 'PENTABLET') return false;
			if (years !== null) {
				const y = parseInt(t.Model.LaunchYear, 10);
				if (!isNaN(y) && y < currentYear - years) return false;
			}
			return true;
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

<div class="tree-layout">
	<nav class="tree-pane" aria-label="Analysis sections">
		{#each groupedSections as [category, items] (category)}
			<div class="tree-cat">
				<div class="tree-cat-label">{category}</div>
				<ul>
					{#each items as item (item.id)}
						<li>
							<button
								type="button"
								class:active={activeSection === item.id}
								onclick={() => setSection(item.id)}
							>
								<span class="tree-label">{item.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<main class="tree-content">
		{#if activeSection === 'aspect-pen-tablet'}
			<section class="section">
				<div class="section-header">
					<h2>Pen Tablets ({penTablets.length})</h2>
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
				<div class="section-header">
					<h2>Pen Tablets — by Category ({penTablets.length})</h2>
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
				<p class="description">
					Buckets each tablet's digitizer aspect ratio into a popular ratio (16:9, 16:10, 3:2, 4:3,
					5:4, 1:1) at one of three closeness tiers (EXACT ≤ 0.005, VERYCLOSE ≤ 0.02, CLOSE ≤ 0.05),
					or OTHER.
				</p>
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
				<div class="section-header">
					<h2>Pen Displays &amp; Standalones ({penDisplays.length})</h2>
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
				<div class="section-header">
					<h2>Pen Displays &amp; Standalones — by Category ({penDisplays.length})</h2>
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
				<p class="description">
					Buckets each pen display's (or standalone's) aspect ratio into a popular ratio at one of
					three closeness tiers, or OTHER.
				</p>
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
				<div class="section-header">
					<h2>Panel Technology</h2>
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
				<p class="description">
					{displaysWithTech.length} of {panelTechCovered} pen displays and standalones have panel tech
					data.
				</p>
				<DistributionTable labelHeader="Panel Tech" rows={panelTechRows} total={panelTechTotal} />
			</section>
		{/if}

		{#each numericSections as section (section.id)}
			{#if activeSection === section.id}
				<section class="section">
					<div class="section-header">
						<h2>{section.title}</h2>
						<button
							class="export-trigger"
							disabled={section.data.rows.length === 0}
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
				<div class="section-header">
					<h2>Pressure Levels</h2>
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
				<p class="description">
					{pressureTotal} of {allTablets.length} tablets have pressure level data.
				</p>
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
				<div class="section-header">
					<h2>Touch Support</h2>
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
				<p class="description">
					Distribution of {allTablets.length} tablets by digitizer touch support.
				</p>
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
	</main>
</div>

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

	.tree-layout {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}

	.tree-pane {
		flex: 0 0 240px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		border-right: 1px solid var(--border, #e0e0e0);
		padding: 4px 12px 4px 0;
		font-size: 13px;
	}

	.tree-content {
		flex: 1;
		min-width: 0;
	}

	.tree-cat {
		margin-bottom: 14px;
	}

	.tree-cat-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted, #888);
		padding: 0 8px;
		margin-bottom: 4px;
	}

	.tree-cat ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tree-cat li {
		margin: 0;
	}

	.tree-cat button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 5px 10px;
		font-size: 13px;
		text-align: left;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--text, #333);
		cursor: pointer;
		line-height: 1.3;
	}

	.tree-cat button:hover {
		background: #eff6ff;
		color: #2563eb;
	}

	.tree-cat button.active {
		background: #dbeafe;
		color: #1e40af;
		font-weight: 600;
	}

	.tree-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
