<script lang="ts">
	import { createExportDialogHost } from '$lib/export-dialog-host.svelte.js';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import {
		penTabletRangesCm,
		penTabletRangesIn,
		displayRangesCm,
		displayRangesIn,
	} from '$lib/tablet-size-ranges.js';
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';
	import Button from '$lib/components/Button.svelte';
	import { dataSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import BandsChart from '$lib/components/BandsChart.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import {
		PIAF_BANDS,
		PMAX_BANDS,
		BRIGHTNESS_BANDS,
		CONTRAST_BANDS,
		RESPONSE_TIME_BANDS,
		DENSITY_BANDS,
		ACCURACY_CENTER_BANDS,
		ACCURACY_CORNER_BANDS,
		REPORT_RATE_BANDS,
		type SpecBand,
	} from '$lib/bands.js';
	import {
		gcd,
		diagonalCm,
		diagonalIn,
		resolutionCategories,
		getResolutionCategory,
		closestISOA,
		formatBandRange,
		sortBandsByRank,
		paperSizeExportRows,
		type PaperSize,
	} from '$lib/reference/reference-data.js';
	import type { HistogramRange } from '$lib/components/ValueHistogram.svelte';

	const dataTabs = dataSubNavTabs();

	const sectionDefs: Section[] = [
		{ id: 'tablet-sizes', category: 'Tablets', label: 'Tablet Sizes' },
		{ id: 'display-resolutions', category: 'Tablets', label: 'Display Resolutions' },
		{ id: 'iso-paper-a', category: 'Paper Sizes', label: 'ISO A Paper Sizes' },
		{ id: 'iso-paper-b', category: 'Paper Sizes', label: 'ISO B Paper Sizes' },
		{ id: 'us-paper', category: 'Paper Sizes', label: 'US Paper Sizes' },
		{ id: 'piaf-ranking', category: 'Pen Pressure', label: 'IAF Ranking' },
		{ id: 'pmax-ranking', category: 'Pen Pressure', label: 'MAX Ranking' },
		{ id: 'bands-brightness', category: 'Display Bands', label: 'Brightness' },
		{ id: 'bands-contrast', category: 'Display Bands', label: 'Contrast' },
		{ id: 'bands-response-time', category: 'Display Bands', label: 'Response Time' },
		{ id: 'bands-density', category: 'Digitizer Bands', label: 'Density' },
		{ id: 'bands-accuracy-center', category: 'Digitizer Bands', label: 'Accuracy (Center)' },
		{ id: 'bands-accuracy-corner', category: 'Digitizer Bands', label: 'Accuracy (Corner)' },
		{ id: 'bands-report-rate', category: 'Digitizer Bands', label: 'Report Rate' },
	];

	interface BandSection {
		id: string;
		title: string;
		blurb: string;
		unit: string;
		filename: string;
		bands: SpecBand[];
	}

	const specBandSections: BandSection[] = [
		{
			id: 'bands-brightness',
			title: 'Brightness Bands',
			blurb:
				'Display brightness in cd/m². Most pen displays sit in the Average band; HDR-capable panels reach Very Bright.',
			unit: 'cd/m²',
			filename: 'bands-brightness',
			bands: BRIGHTNESS_BANDS,
		},
		{
			id: 'bands-contrast',
			title: 'Contrast Bands',
			blurb:
				'Static contrast ratio reported by the manufacturer. OLED panels (often reported as 100,000:1 or higher) fall above the High band and are charted separately on the analysis page.',
			unit: ':1',
			filename: 'bands-contrast',
			bands: CONTRAST_BANDS,
		},
		{
			id: 'bands-response-time',
			title: 'Response Time Bands',
			blurb:
				'Pixel response time in milliseconds. Lower is better — slow response shows up as visible ghosting under fast strokes.',
			unit: 'ms',
			filename: 'bands-response-time',
			bands: RESPONSE_TIME_BANDS,
		},
		{
			id: 'bands-density',
			title: 'Digitizer Density Bands',
			blurb:
				'Sensor lines per mm reported by the manufacturer. Higher density gives finer positional resolution under the pen tip.',
			unit: 'LPmm',
			filename: 'bands-density',
			bands: DENSITY_BANDS,
		},
		{
			id: 'bands-accuracy-center',
			title: 'Accuracy (Center) Bands',
			blurb: 'Maximum positional error in mm at the centre of the active area. Lower is better.',
			unit: 'mm',
			filename: 'bands-accuracy-center',
			bands: ACCURACY_CENTER_BANDS,
		},
		{
			id: 'bands-accuracy-corner',
			title: 'Accuracy (Corner) Bands',
			blurb:
				'Maximum positional error in mm at the corners of the active area. Typically several times worse than centre accuracy.',
			unit: 'mm',
			filename: 'bands-accuracy-corner',
			bands: ACCURACY_CORNER_BANDS,
		},
		{
			id: 'bands-report-rate',
			title: 'Report Rate Bands',
			blurb:
				'Samples per second sent by the digitizer. Higher report rates produce smoother strokes under fast motion.',
			unit: 'Hz',
			filename: 'bands-report-rate',
			bands: REPORT_RATE_BANDS,
		},
	];

	let { data } = $props();

	const piafBands = PIAF_BANDS;
	const pmaxBands = PMAX_BANDS;
	const pmaxBandsByRank = sortBandsByRank(PMAX_BANDS);
	let paperSizes = $derived(data.paperSizes);
	let usPaperSizes = $derived(data.usPaperSizes);
	let allTablets = $derived(data.allTablets);

	let aSeries = $derived(paperSizes.filter((p) => p.Series === 'A'));
	let bSeries = $derived(paperSizes.filter((p) => p.Series === 'B'));

	let displayTablets = $derived(
		allTablets.filter((t) => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE'),
	);

	let resolutionCounts = $derived(
		displayTablets.reduce<Record<string, number>>((acc, t) => {
			const d = t.Display?.PixelDimensions;
			if (!d?.Width || !d?.Height) return acc;
			const cat = getResolutionCategory(d.Width, d.Height);
			acc[cat] = (acc[cat] ?? 0) + 1;
			return acc;
		}, {}),
	);

	// Single shared ExportDialog via the shared export host (#236);
	// `openExport` is a local alias so the section triggers read unchanged.
	const exportHost = createExportDialogHost();
	const openExport = exportHost.open;
</script>

<ChromeLayout subNavTabs={dataTabs}>
	<h1>Reference</h1>

	<SectionedPage sections={sectionDefs} defaultSection="tablet-sizes">
		{#snippet content(activeSection: string)}
			{#snippet sizeTable(
				heading: string,
				exportFilename: string,
				tableId: string,
				rangesCm: HistogramRange[],
				rangesIn: HistogramRange[],
			)}
				<section>
					<div class="section-header">
						<h2>{heading}</h2>
						<Button
							variant="subtle"
							onclick={() =>
								openExport(
									heading,
									exportFilename,
									[
										'Category',
										'Range (cm)',
										'Range (in)',
										'Similar ISO A',
										'Diagonal (cm)',
										'Diagonal (in)',
									],
									rangesCm.map((range, i) => {
										const inRange = rangesIn[i];
										const iso = closestISOA(aSeries, (range.min + range.max) / 2);
										return [
											range.label,
											`${range.min} cm – ${range.max} cm`,
											`${inRange.min}″ – ${inRange.max}″`,
											iso.name,
											`${iso.diagCm} cm`,
											`${iso.diagIn}″`,
										];
									}),
								)}>Export</Button
						>
					</div>
					<table id={tableId} class="ref-table">
						<thead
							><tr
								><th>Category</th><th>Range (cm)</th><th>Range (in)</th><th>Similar ISO A</th><th
									>Diagonal (cm)</th
								><th>Diagonal (in)</th></tr
							></thead
						>
						<tbody>
							{#each rangesCm as range, i (range.label)}
								{@const inRange = rangesIn[i]}
								{@const iso = closestISOA(aSeries, (range.min + range.max) / 2)}
								<tr>
									<td>{range.label}</td>
									<td>{range.min} cm – {range.max} cm</td>
									<td>{inRange.min}″ – {inRange.max}″</td>
									<td>{iso.name}</td>
									<td>{iso.diagCm} cm</td>
									<td>{iso.diagIn}″</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/snippet}

			{#snippet paperTable(
				heading: string,
				exportFilename: string,
				tableId: string,
				sizes: PaperSize[],
				includeSeries: boolean,
			)}
				<section>
					<div class="section-header">
						<h2>{heading}</h2>
						<Button
							variant="subtle"
							disabled={sizes.length === 0}
							onclick={() =>
								openExport(
									heading,
									exportFilename,
									includeSeries
										? [
												'Name',
												'Series',
												'Width (cm)',
												'Height (cm)',
												'Diagonal (cm)',
												'Width (in)',
												'Height (in)',
												'Diagonal (in)',
											]
										: [
												'Name',
												'Width (cm)',
												'Height (cm)',
												'Diagonal (cm)',
												'Width (in)',
												'Height (in)',
												'Diagonal (in)',
											],
									paperSizeExportRows(sizes, { includeSeries }),
								)}>Export</Button
						>
					</div>
					{#if sizes.length > 0}
						<table id={tableId} class="ref-table">
							<thead>
								<tr>
									<th>Name</th>
									{#if includeSeries}<th>Series</th>{/if}
									<th>Width (cm)</th>
									<th>Height (cm)</th>
									<th>Diagonal (cm)</th>
									<th>Width (in)</th>
									<th>Height (in)</th>
									<th>Diagonal (in)</th>
								</tr>
							</thead>
							<tbody>
								{#each sizes as size (size.Name)}
									{@const diagCm = diagonalCm(size.Width_mm, size.Height_mm)}
									{@const diagIn = diagonalIn(size.Width_in, size.Height_in)}
									<tr>
										<td>{size.Name}</td>
										{#if includeSeries}<td>{size.Series}</td>{/if}
										<td>{(size.Width_mm / 10).toFixed(1)}</td>
										<td>{(size.Height_mm / 10).toFixed(1)}</td>
										<td>{diagCm.toFixed(1)}</td>
										<td>{size.Width_in}</td>
										<td>{size.Height_in}</td>
										<td>{diagIn.toFixed(1)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<LoadingState />
					{/if}
				</section>
			{/snippet}

			{#if activeSection === 'tablet-sizes'}
				{@render sizeTable(
					'Pen Tablet Size Categories',
					'pen-tablet-sizes',
					'pen-tablet-table',
					penTabletRangesCm,
					penTabletRangesIn,
				)}
				{@render sizeTable(
					'Pen Display Size Categories',
					'pen-display-sizes',
					'pen-display-table',
					displayRangesCm,
					displayRangesIn,
				)}
			{:else if activeSection === 'iso-paper-a'}
				{@render paperTable(
					'ISO A Paper Sizes',
					'iso-a-paper-sizes',
					'iso-a-paper-table',
					aSeries,
					false,
				)}
			{:else if activeSection === 'iso-paper-b'}
				{@render paperTable(
					'ISO B Paper Sizes',
					'iso-b-paper-sizes',
					'iso-b-paper-table',
					bSeries,
					false,
				)}
			{:else if activeSection === 'us-paper'}
				{@render paperTable(
					'US Paper Sizes',
					'us-paper-sizes',
					'us-paper-table',
					usPaperSizes,
					true,
				)}
			{:else if activeSection === 'display-resolutions'}
				<section>
					<div class="section-header">
						<h2>Display Resolution Categories</h2>
						<Button
							variant="subtle"
							onclick={() => {
								const headers = [
									'Category',
									'Resolution',
									'Megapixels',
									'Aspect Ratio',
									'Displays in dataset',
								];
								const rows: (string | number)[][] = [];
								for (const cat of resolutionCategories) {
									cat.resolutions.forEach((res, i) => {
										const mp = ((res.w * res.h) / 1_000_000).toFixed(2);
										const g = gcd(res.w, res.h);
										const ar = `${res.w / g}:${res.h / g}`;
										const count = i === 0 ? (resolutionCounts[cat.name] ?? 0) : '';
										rows.push([cat.name, `${res.w} × ${res.h}`, `${mp} MP`, ar, count]);
									});
								}
								rows.push(['Other', '—', '—', '—', resolutionCounts['Other'] ?? 0]);
								openExport('Display Resolution Categories', 'display-resolutions', headers, rows);
							}}>Export</Button
						>
					</div>
					<table id="res-cat-table" class="ref-table">
						<thead>
							<tr>
								<th>Category</th>
								<th>Resolution(s)</th>
								<th>Megapixels</th>
								<th>Aspect Ratio</th>
								<th>Displays in dataset</th>
							</tr>
						</thead>
						<tbody>
							{#each resolutionCategories as cat (cat.name)}
								{#each cat.resolutions as res, i (i)}
									{@const mp = ((res.w * res.h) / 1_000_000).toFixed(2)}
									{@const g = gcd(res.w, res.h)}
									{@const ar = `${res.w / g}:${res.h / g}`}
									{@const count = i === 0 ? (resolutionCounts[cat.name] ?? 0) : null}
									<tr>
										{#if i === 0}
											<td rowspan={cat.resolutions.length} class="cat-name">{cat.name}</td>
										{/if}
										<td>{res.w} × {res.h}</td>
										<td>{mp} MP</td>
										<td>{ar}</td>
										{#if i === 0}
											<td rowspan={cat.resolutions.length} class="count-cell">
												{count === 0 ? '—' : count}
											</td>
										{/if}
									</tr>
								{/each}
							{/each}
							<tr class="other-row">
								<td>Other</td>
								<td>—</td>
								<td>—</td>
								<td>—</td>
								<td>{resolutionCounts['Other'] ?? 0}</td>
							</tr>
						</tbody>
					</table>
				</section>
			{:else if activeSection === 'piaf-ranking'}
				<section>
					<div class="section-header">
						<h2>IAF Ranking</h2>
					</div>
					<p class="ref-blurb">
						IAF (Initial Activation Force) is the minimum force required for a pen tip to register
						pressure. Lower is better — a lighter touch means more natural shading and less hand
						fatigue.
					</p>
					<BandsChart
						bands={piafBands}
						axisMax={10}
						axisStep={1}
						unit="gf"
						title="IAF Ranking"
						showBandRanges={false}
					/>
					<div class="subsection-header">
						<h3>Ranking Bands</h3>
						<Button
							variant="subtle"
							onclick={() =>
								openExport(
									'IAF Ranking',
									'iaf-ranking',
									['Rank', 'Rating', 'Range (gf)'],
									piafBands.map((b) => [
										b.label,
										b.name ?? '',
										b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`,
									]),
								)}>Export</Button
						>
					</div>
					<table class="ref-table">
						<thead><tr><th>Rank</th><th>Rating</th><th>Range</th></tr></thead>
						<tbody>
							{#each piafBands as b (b.label)}
								<tr>
									<td>{b.label}</td>
									<td>{b.name ?? ''}</td>
									<td>{b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{:else if activeSection === 'pmax-ranking'}
				<section>
					<div class="section-header">
						<h2>MAX Ranking</h2>
					</div>
					<BandsChart
						bands={pmaxBands}
						axisMax={1000}
						axisStep={100}
						unit="gf"
						title="MAX Ranking"
						showBandRanges={false}
					/>
					<div class="subsection-header">
						<h3>Ranking Bands</h3>
						<Button
							variant="subtle"
							onclick={() =>
								openExport(
									'MAX Ranking',
									'max-ranking',
									['Rank', 'Rating', 'Range (gf)'],
									pmaxBandsByRank.map((b) => [
										b.label,
										b.name ?? '',
										b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`,
									]),
								)}>Export</Button
						>
					</div>
					<table class="ref-table">
						<thead><tr><th>Rank</th><th>Rating</th><th>Range</th></tr></thead>
						<tbody>
							{#each pmaxBandsByRank as b (b.label)}
								<tr>
									<td>{b.label}</td>
									<td>{b.name ?? ''}</td>
									<td>{b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{:else}
				{#each specBandSections as s (s.id)}
					{#if activeSection === s.id}
						<section>
							<div class="section-header">
								<h2>{s.title}</h2>
								<Button
									variant="subtle"
									onclick={() =>
										openExport(
											s.title,
											s.filename,
											['Rank', `Range (${s.unit})`],
											s.bands.map((b) => [b.label, formatBandRange(b, s.unit)]),
										)}>Export</Button
								>
							</div>
							<p class="ref-blurb">{s.blurb}</p>
							<p class="ref-blurb">
								Used by the Tablets ▸ Analysis ▸ {s.title.replace(' Bands', '')} histogram. Edit
								<code>src/lib/bands.ts</code> to change thresholds — the histogram and this table both
								read from the same source.
							</p>
							<table class="ref-table">
								<thead><tr><th>Rank</th><th>Rating</th><th>Range</th></tr></thead>
								<tbody>
									{#each s.bands as b (b.label)}
										<tr>
											<td>{b.label}</td>
											<td>{formatBandRange(b, s.unit)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</section>
					{/if}
				{/each}
			{/if}
		{/snippet}
	</SectionedPage>

	{#if exportHost.config}
		<ExportDialog
			entityType="reference"
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

	section {
		margin-bottom: 24px;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	h2 {
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 0;
	}

	.subsection-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 1px solid var(--border);
	}

	.subsection-header h3 {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		margin: 0;
	}

	.ref-table {
		border-collapse: collapse;
		font-size: 13px;
	}

	.ref-table th,
	.ref-table td {
		padding: 4px 12px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	.ref-table th {
		font-weight: 600;
		color: var(--th-text);
		background: var(--th-bg);
	}

	.ref-blurb {
		font-size: 13px;
		color: var(--text-muted);
		max-width: 800px;
		margin: 0 0 16px;
		line-height: 1.5;
	}

	.cat-name {
		font-weight: 600;
		vertical-align: middle;
	}

	.count-cell {
		vertical-align: middle;
		text-align: center;
	}

	.other-row td {
		color: var(--text-muted);
		font-style: italic;
	}
</style>
