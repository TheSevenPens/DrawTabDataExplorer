<script lang="ts">
	import { createExportDialogHost } from '$lib/export-dialog-host.svelte.js';
	import { resolve } from '$app/paths';
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
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
		diagonalRows,
		topByDiagonal,
		rankRows,
		diagonalBrands,
		metricRankRows,
		rankBrands,
		matchesTypeBrand,
		TABLET_TYPE_OPTIONS,
		digitizerDensity,
		displayPpi,
		type MetricRankRow,
		touchTabletRows,
		type DiagonalRow,
		type DiagonalDirection,
		type TabletTypeValue,
	} from '$lib/tablet-analysis/helpers.js';
	import { buildAnalysisSections } from '$lib/tablet-analysis/metric-configs.js';
	import AspectRatioRatioSection from '$lib/tablet-analysis/AspectRatioRatioSection.svelte';
	import AspectRatioCategorySection from '$lib/tablet-analysis/AspectRatioCategorySection.svelte';
	import NumericMetricSection from '$lib/tablet-analysis/NumericMetricSection.svelte';
	import PanelTechSection from '$lib/tablet-analysis/PanelTechSection.svelte';
	import PressureLevelsSection from '$lib/tablet-analysis/PressureLevelsSection.svelte';
	import TouchSupportSection from '$lib/tablet-analysis/TouchSupportSection.svelte';
	import TabletDiagonalSection from '$lib/tablet-analysis/TabletDiagonalSection.svelte';
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
		{ id: 'digitizer-density-lowest', category: 'Digitizer', label: 'Density — Lowest' },
		{ id: 'digitizer-density-highest', category: 'Digitizer', label: 'Density — Highest' },
		{ id: 'digitizer-accuracy-center', category: 'Digitizer', label: 'Accuracy (Center)' },
		{ id: 'digitizer-accuracy-corner', category: 'Digitizer', label: 'Accuracy (Corner)' },
		{ id: 'digitizer-report-rate', category: 'Digitizer', label: 'Report Rate' },
		{ id: 'panel-tech', category: 'Display Tech', label: 'Panel Technology' },
		{ id: 'display-brightness', category: 'Display Tech', label: 'Brightness' },
		{ id: 'display-contrast', category: 'Display Tech', label: 'Contrast' },
		{ id: 'display-refresh-rate', category: 'Display Tech', label: 'Refresh Rate' },
		{ id: 'display-response-time', category: 'Display Tech', label: 'Response Time' },
		{ id: 'display-pixel-density', category: 'Display Tech', label: 'Pixel Density' },
		{
			id: 'display-pixel-density-lowest',
			category: 'Display Tech',
			label: 'Pixel Density — Lowest',
		},
		{
			id: 'display-pixel-density-highest',
			category: 'Display Tech',
			label: 'Pixel Density — Highest',
		},
		{ id: 'display-bit-depth', category: 'Display Tech', label: 'Bit Depth' },
		{ id: 'pressure-levels', category: 'Tablet Features', label: 'Pressure Levels' },
		{ id: 'touch-support', category: 'Tablet Features', label: 'Touch Support' },
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
	let yearFilters = $state<Record<string, number | null>>({
		'display-brightness': null,
		'display-contrast': null,
		'display-refresh-rate': null,
		'display-response-time': null,
		'display-bit-depth': null,
		'display-pixel-density': null,
		'digitizer-density': null,
		'digitizer-accuracy-center': null,
		'digitizer-accuracy-corner': null,
		'digitizer-report-rate': null,
	});

	// Type and brand dropdowns on the Pixel Density chart. '' = all.
	const DISPLAY_TYPE_OPTIONS = TABLET_TYPE_OPTIONS.filter((o) => o.value !== 'PENTABLET');
	let ppiChartType = $state('');
	let ppiChartBrand = $state('');

	let numericSections = $derived(
		buildAnalysisSections(allTablets, penDisplays, yearFilters, {
			'display-pixel-density': { type: ppiChartType, brand: ppiChartBrand },
		}),
	);

	// --- Density rankings (lowest / highest) ---

	const RANK_COUNT_OPTIONS = [10, 20, 30];

	function rankBy(
		rows: MetricRankRow[],
		type: string,
		brand: string,
		dir: 'asc' | 'desc',
		count: number,
	) {
		const filtered = rows.filter((r) => matchesTypeBrand(r, type, brand));
		return rankRows(filtered, (r) => r.value, dir, count);
	}

	let densityTablets = $derived(metricRankRows(allTablets, digitizerDensity));
	let densityBrands = $derived(rankBrands(densityTablets, brandName));
	let lowestDensityCount = $state(10);
	let highestDensityCount = $state(10);
	let lowestDensityBrand = $state('');
	let highestDensityBrand = $state('');
	let lowestDensityRows = $derived(
		rankBy(densityTablets, '', lowestDensityBrand, 'asc', lowestDensityCount),
	);
	let highestDensityRows = $derived(
		rankBy(densityTablets, '', highestDensityBrand, 'desc', highestDensityCount),
	);

	// Same pool as the Pixel Density histogram: pen displays and standalones.
	let ppiTablets = $derived(metricRankRows(penDisplays, displayPpi));
	let ppiBrands = $derived(rankBrands(ppiTablets, brandName));
	let lowestPpiCount = $state(10);
	let highestPpiCount = $state(10);
	let lowestPpiType = $state('');
	let highestPpiType = $state('');
	let lowestPpiBrand = $state('');
	let highestPpiBrand = $state('');
	let lowestPpiRows = $derived(
		rankBy(ppiTablets, lowestPpiType, lowestPpiBrand, 'asc', lowestPpiCount),
	);
	let highestPpiRows = $derived(
		rankBy(ppiTablets, highestPpiType, highestPpiBrand, 'desc', highestPpiCount),
	);

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

	// --- Largest by diagonal (per Sizes section) ---
	//
	// Ranks over every tablet of the type, not the histogram's year-filtered
	// set: a top-N list that silently dropped older large tablets would be
	// surprising, and it matches the digitizer-density rankings above.

	const DIAGONAL_COUNT_OPTIONS = [10, 20, 30];

	let ptDiagonalRows = $derived(diagonalRows(penTablets));
	// Standalones (iPads and the like) are left out of the ranking: they
	// dominated the smallest end and are not pen displays in the sense this
	// table is comparing. The histogram above still includes them.
	let pdDiagonalRows = $derived(
		diagonalRows(penDisplays.filter((t) => t.Model.Type === 'PENDISPLAY')),
	);
	let ptDiagonalBrands = $derived(diagonalBrands(ptDiagonalRows, brandName));
	let pdDiagonalBrands = $derived(diagonalBrands(pdDiagonalRows, brandName));

	const DIAGONAL_DIRECTION_OPTIONS: { value: DiagonalDirection; label: string }[] = [
		{ value: 'largest', label: 'Largest first' },
		{ value: 'smallest', label: 'Smallest first' },
	];

	let ptTopBrand = $state('');
	let pdTopBrand = $state('');
	let ptTopCount = $state(10);
	let pdTopCount = $state(10);
	let ptTopDir = $state<DiagonalDirection>('largest');
	let pdTopDir = $state<DiagonalDirection>('largest');

	let ptTopRows = $derived(topByDiagonal(ptDiagonalRows, ptTopBrand, ptTopCount, ptTopDir));
	let pdTopRows = $derived(topByDiagonal(pdDiagonalRows, pdTopBrand, pdTopCount, pdTopDir));

	/** Diagonal in the active unit, to one decimal. */
	function diagonalDisplay(mm: number): string {
		return (isMetric ? mm * MM_TO_CM : mm * MM_TO_IN).toFixed(1);
	}
