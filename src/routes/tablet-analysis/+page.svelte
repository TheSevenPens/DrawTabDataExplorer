<script lang="ts">
	import { createExportDialogHost } from '$lib/export-dialog-host.svelte.js';
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import { flaggedCount } from '$lib/flagged-store.js';
	import {
		getDiagonal,
		brandName,
		type Tablet,
		type ISOPaperSize,
		type USPaperSize,
	} from '$data/lib/drawtab-loader.js';
	import { unitPreference } from '$lib/unit-store.js';
	import {
		penTabletRangesCm,
		penTabletRangesIn,
		displayRangesCm,
		displayRangesIn,
		MM_TO_IN,
		MM_TO_CM,
	} from '$lib/tablet-size-ranges.js';
	import type { HistogramMarker } from '$lib/components/ValueHistogram.svelte';
	import {
		arRows,
		arCategoryRows,
		countBy,
		filterByYears,
		pct,
		metricRankRows,
		rankBrands,
		TABLET_TYPE_OPTIONS,
		digitizerDensity,
		displayPpi,
		touchTabletRows,
		type TabletTypeValue,
	} from '$lib/tablet-analysis/helpers.js';
	import { ANALYSIS_METRICS, buildAnalysisSections } from '$lib/tablet-analysis/metric-configs.js';
	import AspectRatioRatioSection from '$lib/tablet-analysis/AspectRatioRatioSection.svelte';
	import AspectRatioCategorySection from '$lib/tablet-analysis/AspectRatioCategorySection.svelte';
	import NumericMetricSection from '$lib/tablet-analysis/NumericMetricSection.svelte';
	import PanelTechSection from '$lib/tablet-analysis/PanelTechSection.svelte';
	import PressureLevelsSection from '$lib/tablet-analysis/PressureLevelsSection.svelte';
	import TouchSupportSection from '$lib/tablet-analysis/TouchSupportSection.svelte';
	import TabletDiagonalSection from '$lib/tablet-analysis/TabletDiagonalSection.svelte';
	import PowerOverviewSection from '$lib/tablet-analysis/PowerOverviewSection.svelte';
	import {
		inputSourceRows,
		maxConsumptionWatts,
		consumptionWatts,
		powerCoverage,
		ratedInputWatts,
		standbyWatts,
	} from '$lib/power.js';
	import RankedMetricSection, {
		type RankedMetric,
	} from '$lib/tablet-analysis/RankedMetricSection.svelte';
	import TypeBrandSelects from '$lib/tablet-analysis/TypeBrandSelects.svelte';
	import {
		defaultRankFilters,
		metricTabAliases,
		parseMetricNumber,
		type RankFilters,
	} from '$lib/tablet-analysis/metric-tabs.js';
	import type { NumericSection } from '$lib/tablet-analysis/numeric-sections.js';
	import { tabletSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let tabletTabs = $derived(tabletSubNavTabs({ flaggedCount: $flaggedCount }));

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
		{ id: 'display-pixel-density', category: 'Display Tech', label: 'Pixel Density' },
		{ id: 'display-bit-depth', category: 'Display Tech', label: 'Bit Depth' },
		{ id: 'pressure-levels', category: 'Tablet Features', label: 'Pressure Levels' },
		{ id: 'touch-support', category: 'Tablet Features', label: 'Touch Support' },
		{ id: 'power-overview', category: 'Power', label: 'Overview' },
		{ id: 'power-display-consumption', category: 'Power', label: 'Pen Display Consumption' },
		{ id: 'power-display-standby', category: 'Power', label: 'Pen Display Standby' },
		{ id: 'power-display-input', category: 'Power', label: 'Pen Display Rated Input' },
		{ id: 'power-tablet-consumption', category: 'Power', label: 'Pen Tablet Consumption' },
		{ id: 'power-tablet-input', category: 'Power', label: 'Pen Tablet Rated Input' },
		{ id: 'sizes-pen-tablet', category: 'Sizes', label: 'Pen Tablet diagonal' },
		{ id: 'sizes-pen-display', category: 'Sizes', label: 'Pen Display diagonal' },
	];

	// --- Aspect Ratio ---

	let penTablets = $derived(allTablets.filter((t) => t.Model.Type === 'PENTABLET'));
	let penDisplays = $derived(
		allTablets.filter((t) => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE'),
	);

	let ptAR = $derived(arRows(penTablets));
	let pdAR = $derived(arRows(penDisplays));
	let ptARCat = $derived(arCategoryRows(penTablets));
	let pdARCat = $derived(arCategoryRows(penDisplays));

	// --- Panel Tech ---

	let displaysWithTech = $derived(penDisplays.filter((t) => t.Display?.PanelTech != null));
	let panelTechRows = $derived(countBy(displaysWithTech, (t) => t.Display!.PanelTech!));
	let panelTechTotal = $derived(displaysWithTech.length);
	let panelTechCovered = $derived(penDisplays.length);

	// --- Numeric sections ---

	// Per-section "tablets released within N years" filter. `null` = no filter.
	// One entry per numericSections id; the value is two-way-bound through
	// ValueHistogram's compareYears dropdown.
	let yearFilters = $state<Record<string, number | null>>(
		Object.fromEntries(ANALYSIS_METRICS.map((m) => [m.id, null])),
	);

	// Type and brand dropdowns on the Pixel Density chart. '' = all.
	const DISPLAY_TYPE_OPTIONS = TABLET_TYPE_OPTIONS.filter((o) => o.value !== 'PENTABLET');
	let ppiChartType = $state('');
	let ppiChartBrand = $state('');

	// Type and brand dropdowns on the Report Rate chart. '' = all.
	let reportRateChartType = $state('');
	let reportRateChartBrand = $state('');
	let reportRateBrands = $derived(
		rankBrands(
			allTablets
				.filter((t) => t.Digitizer?.ReportRate != null && t.Digitizer.ReportRate !== '')
				.map((t) => ({ brand: t.Model.Brand as string })),
			brandName,
		),
	);

	let numericSections = $derived(
		buildAnalysisSections(allTablets, penDisplays, yearFilters, {
			'display-pixel-density': { type: ppiChartType, brand: ppiChartBrand },
			'digitizer-report-rate': { type: reportRateChartType, brand: reportRateChartBrand },
		}),
	);

	// --- Ranked metrics: Distribution / Lowest / Highest tabs ---
	//
	// A section listed here renders as one section with three tabs
	// (RankedMetricSection): its chart, then its lowest and highest tablets.
	// To give another attribute the same treatment, add its RankedMetric
	// config to `rankedMetrics`; its tabs, hash links and filter state follow.
	//
	// The rankings ignore the chart's compare-years and type/brand controls:
	// each ranking tab has its own filters, over every tablet in the pool.

	/** A tablet's value for one of the numeric section configs, or null. */
	function configNumber(id: string): (t: Tablet) => number | null {
		const cfg = ANALYSIS_METRICS.find((m) => m.id === id);
		if (!cfg) throw new Error(`No analysis metric ${id}`);
		return (t) => parseMetricNumber(cfg.getValue(t));
	}

	/** One ranking config over `pool`; `rows`/`brands` filled in from it. */
	function ranked(
		pool: Tablet[],
		getValue: (t: Tablet) => number | null,
		cfg: Omit<RankedMetric, 'rows' | 'brands'>,
	): RankedMetric {
		const rows = metricRankRows(pool, getValue);
		return { ...cfg, rows, brands: rankBrands(rows, brandName) };
	}

	const DISPLAYS_NOTE = 'Pen displays and standalones';

	/** Active-area diagonal in the current unit, or null. */
	function diagonalInUnit(t: Tablet): number | null {
		const d = getDiagonal(t.Digitizer?.Dimensions);
		return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
	}

	// --- Power ---
	// Pen tablets and pen displays are ranked separately (their power is an
	// order of magnitude apart), and input rating separately from consumption.

	let powerPenDisplays = $derived(allTablets.filter((t) => t.Model.Type === 'PENDISPLAY'));
	let powerRankedMetrics: Record<string, RankedMetric> = $derived({
		'power-display-consumption': ranked(powerPenDisplays, maxConsumptionWatts, {
			id: 'power-display-consumption',
			title: 'Max Consumption',
			description:
				'Pen displays ranked by stated maximum power consumption: what the display draws at full brightness, as the manufacturer states it. This is draw, not the input rating.',
			emptyText: 'No pen displays with a recorded maximum consumption.',
			valueLabel: 'Max Consumption',
			unit: 'W',
			format: (v) => String(v),
		}),
		'power-display-standby': ranked(powerPenDisplays, standbyWatts, {
			id: 'power-display-standby',
			title: 'Standby Power',
			description: 'Pen displays ranked by stated standby power. Lower is better.',
			emptyText: 'No pen displays with a recorded standby power.',
			valueLabel: 'Standby',
			unit: 'W',
			format: (v) => String(v),
		}),
		'power-display-input': ranked(powerPenDisplays, ratedInputWatts, {
			id: 'power-display-input',
			title: 'Rated Input',
			description:
				'Pen displays ranked by rated input power: the stated input watts, or input voltage × input current. This is what the power input accepts, a ceiling the supply must meet, not what the display draws. Displays with a voltage but no current have no rating and are not ranked.',
			emptyText: 'No pen displays with a recorded input voltage and current.',
			valueLabel: 'Rated Input',
			unit: 'W',
			format: (v) => String(v),
		}),
		'power-tablet-consumption': ranked(penTablets, consumptionWatts, {
			id: 'power-tablet-consumption',
			title: 'Consumption',
			description:
				'Pen tablets ranked by stated typical power consumption. This is draw, not the input rating.',
			emptyText: 'No pen tablets with a recorded consumption.',
			valueLabel: 'Consumption',
			unit: 'W',
			format: (v) => String(v),
		}),
		'power-tablet-input': ranked(penTablets, ratedInputWatts, {
			id: 'power-tablet-input',
			title: 'Rated Input',
			description:
				'Pen tablets ranked by rated input power: input voltage × input current. This is what the input accepts, not what the tablet draws.',
			emptyText: 'No pen tablets with a recorded input voltage and current.',
			valueLabel: 'Rated Input',
			unit: 'W',
			format: (v) => String(v),
		}),
	});

	let powerCoverageRows = $derived(powerCoverage(penTablets, powerPenDisplays));
	let standalones = $derived(allTablets.filter((t) => t.Model.Type === 'STANDALONE'));

	function exportPowerCoverage() {
		openExport(
			'Power data coverage',
			'analysis-power-coverage',
			['Field', 'Kind', 'Pen tablets', 'Pen tablets %', 'Pen displays', 'Pen displays %'],
			powerCoverageRows.map((r) => [
				r.label,
				r.kind,
				r.penTablets,
				pct(r.penTablets, penTablets.length),
				r.penDisplays,
				pct(r.penDisplays, powerPenDisplays.length),
			]),
		);
	}

	let rankedMetrics: Record<string, RankedMetric> = $derived({
		'digitizer-density': ranked(allTablets, digitizerDensity, {
			id: 'digitizer-density',
			title: 'Digitizer Density',
			description:
				'Tablets ranked by digitizer density (lines per mm). Higher density gives finer positional resolution under the pen tip.',
			emptyText: 'No tablets with a recorded digitizer density.',
			valueLabel: 'Density',
			unit: 'LPmm',
			format: (v) => String(v),
		}),
		'digitizer-report-rate': ranked(allTablets, configNumber('digitizer-report-rate'), {
			id: 'digitizer-report-rate',
			title: 'Report Rate',
			description:
				'Tablets ranked by report rate: how many pen positions per second the digitizer sends. A higher rate tracks fast strokes more smoothly.',
			emptyText: 'No tablets with a recorded report rate.',
			types: TABLET_TYPE_OPTIONS,
			valueLabel: 'Report Rate',
			unit: 'Hz',
			format: (v) => v.toLocaleString(),
		}),
		'display-brightness': ranked(penDisplays, configNumber('display-brightness'), {
			id: 'display-brightness',
			title: 'Brightness',
			description: `${DISPLAYS_NOTE} ranked by rated panel brightness.`,
			emptyText: 'No pen displays with a recorded brightness.',
			types: DISPLAY_TYPE_OPTIONS,
			valueLabel: 'Brightness',
			unit: 'cd/m²',
			format: (v) => v.toLocaleString(),
		}),
		'display-contrast': ranked(penDisplays, configNumber('display-contrast'), {
			id: 'display-contrast',
			title: 'Contrast',
			description: `${DISPLAYS_NOTE} ranked by rated contrast ratio. OLED panels rated 100,000:1 fill the top of the Highest list.`,
			emptyText: 'No pen displays with a recorded contrast ratio.',
			types: DISPLAY_TYPE_OPTIONS,
			valueLabel: 'Contrast',
			unit: ':1',
			format: (v) => v.toLocaleString(),
		}),
		'display-refresh-rate': ranked(penDisplays, configNumber('display-refresh-rate'), {
			id: 'display-refresh-rate',
			title: 'Refresh Rate',
			description: `${DISPLAYS_NOTE} ranked by panel refresh rate.`,
			emptyText: 'No pen displays with a recorded refresh rate.',
			types: DISPLAY_TYPE_OPTIONS,
			valueLabel: 'Refresh Rate',
			unit: 'Hz',
			format: (v) => v.toLocaleString(),
		}),
		'display-response-time': ranked(penDisplays, configNumber('display-response-time'), {
			id: 'display-response-time',
			title: 'Response Time',
			description: `${DISPLAYS_NOTE} ranked by rated panel response time. Lower is faster, so the best panels are on the Lowest tab.`,
			emptyText: 'No pen displays with a recorded response time.',
			types: DISPLAY_TYPE_OPTIONS,
			valueLabel: 'Response Time',
			unit: 'ms',
			format: (v) => String(v),
		}),
		'display-bit-depth': ranked(penDisplays, configNumber('display-bit-depth'), {
			id: 'display-bit-depth',
			title: 'Bit Depth',
			description: `${DISPLAYS_NOTE} ranked by native panel bit depth per colour channel (before any FRC dithering).`,
			emptyText: 'No pen displays with a recorded bit depth.',
			types: DISPLAY_TYPE_OPTIONS,
			valueLabel: 'Bit Depth',
			unit: 'bit',
			format: (v) => String(v),
		}),
		'display-pixel-density': ranked(penDisplays, displayPpi, {
			id: 'display-pixel-density',
			title: 'Pixel Density',
			description:
				'Pen displays and standalones ranked by pixel density: horizontal resolution over active-area width, in pixels per inch. Higher density gives sharper lines and text at the same viewing distance.',
			emptyText: 'No pen displays with a recorded resolution and active-area width.',
			types: DISPLAY_TYPE_OPTIONS,
			valueLabel: 'Pixel Density',
			unit: 'PPI',
			format: (v) => v.toFixed(1),
		}),
		'sizes-pen-tablet': ranked(penTablets, diagonalInUnit, {
			id: 'sizes-pen-tablet',
			title: 'pen tablets by diagonal',
			lowLabel: 'Smallest',
			highLabel: 'Largest',
			filenameBase: 'analysis-pen-tablet-diagonal',
			description:
				'Pen tablets ranked by active-area diagonal, across every pen tablet with recorded dimensions.',
			emptyText: 'No pen tablets with recorded active-area dimensions.',
			valueLabel: 'Diagonal',
			unit: isMetric ? 'cm' : 'in',
			format: (v) => v.toFixed(1),
		}),
		// Standalones (iPads and the like) are left out of the ranking: they
		// dominated the smallest end and are not pen displays in the sense
		// this table is comparing. The chart still includes them.
		'sizes-pen-display': ranked(
			penDisplays.filter((t) => t.Model.Type === 'PENDISPLAY'),
			diagonalInUnit,
			{
				id: 'sizes-pen-display',
				title: 'pen displays by diagonal',
				lowLabel: 'Smallest',
				highLabel: 'Largest',
				filenameBase: 'analysis-pen-display-diagonal',
				description:
					'Pen displays ranked by active-area diagonal, across every pen display with recorded dimensions. Standalone tablets are excluded, though the chart includes them.',
				emptyText: 'No pen displays with recorded active-area dimensions.',
				valueLabel: 'Diagonal',
				unit: isMetric ? 'cm' : 'in',
				format: (v) => v.toFixed(1),
			},
		),
		...powerRankedMetrics,
	});

	// The chart's Type / Brand dropdowns on Pixel Density list the brands in
	// its pool, the same list its ranking tabs use.
	let ppiBrands = $derived(rankedMetrics['display-pixel-density'].brands);

	const RANKED_IDS = [
		'digitizer-density',
		'digitizer-report-rate',
		'display-brightness',
		'display-contrast',
		'display-refresh-rate',
		'display-response-time',
		'display-bit-depth',
		'display-pixel-density',
		'sizes-pen-tablet',
		'sizes-pen-display',
		'power-display-consumption',
		'power-display-standby',
		'power-display-input',
		'power-tablet-consumption',
		'power-tablet-input',
	];

	// Lowest / Highest filters per ranked metric. Page-level so they survive
	// switching sections.
	let rankFilters = $state<Record<string, RankFilters>>(
		Object.fromEntries(RANKED_IDS.map((id) => [id, defaultRankFilters()])),
	);

	const sectionAliases = metricTabAliases(RANKED_IDS);

	// --- Pressure Levels ---

	let tabletsWithPressure = $derived(allTablets.filter((t) => t.Digitizer?.PressureLevels != null));
	let pressureRows = $derived(
		countBy(tabletsWithPressure, (t) => t.Digitizer!.PressureLevels!).sort(
			(a, b) => Number(a.label) - Number(b.label),
		),
	);
	let pressureTotal = $derived(tabletsWithPressure.length);

	// --- Touch Support ---

	const TOUCH_ORDER = ['YES', 'NO', '(not specified)'];

	let touchSupportRows = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const t of allTablets) {
			const v = t.OtherInputs?.Touch;
			const key = v === 'YES' || v === 'NO' ? v : '(not specified)';
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return TOUCH_ORDER.filter((k) => counts.has(k)).map((k) => ({
			label: k,
			count: counts.get(k)!,
		}));
	});

	let touchTotal = $derived(touchSupportRows.reduce((s, r) => s + r.count, 0));

	// Device-type filter for the touch-support listing. STANDALONE is off by
	// default: every standalone pen computer supports touch, so including them
	// swamps the list with rows that carry no information.
	let touchTypes = $state<Set<TabletTypeValue>>(new Set(['PENTABLET', 'PENDISPLAY']));

	let touchTablets = $derived(touchTabletRows(allTablets, touchTypes, brandName));

	// --- Export dialog (shared) ---

	const exportHost = createExportDialogHost();
	const openExport = exportHost.open;

	// --- Sizes ---

	type Overlay = 'none' | 'iso-a' | 'iso-b' | 'us';

	let ptOverlay = $state<Overlay>('none');
	let pdOverlay = $state<Overlay>('none');
	let ptSizesYears = $state<number | null>(15);
	let pdSizesYears = $state<number | null>(15);

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

