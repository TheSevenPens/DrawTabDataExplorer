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
		'digitizer-density': null,
		'digitizer-accuracy-center': null,
		'digitizer-accuracy-corner': null,
		'digitizer-report-rate': null,
	});

	let numericSections = $derived(buildAnalysisSections(allTablets, penDisplays, yearFilters));

	// --- Digitizer density ranking (lowest / highest) ---

	type DensityRow = {
		entityId: string;
		name: string;
		id: string;
		brand: string;
		year: string;
		density: number;
	};
	let densityTablets = $derived<DensityRow[]>(
		allTablets
			.map((t) => {
				const raw = t.Digitizer?.Density;
				const density = Number(raw);
				if (raw == null || raw === '' || !Number.isFinite(density)) return null;
				return {
					entityId: t.Meta.EntityId,
					name: t.Model.Name,
					id: t.Model.Id,
					brand: t.Model.Brand as string,
					year: t.Model.LaunchYear ?? '',
					density,
				};
			})
			.filter((r): r is DensityRow => r !== null),
	);
	let densityBrands = $derived(
		[...new Set(densityTablets.map((r) => r.brand))].sort((a, b) =>
			brandName(a).localeCompare(brandName(b)),
		),
	);

	const DENSITY_COUNT_OPTIONS = [10, 20, 30];
	let lowestDensityCount = $state(10);
	let highestDensityCount = $state(10);
	let lowestDensityBrand = $state('');
	let highestDensityBrand = $state('');

	function densityRankRows(brand: string, dir: 'asc' | 'desc', count: number): DensityRow[] {
		const filtered = brand ? densityTablets.filter((r) => r.brand === brand) : densityTablets;
		return [...filtered]
			.sort((a, b) => (dir === 'asc' ? a.density - b.density : b.density - a.density))
			.slice(0, count);
	}
	let lowestDensityRows = $derived(densityRankRows(lowestDensityBrand, 'asc', lowestDensityCount));
	let highestDensityRows = $derived(
		densityRankRows(highestDensityBrand, 'desc', highestDensityCount),
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

{#snippet densityRankSection(p: {
	rows: DensityRow[];
	title: string;
	filename: string;
	brand: string;
	onBrandChange: (b: string) => void;
	count: number;
	onCountChange: (n: number) => void;
})}
	<h2>{p.title}</h2>
	<p class="description">
		Tablets ranked by digitizer density (lines per mm). Higher density gives finer positional
		resolution under the pen tip.
	</p>
	{#if densityTablets.length === 0}
		<EmptyState>No tablets with a recorded digitizer density.</EmptyState>
	{:else}
		<div class="rank-controls">
			<div class="controls-left">
				<label class="show-count">
					Brand
					<select onchange={(e) => p.onBrandChange(e.currentTarget.value)}>
						<option value="" selected={p.brand === ''}>All brands</option>
						{#each densityBrands as b (b)}
							<option value={b} selected={p.brand === b}>{brandName(b)}</option>
						{/each}
					</select>
				</label>
				<label class="show-count">
					Show
					<select onchange={(e) => p.onCountChange(Number(e.currentTarget.value))}>
						{#each DENSITY_COUNT_OPTIONS as n (n)}
							<option value={n} selected={p.count === n}>{n}</option>
						{/each}
					</select>
				</label>
			</div>
			<ExportTableButton
				entityType="analysis"
				title={p.title}
				filename={p.filename}
				headers={['Rank', 'Tablet', 'Brand', 'Year', 'Density (LPmm)']}
				rows={p.rows.map((r, i) => [
					i + 1,
					`${r.name} (${r.id})`,
					brandName(r.brand),
					r.year,
					r.density,
				])}
			/>
		</div>
		{#if p.rows.length === 0}
			<EmptyState>No tablets match this brand.</EmptyState>
		{:else}
			<table class="rank-table">
				<thead>
					<tr>
						<th class="num">#</th>
						<th>Tablet</th>
						<th>Brand</th>
						<th class="num">Year</th>
						<th class="num">Density <span class="unit">(LPmm)</span></th>
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
							<td class="num mono">{r.density}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
{/snippet}

<ChromeLayout subNavTabs={tabletTabs}>
	<h1>Analysis</h1>

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

			{#if activeSection === 'digitizer-density-lowest'}
				<section class="section">
					{@render densityRankSection({
						rows: lowestDensityRows,
						title: 'Lowest Digitizer Density',
						filename: 'analysis-digitizer-density-lowest',
						brand: lowestDensityBrand,
						onBrandChange: (b) => (lowestDensityBrand = b),
						count: lowestDensityCount,
						onCountChange: (n) => (lowestDensityCount = n),
					})}
				</section>
			{/if}

			{#if activeSection === 'digitizer-density-highest'}
				<section class="section">
					{@render densityRankSection({
						rows: highestDensityRows,
						title: 'Highest Digitizer Density',
						filename: 'analysis-digitizer-density-highest',
						brand: highestDensityBrand,
						onBrandChange: (b) => (highestDensityBrand = b),
						count: highestDensityCount,
						onCountChange: (n) => (highestDensityCount = n),
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
	h1 {
		margin-bottom: 16px;
	}

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