</script>

{#snippet diagonalRankSection(p: {
	rows: DiagonalRow[];
	allRows: DiagonalRow[];
	brands: string[];
	filenameBase: string;
	noun: string;
	brand: string;
	onBrandChange: (b: string) => void;
	count: number;
	onCountChange: (n: number) => void;
	direction: DiagonalDirection;
	onDirectionChange: (d: DiagonalDirection) => void;
	/** Optional caveat appended to the description, e.g. when this table's
	 *  population differs from the chart above it. */
	note?: string;
})}
	{@const superlative = p.direction === 'largest' ? 'Largest' : 'Smallest'}
	{@const title = `${superlative} ${p.noun} by diagonal`}
	{@const filename = `${p.filenameBase}-${p.direction}`}
	<h3>{title}</h3>
	<p class="description">
		The {superlative.toLowerCase()}
		{p.noun} by active-area diagonal. Ranked across all {p.noun} with recorded dimensions — unlike the
		chart above, this table ignores the compare-years control.
		{#if p.note}{p.note}{/if}
	</p>
	{#if p.allRows.length === 0}
		<EmptyState>No {p.noun} with recorded active-area dimensions.</EmptyState>
	{:else}
		<div class="rank-controls">
			<div class="controls-left">
				<label class="show-count">
					Sort
					<select onchange={(e) => p.onDirectionChange(e.currentTarget.value as DiagonalDirection)}>
						{#each DIAGONAL_DIRECTION_OPTIONS as opt (opt.value)}
							<option value={opt.value} selected={p.direction === opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>
				<label class="show-count">
					Brand
					<select onchange={(e) => p.onBrandChange(e.currentTarget.value)}>
						<option value="" selected={p.brand === ''}>All brands</option>
						{#each p.brands as b (b)}
							<option value={b} selected={p.brand === b}>{brandName(b)}</option>
						{/each}
					</select>
				</label>
				<label class="show-count">
					Show
					<select onchange={(e) => p.onCountChange(Number(e.currentTarget.value))}>
						{#each DIAGONAL_COUNT_OPTIONS as n (n)}
							<option value={n} selected={p.count === n}>{n}</option>
						{/each}
					</select>
				</label>
			</div>
			<ExportTableButton
				entityType="analysis"
				{title}
				{filename}
				headers={['Rank', 'Tablet', 'Brand', 'Year', `Diagonal (${isMetric ? 'cm' : 'in'})`]}
				rows={p.rows.map((r, i) => [
					i + 1,
					`${r.name} (${r.id})`,
					brandName(r.brand),
					r.year,
					diagonalDisplay(r.diagonalMm),
				])}
			/>
		</div>
		{#if p.rows.length === 0}
			<EmptyState>No {p.noun} match this brand.</EmptyState>
		{:else}
			<table class="rank-table">
				<thead>
					<tr>
						<th class="num">#</th>
						<th>Tablet</th>
						<th>Brand</th>
						<th class="num">Year</th>
						<th class="num">Diagonal <span class="unit">({isMetric ? 'cm' : 'in'})</span></th>
					</tr>
				</thead>
				<tbody>
					{#each p.rows as r, i (r.entityId)}
						<tr>
							<td class="num mono">{i + 1}</td>
							<td>
								<a href={resolve('/entity/[entityId]', { entityId: r.entityId })}>
									{r.name} ({r.id})
								</a>
							</td>
							<td>{brandName(r.brand)}</td>
							<td class="num mono">{r.year || '—'}</td>
							<td class="num mono">{diagonalDisplay(r.diagonalMm)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
{/snippet}

{#snippet typeBrandSelects(p: {
	/** Type choices; the Type dropdown is left out when omitted. */
	types?: { value: string; label: string }[];
	type?: string;
	onTypeChange?: (t: string) => void;
	brands: string[];
	brand: string;
	onBrandChange: (b: string) => void;
})}
	{#if p.types}
		<label class="show-count">
			Type
			<select onchange={(e) => p.onTypeChange?.(e.currentTarget.value)}>
				<option value="" selected={p.type === ''}>All types</option>
				{#each p.types as t (t.value)}
					<option value={t.value} selected={p.type === t.value}>{t.label}</option>
				{/each}
			</select>
		</label>
	{/if}
	<label class="show-count">
		Brand
		<select onchange={(e) => p.onBrandChange(e.currentTarget.value)}>
			<option value="" selected={p.brand === ''}>All brands</option>
			{#each p.brands as b (b)}
				<option value={b} selected={p.brand === b}>{brandName(b)}</option>
			{/each}
		</select>
	</label>
{/snippet}

{#snippet metricRankSection(p: {
	rows: MetricRankRow[];
	allRows: MetricRankRow[];
	types?: { value: string; label: string }[];
	type?: string;
	onTypeChange?: (t: string) => void;
	brands: string[];
	title: string;
	description: string;
	emptyText: string;
	filename: string;
	valueLabel: string;
	unit: string;
	format: (v: number) => string;
	brand: string;
	onBrandChange: (b: string) => void;
	count: number;
	onCountChange: (n: number) => void;
})}
	<h2>{p.title}</h2>
	<p class="description">{p.description}</p>
	{#if p.allRows.length === 0}
		<EmptyState>{p.emptyText}</EmptyState>
	{:else}
		<div class="rank-controls">
			<div class="controls-left">
				{@render typeBrandSelects(p)}
				<label class="show-count">
					Show
					<select onchange={(e) => p.onCountChange(Number(e.currentTarget.value))}>
						{#each RANK_COUNT_OPTIONS as n (n)}
							<option value={n} selected={p.count === n}>{n}</option>
						{/each}
					</select>
				</label>
			</div>
			<ExportTableButton
				entityType="analysis"
				title={p.title}
				filename={p.filename}
				headers={['Rank', 'Tablet', 'Brand', 'Year', `${p.valueLabel} (${p.unit})`]}
				rows={p.rows.map((r, i) => [
					i + 1,
					`${r.name} (${r.id})`,
					brandName(r.brand),
					r.year,
					p.format(r.value),
				])}
			/>
		</div>
		{#if p.rows.length === 0}
			<EmptyState>No tablets match {p.types ? 'these filters' : 'this brand'}.</EmptyState>
		{:else}
			<table class="rank-table">
				<thead>
					<tr>
						<th class="num">#</th>
						<th>Tablet</th>
						<th>Brand</th>
						<th class="num">Year</th>
						<th class="num">{p.valueLabel} <span class="unit">({p.unit})</span></th>
					</tr>
				</thead>
				<tbody>
					{#each p.rows as r, i (r.entityId)}
						<tr>
							<td class="num mono">{i + 1}</td>
							<td>
								<a href={resolve('/entity/[entityId]', { entityId: r.entityId })}>
									{r.name} ({r.id})
								</a>
							</td>
							<td>{brandName(r.brand)}</td>
							<td class="num mono">{r.year || '—'}</td>
							<td class="num mono">{p.format(r.value)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
{/snippet}

{#snippet ppiChartControls()}
	<div class="rank-controls">
		<div class="controls-left">
			{@render typeBrandSelects({
				types: DISPLAY_TYPE_OPTIONS,
				type: ppiChartType,
				onTypeChange: (t) => (ppiChartType = t),
				brands: ppiBrands,
				brand: ppiChartBrand,
				onBrandChange: (b) => (ppiChartBrand = b),
			})}
		</div>
	</div>
{/snippet}

<ChromeLayout subNavTabs={tabletTabs}>
	<h1 class="sr-only">Analysis</h1>

	<SectionedPage sections={sectionDefs} defaultSection="aspect-pen-tablet">
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
							<NumericMetricSection
								{section}
								controls={section.id === 'display-pixel-density' ? ppiChartControls : undefined}
								bind:compareYears={yearFilters[section.id]}
								onExport={() =>
									openExport(
										section.title,
										section.filename,
										[section.title, 'Count', '%'],
										section.data.rows.map((r) => [
											Number(r.label),
											r.count,
											pct(r.count, section.data.count),
										]),
									)}
							/>
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

			{#if activeSection === 'digitizer-density-lowest' || activeSection === 'digitizer-density-highest'}
				{@const lowest = activeSection === 'digitizer-density-lowest'}
				<section class="section">
					{@render metricRankSection({
						rows: lowest ? lowestDensityRows : highestDensityRows,
						allRows: densityTablets,
						brands: densityBrands,
						title: lowest ? 'Lowest Digitizer Density' : 'Highest Digitizer Density',
						description:
							'Tablets ranked by digitizer density (lines per mm). Higher density gives finer positional resolution under the pen tip.',
						emptyText: 'No tablets with a recorded digitizer density.',
						filename: lowest
							? 'analysis-digitizer-density-lowest'
							: 'analysis-digitizer-density-highest',
						valueLabel: 'Density',
						unit: 'LPmm',
						format: (v) => String(v),
						brand: lowest ? lowestDensityBrand : highestDensityBrand,
						onBrandChange: (b) => (lowest ? (lowestDensityBrand = b) : (highestDensityBrand = b)),
						count: lowest ? lowestDensityCount : highestDensityCount,
						onCountChange: (n) => (lowest ? (lowestDensityCount = n) : (highestDensityCount = n)),
					})}
				</section>
			{/if}

			{#if activeSection === 'display-pixel-density-lowest' || activeSection === 'display-pixel-density-highest'}
				{@const lowest = activeSection === 'display-pixel-density-lowest'}
				<section class="section">
					{@render metricRankSection({
						rows: lowest ? lowestPpiRows : highestPpiRows,
						allRows: ppiTablets,
						types: DISPLAY_TYPE_OPTIONS,
						type: lowest ? lowestPpiType : highestPpiType,
						onTypeChange: (t) => (lowest ? (lowestPpiType = t) : (highestPpiType = t)),
						brands: ppiBrands,
						title: lowest ? 'Lowest Pixel Density' : 'Highest Pixel Density',
						description:
							'Pen displays and standalones ranked by pixel density: horizontal resolution over active-area width, in pixels per inch. Higher density gives sharper lines and text at the same viewing distance.',
						emptyText: 'No pen displays with a recorded resolution and active-area width.',
						filename: lowest
							? 'analysis-display-pixel-density-lowest'
							: 'analysis-display-pixel-density-highest',
						valueLabel: 'Pixel Density',
						unit: 'PPI',
						format: (v) => v.toFixed(1),
						brand: lowest ? lowestPpiBrand : highestPpiBrand,
						onBrandChange: (b) => (lowest ? (lowestPpiBrand = b) : (highestPpiBrand = b)),
						count: lowest ? lowestPpiCount : highestPpiCount,
						onCountChange: (n) => (lowest ? (lowestPpiCount = n) : (highestPpiCount = n)),
					})}
				</section>
			{/if}

			{#if activeSection === 'sizes-pen-tablet'}
				<section class="section">
					<TabletDiagonalSection
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
					{@render diagonalRankSection({
						rows: ptTopRows,
						allRows: ptDiagonalRows,
						brands: ptDiagonalBrands,
						filenameBase: 'analysis-pen-tablet-diagonal',
						noun: 'pen tablets',
						brand: ptTopBrand,
						onBrandChange: (b) => (ptTopBrand = b),
						count: ptTopCount,
						onCountChange: (n) => (ptTopCount = n),
						direction: ptTopDir,
						onDirectionChange: (d) => (ptTopDir = d),
					})}
				</section>
			{/if}

			{#if activeSection === 'sizes-pen-display'}
				<section class="section">
					<TabletDiagonalSection
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
					{@render diagonalRankSection({
						rows: pdTopRows,
						allRows: pdDiagonalRows,
						brands: pdDiagonalBrands,
						filenameBase: 'analysis-pen-display-diagonal',
						noun: 'pen displays',
						brand: pdTopBrand,
						onBrandChange: (b) => (pdTopBrand = b),
						count: pdTopCount,
						onCountChange: (n) => (pdTopCount = n),
						direction: pdTopDir,
						onDirectionChange: (d) => (pdTopDir = d),
						note: 'Standalone tablets are excluded, though the chart above includes them.',
					})}
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

	.rank-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
	}
	.controls-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.show-count {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.show-count select {
		font-size: 12px;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}
	.rank-controls :global(.table-export) {
		margin-bottom: 0;
	}
	.rank-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 8px 0 16px;
		width: fit-content;
	}
	.rank-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.rank-table th.num {
		text-align: right;
	}
	.rank-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.rank-table td {
		padding: 5px 14px;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
	.rank-table td.num {
		text-align: right;
	}
	.rank-table tr:last-child td {
		border-bottom: none;
	}
	.rank-table tr:hover td {
		background: var(--hover-bg);
	}
	.rank-table a {
		color: var(--link);
		text-decoration: none;
	}
	.rank-table a:hover {
		text-decoration: underline;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