{#snippet ppiChartControls()}
	<div class="rank-controls">
		<div class="controls-left">
			<TypeBrandSelects
				types={DISPLAY_TYPE_OPTIONS}
				type={ppiChartType}
				onTypeChange={(t) => (ppiChartType = t)}
				brands={ppiBrands}
				brand={ppiChartBrand}
				onBrandChange={(b) => (ppiChartBrand = b)}
			/>
		</div>
	</div>
{/snippet}

{#snippet reportRateChartControls()}
	<div class="rank-controls">
		<div class="controls-left">
			<TypeBrandSelects
				types={TABLET_TYPE_OPTIONS}
				type={reportRateChartType}
				onTypeChange={(t) => (reportRateChartType = t)}
				brands={reportRateBrands}
				brand={reportRateChartBrand}
				onBrandChange={(b) => (reportRateChartBrand = b)}
			/>
		</div>
	</div>
{/snippet}

{#snippet numericBody(section: NumericSection, headless: boolean)}
	<NumericMetricSection
		{section}
		{headless}
		controls={section.id === 'display-pixel-density'
			? ppiChartControls
			: section.id === 'digitizer-report-rate'
				? reportRateChartControls
				: undefined}
		bind:compareYears={yearFilters[section.id]}
		onExport={() =>
			openExport(
				section.title,
				section.filename,
				[section.title, 'Count', '%'],
				section.data.rows.map((r) => [Number(r.label), r.count, pct(r.count, section.data.count)]),
			)}
	/>
{/snippet}

<ChromeLayout subNavTabs={tabletTabs}>
	<h1 class="sr-only">Analysis</h1>

	<SectionedPage sections={sectionDefs} defaultSection="aspect-pen-tablet" aliases={sectionAliases}>
		{#snippet content(activeSection: string)}
			{#if activeSection === 'aspect-pen-tablet'}
				<section class="section">
					<AspectRatioRatioSection
						title="Pen Tablets ({penTablets.length})"
						rows={ptAR}
						onExport={() => {
							const total = ptAR.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio: Pen Tablets',
								'analysis-aspect-ratio-pen-tablets',
								['Ratio', 'Decimal', 'Category', 'Count', '%'],
								ptAR.map((r) => [r.ratio16, r.decimal, r.category, r.count, pct(r.count, total)]),
							);
						}}
					/>
				</section>
			{:else if activeSection === 'aspect-pen-tablet-by-category'}
				<section class="section">
					<AspectRatioCategorySection
						title="Pen Tablets — by Category ({penTablets.length})"
						description="Buckets each tablet’s digitizer aspect ratio into a popular ratio (16:9, 16:10, 3:2, 4:3, 5:4, 1:1) at one of three closeness tiers (EXACT ≤ 0.005, VERYCLOSE ≤ 0.02, CLOSE ≤ 0.05), or OTHER."
						rows={ptARCat}
						onExport={() => {
							const total = ptARCat.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio Category: Pen Tablets',
								'analysis-aspect-ratio-category-pen-tablets',
								['Category', 'Count', '%'],
								ptARCat.map((r) => [r.label, r.count, pct(r.count, total)]),
							);
						}}
					/>
				</section>
			{:else if activeSection === 'aspect-pen-display'}
				<section class="section">
					<AspectRatioRatioSection
						title="Pen Displays & Standalones ({penDisplays.length})"
						rows={pdAR}
						onExport={() => {
							const total = pdAR.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio: Pen Displays & Standalones',
								'analysis-aspect-ratio-pen-displays',
								['Ratio', 'Decimal', 'Category', 'Count', '%'],
								pdAR.map((r) => [r.ratio16, r.decimal, r.category, r.count, pct(r.count, total)]),
							);
						}}
					/>
				</section>
			{:else if activeSection === 'aspect-pen-display-by-category'}
				<section class="section">
					<AspectRatioCategorySection
						title="Pen Displays & Standalones — by Category ({penDisplays.length})"
						description="Buckets each pen display’s (or standalone’s) aspect ratio into a popular ratio at one of three closeness tiers, or OTHER."
						rows={pdARCat}
						onExport={() => {
							const total = pdARCat.reduce((s, r) => s + r.count, 0);
							openExport(
								'Aspect Ratio Category: Pen Displays & Standalones',
								'analysis-aspect-ratio-category-pen-displays',
								['Category', 'Count', '%'],
								pdARCat.map((r) => [r.label, r.count, pct(r.count, total)]),
							);
						}}
					/>
				</section>
			{:else if activeSection === 'panel-tech'}
				<section class="section">
					<PanelTechSection
						rows={panelTechRows}
						total={panelTechTotal}
						coveredOf={panelTechCovered}
						onExport={() =>
							openExport(
								'Panel Technology',
								'analysis-panel-tech',
								['Panel Tech', 'Count', '%'],
								panelTechRows.map((r) => [r.label, r.count, pct(r.count, panelTechTotal)]),
							)}
					/>
				</section>
			{:else}
				{#each numericSections as section (section.id)}
					{#if activeSection === section.id}
						<section class="section">
							{#if rankedMetrics[section.id]}
								<RankedMetricSection
									heading={section.title}
									metric={rankedMetrics[section.id]}
									bind:filters={rankFilters[section.id]}
								>
									{#snippet distribution()}
										{@render numericBody(section, true)}
									{/snippet}
								</RankedMetricSection>
							{:else}
								{@render numericBody(section, false)}
							{/if}
						</section>
					{/if}
				{/each}
			{/if}

			{#if activeSection === 'pressure-levels'}
				<section class="section">
					<PressureLevelsSection
						rows={pressureRows}
						total={pressureTotal}
						coveredOf={allTablets.length}
						onExport={() =>
							openExport(
								'Pressure Levels',
								'analysis-pressure-levels',
								['Pressure Levels', 'Count', '%'],
								pressureRows.map((r) => [Number(r.label), r.count, pct(r.count, pressureTotal)]),
							)}
					/>
				</section>
			{/if}

			{#if activeSection === 'touch-support'}
				<section class="section">
					<TouchSupportSection
						rows={touchSupportRows}
						total={touchTotal}
						coveredOf={allTablets.length}
						touchRows={touchTablets}
						bind:selectedTypes={touchTypes}
						onExport={() =>
							openExport(
								'Touch Support',
								'analysis-touch-support',
								['Touch', 'Count', '%'],
								touchSupportRows.map((r) => [r.label, r.count, pct(r.count, touchTotal)]),
							)}
					/>
				</section>
			{/if}

			{#if activeSection === 'power-overview'}
				<section class="section">
					<PowerOverviewSection
						coverage={powerCoverageRows}
						penTabletCount={penTablets.length}
						penDisplayCount={powerPenDisplays.length}
						penTabletSources={inputSourceRows(penTablets)}
						penDisplaySources={inputSourceRows(powerPenDisplays)}
						standaloneWithPower={standalones.filter((t) => t.Power != null).length}
						standaloneCount={standalones.length}
						onExport={exportPowerCoverage}
					/>
				</section>
			{/if}

			{#if activeSection === 'sizes-pen-tablet'}
				<section class="section">
					<RankedMetricSection
						heading={`Pen Tablet diagonal (${ptSizesValues.length})`}
						metric={rankedMetrics['sizes-pen-tablet']}
						bind:filters={rankFilters['sizes-pen-tablet']}
					>
						{#snippet distribution()}
							<TabletDiagonalSection
								headless
								title="Pen Tablet diagonal"
								description="Distribution of pen-tablet active-area diagonals. Use the overlay control to project paper-size markers onto the chart."
								histogramTitle="Pen tablet active area diagonal"
								tablets={ptSizesTablets}
								values={ptSizesValues}
								ranges={ptSizesRanges}
								unit={isMetric ? ' cm' : '"'}
								binSize={isMetric ? 1 : 0.5}
								bind:overlay={ptOverlay}
								bind:compareYears={ptSizesYears}
								markers={ptMarkers}
							/>
						{/snippet}
					</RankedMetricSection>
				</section>
			{/if}

			{#if activeSection === 'sizes-pen-display'}
				<section class="section">
					<RankedMetricSection
						heading={`Pen Display diagonal (${pdSizesValues.length})`}
						metric={rankedMetrics['sizes-pen-display']}
						bind:filters={rankFilters['sizes-pen-display']}
					>
						{#snippet distribution()}
							<TabletDiagonalSection
								headless
								title="Pen Display diagonal"
								description="Distribution of pen-display (and standalone) active-area diagonals. Use the overlay control to project paper-size markers onto the chart."
								histogramTitle="Pen display active area diagonal"
								tablets={pdSizesTablets}
								values={pdSizesValues}
								ranges={pdSizesRanges}
								unit={isMetric ? ' cm' : '"'}
								binSize={isMetric ? 1 : 0.5}
								bind:overlay={pdOverlay}
								bind:compareYears={pdSizesYears}
								markers={pdMarkers}
							/>
						{/snippet}
					</RankedMetricSection>
				</section>
			{/if}
		{/snippet}
	</SectionedPage>

	{#if exportHost.config}
		<ExportDialog
			entityType="analysis"
			title={exportHost.config.title}
			filename={exportHost.config.filename}
			headers={exportHost.config.headers}
			rows={exportHost.config.rows}
			onclose={exportHost.close}
		/>
	{/if}
</ChromeLayout>

<style>
	.section {
		margin-bottom: 32px;
	}

	:global(.section h2) {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
	}

	:global(.section .description) {
		font-size: 13px;
		color: var(--text-dim);
		margin-bottom: 8px;
	}

	.section :global(.rank-controls) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
	}
	.section :global(.controls-left) {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.section :global(.show-count) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.section :global(.show-count select) {
		font-size: 12px;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}
	.section :global(.rank-controls .table-export) {
		margin-bottom: 0;
	}
	.section :global(.rank-table) {
		border-collapse: collapse;
		font-size: 13px;
		margin: 8px 0 16px;
		width: fit-content;
	}
	.section :global(.rank-table th) {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.section :global(.rank-table th.num) {
		text-align: right;
	}
	.section :global(.rank-table th .unit) {
		font-size: 11px;
		font-weight: 400;
	}
	.section :global(.rank-table td) {
		padding: 5px 14px;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
	.section :global(.rank-table td.num) {
		text-align: right;
	}
	.section :global(.rank-table tr:last-child td) {
		border-bottom: none;
	}
	.section :global(.rank-table tr:hover td) {
		background: var(--hover-bg);
	}
	.section :global(.rank-table a) {
		color: var(--link);
		text-decoration: none;
	}
	.section :global(.rank-table a:hover) {
		text-decoration: underline;
	}
	.section :global(.rank-table .mono) {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
